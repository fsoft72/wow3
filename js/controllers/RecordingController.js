/**
 * WOW3 Recording Controller
 * Manages the full recording lifecycle: tab capture, camera PiP compositing,
 * MediaRecorder, and IndexedDB chunk persistence.
 */

import { RecordingDialog } from '../components/RecordingDialog.js';
import { toast } from '../utils/toasts.js';

// ─── Constants ───────────────────────────────────────────

/** Camera circle diameter in canvas pixels */
const PIP_DIAMETER = 150;

/** Margin from canvas edge for default PiP position */
const PIP_MARGIN = 20;

/** White border width around camera PiP circle */
const PIP_BORDER = 3;

/** Interval between MediaRecorder data chunks (ms) */
const CHUNK_INTERVAL_MS = 10000;

// ─── RecordingController Class ───────────────────────────

export class RecordingController {
  /**
   * Create recording controller.
   * @param {import('./EditorController.js').EditorController} editorController - Editor controller instance
   */
  constructor(editorController) {
    this.editor = editorController;

    /** @type {boolean} Whether a recording is currently active */
    this.isRecording = false;

    /** @type {string|null} Unique session ID for the current recording */
    this._sessionId = null;

    /** @type {MediaRecorder|null} Active MediaRecorder instance */
    this._mediaRecorder = null;

    /** @type {MediaStream|null} Tab/screen capture stream */
    this._tabStream = null;

    /** @type {MediaStream|null} Camera stream for PiP */
    this._cameraStream = null;

    /** @type {MediaStream|null} Microphone audio stream */
    this._micStream = null;

    /** @type {HTMLCanvasElement|null} Offscreen compositing canvas */
    this._canvas = null;

    /** @type {CanvasRenderingContext2D|null} Canvas 2D context */
    this._ctx = null;

    /** @type {HTMLVideoElement|null} Hidden video element for tab stream */
    this._tabVideo = null;

    /** @type {HTMLVideoElement|null} Hidden video element for camera stream */
    this._camVideo = null;

    /** @type {number|null} requestAnimationFrame ID for compositing loop */
    this._rafId = null;

    /** @type {number} Current chunk index for the recording session */
    this._chunkIndex = 0;

    /** @type {Blob[]} In-memory chunk collection (primary source for assembly) */
    this._chunks = [];

    /** @type {{ x: number, y: number }|null} Current PiP circle center position */
    this._pipPos = null;

    /** @type {boolean} Whether the PiP circle is being dragged */
    this._pipDragging = false;

    /** @type {{ x: number, y: number }|null} Offset from PiP center during drag */
    this._pipDragOffset = null;

    /** @type {Object|null} Recording settings from RecordingDialog */
    this._settings = null;

    /** @type {AudioContext|null} Audio mixing context */
    this._mixAudioCtx = null;

    /** @type {Function|null} Bound mousedown handler for PiP drag */
    this._pipMouseDown = null;

    /** @type {Function|null} Bound mousemove handler for PiP drag */
    this._pipMouseMove = null;

    /** @type {Function|null} Bound mouseup handler for PiP drag */
    this._pipMouseUp = null;

    /** @type {HTMLElement|null} Visible PiP overlay element on presentation view */
    this._pipOverlay = null;
  }

  // ─── Public API ──────────────────────────────────────────

  /**
   * Initialize the recording controller.
   * Binds the record button click handler.
   */
  init() {
    const recordBtn = document.getElementById('record-btn');
    if (recordBtn) {
      recordBtn.addEventListener('click', () => this._onRecordButtonClick());
    }
  }

  /**
   * Start the recording flow: show dialog, capture streams, begin recording.
   * Creates a RecordingDialog, collects settings, and initiates recording.
   */
  async startFlow() {
    const dialog = new RecordingDialog();
    const settings = await dialog.show();
    if (!settings) return;

    try {
      await this._startRecording(settings);
    } catch (err) {
      console.error('Recording failed to start:', err);
      toast.error(`Recording failed: ${err.message}`);
      this._cleanup();
    }
  }

  /**
   * Stop the current recording, assemble chunks, and trigger download.
   */
  async stop() {
    this.isRecording = false;

    // Stop MediaRecorder and wait for final ondataavailable + onstop
    // onstop fires after the last ondataavailable, so in-memory chunks are complete
    await new Promise(resolve => {
      if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
        this._mediaRecorder.onstop = resolve;
        this._mediaRecorder.stop();
      } else {
        resolve();
      }
    });

    // Stop playback if playing
    if (this.editor.playbackController && this.editor.playbackController.isPlaying) {
      this.editor.playbackController.stop();
    }

    // Show processing modal
    const overlay = this._showProcessingModal();

    try {
      // Use in-memory chunks (reliable) instead of IndexedDB (async, may lag)
      if (this._chunks.length === 0) {
        toast.warning('No recording data captured');
        overlay.remove();
        this._cleanup();
        this._updateRecordButton(false);
        return;
      }

      const mimeType = this._chunks[0].type || 'video/webm';
      const fullBlob = new Blob(this._chunks, { type: mimeType });

      // Generate filename
      const title = (this.editor.presentation && this.editor.presentation.title)
        ? this.editor.presentation.title.replace(/[^a-zA-Z0-9_-]/g, '_')
        : 'recording';
      const date = new Date().toISOString().slice(0, 10);
      const filename = `${title}_${date}.webm`;

      // Create download link and trigger
      const url = URL.createObjectURL(fullBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Clean up session chunks from IndexedDB (if persisted)
      if (this._settings && this._settings.persist) {
        await window.RecordingDB.deleteSession(this._sessionId);
      }

      toast.success('Recording saved');
    } catch (err) {
      console.error('Failed to assemble recording:', err);
      toast.error('Failed to save recording');
    } finally {
      overlay.remove();
      this._cleanup();
      this._updateRecordButton(false);
    }
  }

  // ─── Private: Event Handlers ────────────────────────────

  /**
   * Handle record button click: toggle between start and stop.
   * Guards against rapid double-clicks with a busy flag.
   */
  async _onRecordButtonClick() {
    if (this._busy) return;
    this._busy = true;
    try {
      if (this.isRecording) {
        await this.stop();
      } else {
        await this.startFlow();
      }
    } finally {
      this._busy = false;
    }
  }

  // ─── Private: Recording Lifecycle ───────────────────────

  /**
   * Start a recording session with the given settings.
   * Captures tab, camera, and mic streams; creates the compositing canvas;
   * sets up MediaRecorder with IndexedDB chunk persistence.
   * @param {Object} settings - Settings from RecordingDialog
   * @param {Object} settings.resolution - { width, height }
   * @param {boolean} settings.cursor - Show cursor in capture
   * @param {string|null} settings.cameraDeviceId - Camera device ID or null
   * @param {string|null} settings.micDeviceId - Microphone device ID or null
   */
  async _startRecording(settings) {
    this._settings = settings;
    this._sessionId = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this._chunkIndex = 0;

    const { resolution, cursor, cameraDeviceId, micDeviceId } = settings;

    // 1. Capture tab/screen
    this._tabStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: cursor ? 'always' : 'never',
        width: { ideal: resolution.width },
        height: { ideal: resolution.height },
      },
      audio: true,
      preferCurrentTab: true,
    });

    // Auto-stop when user ends screen share via browser UI
    const videoTrack = this._tabStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.addEventListener('ended', () => {
        if (this.isRecording) {
          this.stop();
        }
      });
    }

    // 2. Camera stream (optional, graceful fail)
    if (cameraDeviceId) {
      try {
        this._cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: cameraDeviceId },
            width: { ideal: 320 },
            height: { ideal: 240 },
          },
        });
      } catch (err) {
        console.warn('Failed to start camera for recording:', err);
        this._cameraStream = null;
      }
    }

    // 3. Microphone stream (optional, graceful fail)
    if (micDeviceId) {
      try {
        this._micStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: micDeviceId } },
        });
      } catch (err) {
        console.warn('Failed to start microphone for recording:', err);
        this._micStream = null;
      }
    }

    // 4. Create offscreen canvas at requested resolution
    this._canvas = document.createElement('canvas');
    this._canvas.width = resolution.width;
    this._canvas.height = resolution.height;
    this._ctx = this._canvas.getContext('2d');

    // 5. Create hidden video elements for streams
    this._tabVideo = document.createElement('video');
    this._tabVideo.srcObject = this._tabStream;
    this._tabVideo.muted = true;
    this._tabVideo.playsInline = true;
    await this._tabVideo.play();

    if (this._cameraStream) {
      this._camVideo = document.createElement('video');
      this._camVideo.srcObject = this._cameraStream;
      this._camVideo.muted = true;
      this._camVideo.playsInline = true;
      await this._camVideo.play();
    }

    // 6. Set default PiP position: bottom-right with margin
    this._pipPos = {
      x: resolution.width - PIP_DIAMETER / 2 - PIP_MARGIN,
      y: resolution.height - PIP_DIAMETER / 2 - PIP_MARGIN,
    };

    // 7. Set up PiP drag and visible overlay if camera is enabled
    if (this._cameraStream) {
      this._setupPipDrag();
      this._createPipOverlay();
    }

    // 8. Mark as recording BEFORE starting compositing loop (loop guard checks this flag)
    this.isRecording = true;
    this._updateRecordButton(true);

    // 9. Start compositing loop
    this._startCompositing();

    // 10. Get canvas stream at 30fps
    const canvasStream = this._canvas.captureStream(30);

    // 11. Mix audio tracks and add to canvas stream
    const mixedAudioTracks = this._mixAudioTracks();
    for (const track of mixedAudioTracks) {
      canvasStream.addTrack(track);
    }

    // 12. Create MediaRecorder with best supported mimeType
    const mimeType = this._getSupportedMimeType();
    this._mediaRecorder = new MediaRecorder(canvasStream, {
      mimeType,
      videoBitsPerSecond: 5_000_000,
    });

    // 13. Handle data chunks — keep in memory + persist to IndexedDB for crash resilience
    this._chunks = [];
    this._mediaRecorder.ondataavailable = (event) => {
      if (!event.data || event.data.size === 0) return;

      // Primary: in-memory array (used for final assembly)
      this._chunks.push(event.data);

      // Secondary: IndexedDB persistence (crash resilience, fire-and-forget)
      if (this._settings.persist) {
        window.RecordingDB.saveChunk(
          this._sessionId,
          this._chunkIndex++,
          event.data
        ).catch(err => console.error('Failed to persist chunk to IndexedDB:', err));
      }
    };

    // 14. Start recording with chunk interval
    this._mediaRecorder.start(CHUNK_INTERVAL_MS);

    // 15. Auto-start playback from the beginning
    if (this.editor.playbackController) {
      this.editor.playbackController.start(0);
    }

    toast.success('Recording started');
  }

  /**
   * Determine the best supported MIME type for MediaRecorder.
   * Tries VP9+Opus, VP8+Opus, VP9, VP8, then falls back to basic webm.
   * @returns {string} Supported MIME type string
   */
  _getSupportedMimeType() {
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];

    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    }

    return 'video/webm';
  }

  /**
   * Mix tab audio and microphone audio into a single set of audio tracks.
   * Uses AudioContext and MediaStreamDestination for mixing.
   * @returns {MediaStreamTrack[]} Array of mixed audio tracks
   */
  _mixAudioTracks() {
    const tabAudioTracks = this._tabStream ? this._tabStream.getAudioTracks() : [];
    const micAudioTracks = this._micStream ? this._micStream.getAudioTracks() : [];

    // If no audio tracks at all, return empty
    if (tabAudioTracks.length === 0 && micAudioTracks.length === 0) return [];

    this._mixAudioCtx = new AudioContext();
    const destination = this._mixAudioCtx.createMediaStreamDestination();

    // Connect tab audio tracks
    if (tabAudioTracks.length > 0) {
      const tabAudioStream = new MediaStream(tabAudioTracks);
      const tabSource = this._mixAudioCtx.createMediaStreamSource(tabAudioStream);
      tabSource.connect(destination);
    }

    // Connect mic audio tracks
    if (micAudioTracks.length > 0) {
      const micSource = this._mixAudioCtx.createMediaStreamSource(this._micStream);
      micSource.connect(destination);
    }

    return destination.stream.getAudioTracks();
  }

  // ─── Private: Canvas Compositing ────────────────────────

  /**
   * Start the requestAnimationFrame compositing loop.
   * Draws the tab capture frame and (optionally) the camera PiP circle.
   */
  _startCompositing() {
    const draw = () => {
      if (!this.isRecording || !this._canvas) return;

      this._rafId = requestAnimationFrame(draw);

      const ctx = this._ctx;
      const w = this._canvas.width;
      const h = this._canvas.height;

      // Draw tab video frame to full canvas
      if (this._tabVideo && this._tabVideo.readyState >= 2) {
        ctx.drawImage(this._tabVideo, 0, 0, w, h);
      }

      // Draw camera PiP if active
      if (this._camVideo && this._camVideo.readyState >= 2 && this._pipPos) {
        const cx = this._pipPos.x;
        const cy = this._pipPos.y;
        const r = PIP_DIAMETER / 2;

        ctx.save();

        // Drop shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // White border circle
        ctx.beginPath();
        ctx.arc(cx, cy, r + PIP_BORDER, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Reset shadow so it doesn't apply to the camera frame
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Clip to inner circle
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();

        // Draw camera video scaled to fill circle (cover fit)
        const vw = this._camVideo.videoWidth || 320;
        const vh = this._camVideo.videoHeight || 240;
        const scale = Math.max(PIP_DIAMETER / vw, PIP_DIAMETER / vh);
        const sw = vw * scale;
        const sh = vh * scale;
        const sx = cx - sw / 2;
        const sy = cy - sh / 2;
        ctx.drawImage(this._camVideo, sx, sy, sw, sh);

        ctx.restore();
      }
    };

    draw();
  }

  // ─── Private: PiP Drag ─────────────────────────────────

  /**
   * Set up mouse event listeners on #presentation-view for PiP circle dragging.
   * Uses capture phase to intercept events before presentation navigation handlers.
   */
  _setupPipDrag() {
    const view = document.getElementById('presentation-view');
    if (!view) return;

    this._pipMouseDown = (e) => {
      if (!this._pipPos || !this._cameraStream) return;

      // Map screen coords to canvas coords
      const rect = view.getBoundingClientRect();
      const scaleX = this._canvas.width / rect.width;
      const scaleY = this._canvas.height / rect.height;
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;

      // Check if click is inside PiP circle
      const dx = canvasX - this._pipPos.x;
      const dy = canvasY - this._pipPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= PIP_DIAMETER / 2 + PIP_BORDER) {
        this._pipDragging = true;
        this._pipDragOffset = { x: dx, y: dy };
        e.preventDefault();
        e.stopPropagation();
      }
    };

    this._pipMouseMove = (e) => {
      if (!this._pipDragging) return;

      const rect = view.getBoundingClientRect();
      const scaleX = this._canvas.width / rect.width;
      const scaleY = this._canvas.height / rect.height;
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;

      // Calculate new position with offset
      const r = PIP_DIAMETER / 2 + PIP_BORDER;
      let newX = canvasX - this._pipDragOffset.x;
      let newY = canvasY - this._pipDragOffset.y;

      // Clamp to canvas bounds
      newX = Math.max(r, Math.min(this._canvas.width - r, newX));
      newY = Math.max(r, Math.min(this._canvas.height - r, newY));

      this._pipPos = { x: newX, y: newY };
      this._updatePipOverlayPosition();

      e.preventDefault();
      e.stopPropagation();
    };

    this._pipMouseUp = (e) => {
      if (!this._pipDragging) return;
      this._pipDragging = false;
      this._pipDragOffset = null;
      e.preventDefault();
      e.stopPropagation();
    };

    view.addEventListener('mousedown', this._pipMouseDown, true);
    document.addEventListener('mousemove', this._pipMouseMove, true);
    document.addEventListener('mouseup', this._pipMouseUp, true);
  }

  /**
   * Remove all PiP mouse event listeners from #presentation-view.
   */
  _removePipDrag() {
    const view = document.getElementById('presentation-view');
    if (!view) return;

    if (this._pipMouseDown) {
      view.removeEventListener('mousedown', this._pipMouseDown, true);
      this._pipMouseDown = null;
    }
    if (this._pipMouseMove) {
      document.removeEventListener('mousemove', this._pipMouseMove, true);
      this._pipMouseMove = null;
    }
    if (this._pipMouseUp) {
      document.removeEventListener('mouseup', this._pipMouseUp, true);
      this._pipMouseUp = null;
    }
  }

  // ─── Private: PiP Overlay ──────────────────────────────

  /**
   * Create a visible camera circle overlay on #presentation-view.
   * This lets the user see the PiP position during recording.
   */
  _createPipOverlay() {
    const view = document.getElementById('presentation-view');
    if (!view || !this._cameraStream) return;

    this._pipOverlay = document.createElement('div');
    this._pipOverlay.id = 'recording-pip-overlay';

    const video = document.createElement('video');
    video.srcObject = this._cameraStream;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;

    this._pipOverlay.appendChild(video);
    view.appendChild(this._pipOverlay);

    this._updatePipOverlayPosition();
  }

  /**
   * Update the PiP overlay DOM position to match the canvas-space _pipPos.
   * Converts canvas coordinates to screen-relative coordinates within the view.
   */
  _updatePipOverlayPosition() {
    if (!this._pipOverlay || !this._pipPos || !this._canvas) return;

    const view = document.getElementById('presentation-view');
    if (!view) return;

    const rect = view.getBoundingClientRect();
    const scaleX = this._canvas.width / rect.width;
    const scaleY = this._canvas.height / rect.height;

    // Convert canvas-space diameter to screen-space
    const screenW = PIP_DIAMETER / scaleX;
    const screenH = PIP_DIAMETER / scaleY;

    // Convert canvas-space center to screen-space position
    const screenCX = this._pipPos.x / scaleX;
    const screenCY = this._pipPos.y / scaleY;

    this._pipOverlay.style.width = `${screenW}px`;
    this._pipOverlay.style.height = `${screenH}px`;
    this._pipOverlay.style.left = `${screenCX - screenW / 2}px`;
    this._pipOverlay.style.top = `${screenCY - screenH / 2}px`;
  }

  /**
   * Remove the PiP overlay element from the DOM.
   */
  _removePipOverlay() {
    if (this._pipOverlay) {
      this._pipOverlay.remove();
      this._pipOverlay = null;
    }
  }

  // ─── Private: UI Helpers ────────────────────────────────

  /**
   * Show a processing modal overlay while assembling the recording.
   * @returns {HTMLElement} The overlay element (call .remove() to dismiss)
   */
  _showProcessingModal() {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;

    content.innerHTML = `
      <div class="preloader-wrapper active">
        <div class="spinner-layer spinner-blue-only">
          <div class="circle-clipper left"><div class="circle"></div></div>
          <div class="gap-patch"><div class="circle"></div></div>
          <div class="circle-clipper right"><div class="circle"></div></div>
        </div>
      </div>
      <p style="margin-top: 20px; font-size: 16px; color: #333;">Assembling your recording...</p>
    `;

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    return overlay;
  }

  /**
   * Update the record button appearance based on recording state.
   * @param {boolean} recording - Whether recording is active
   */
  _updateRecordButton(recording) {
    const btn = document.getElementById('record-btn');
    if (!btn) return;

    const icon = btn.querySelector('i');

    if (recording) {
      btn.classList.add('recording-active');
      btn.title = 'Stop Recording';
      if (icon) icon.textContent = 'stop';
    } else {
      btn.classList.remove('recording-active');
      btn.title = 'Record Presentation';
      if (icon) icon.textContent = 'fiber_manual_record';
    }
  }

  /**
   * Clean up all recording resources: streams, canvas, audio context, listeners.
   */
  _cleanup() {
    // Cancel compositing loop
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    // Stop all media streams
    if (this._tabStream) {
      this._tabStream.getTracks().forEach(t => t.stop());
      this._tabStream = null;
    }
    if (this._cameraStream) {
      this._cameraStream.getTracks().forEach(t => t.stop());
      this._cameraStream = null;
    }
    if (this._micStream) {
      this._micStream.getTracks().forEach(t => t.stop());
      this._micStream = null;
    }

    // Close audio mixing context
    if (this._mixAudioCtx) {
      this._mixAudioCtx.close().catch(() => {});
      this._mixAudioCtx = null;
    }

    // Remove PiP drag listeners and overlay
    this._removePipDrag();
    this._removePipOverlay();

    // Null all references
    this._mediaRecorder = null;
    this._canvas = null;
    this._ctx = null;
    this._tabVideo = null;
    this._camVideo = null;
    this._sessionId = null;
    this._settings = null;
    this._pipPos = null;
    this._pipDragging = false;
    this._pipDragOffset = null;
    this._chunkIndex = 0;
    this._chunks = [];
  }
}

export default RecordingController;
