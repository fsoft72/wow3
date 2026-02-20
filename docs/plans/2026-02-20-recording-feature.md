# Record Presentation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add presentation recording that captures tab content + optional camera (circle PiP) + optional microphone as a downloadable WebM video.

**Architecture:** Canvas compositing approach — capture tab via `getDisplayMedia`, camera via `getUserMedia`, composite onto a hidden canvas at ~30fps using `requestAnimationFrame`, record the canvas stream with `MediaRecorder`. Chunks saved to IndexedDB every 10s for crash resilience.

**Tech Stack:** Native browser APIs only — `getDisplayMedia`, `getUserMedia`, `MediaRecorder`, Canvas 2D, `AudioContext`/`AnalyserNode`, IndexedDB.

---

### Task 1: RecordingDB — IndexedDB chunk storage

**Files:**
- Create: `js/utils/recording_db.js`
- Modify: `index.html:282-293` (add script tag)

**Step 1: Create `js/utils/recording_db.js`**

Follow the same pattern as `js/utils/media_db.js` — a global object on `window.RecordingDB`.

```javascript
/**
 * WOW3 RecordingDB: IndexedDB manager for recording chunks
 * Stores video blob chunks during recording for crash resilience
 */

const RECORDING_DB_NAME = 'wow3_recordings';
const RECORDING_DB_VERSION = 1;
const STORE_CHUNKS = 'recording_chunks';

let recordingDbPromise = null;

const RecordingDB = {
  /**
   * Initialize Recording IndexedDB
   * @returns {Promise<IDBDatabase>}
   */
  init() {
    if (recordingDbPromise) return recordingDbPromise;

    recordingDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(RECORDING_DB_NAME, RECORDING_DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
          const store = db.createObjectStore(STORE_CHUNKS, { keyPath: 'id', autoIncrement: true });
          store.createIndex('sessionId', 'sessionId', { unique: false });
        }

        console.log('RecordingDB initialized:', RECORDING_DB_NAME);
      };

      request.onsuccess = (event) => {
        console.log('RecordingDB connection successful');
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.error('RecordingDB error:', event.target.error);
        reject(event.target.error);
      };
    });

    return recordingDbPromise;
  },

  /**
   * Save a recording chunk to IndexedDB
   * @param {string} sessionId - Recording session identifier
   * @param {number} chunkIndex - Sequential chunk index
   * @param {Blob} blob - Video data blob
   * @returns {Promise<void>}
   */
  async saveChunk(sessionId, chunkIndex, blob) {
    const db = await this.init();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CHUNKS], 'readwrite');
      const request = tx.objectStore(STORE_CHUNKS).add({
        sessionId,
        chunkIndex,
        blob,
        timestamp: Date.now()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get all chunks for a recording session, ordered by chunkIndex
   * @param {string} sessionId - Recording session identifier
   * @returns {Promise<Array>} Array of chunk objects sorted by chunkIndex
   */
  async getChunks(sessionId) {
    const db = await this.init();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_CHUNKS], 'readonly');
      const index = tx.objectStore(STORE_CHUNKS).index('sessionId');
      const request = index.getAll(IDBKeyRange.only(sessionId));
      request.onsuccess = () => {
        const chunks = request.result || [];
        chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
        resolve(chunks);
      };
      request.onerror = () => resolve([]);
    });
  },

  /**
   * Delete all chunks for a recording session
   * @param {string} sessionId - Recording session identifier
   * @returns {Promise<void>}
   */
  async deleteSession(sessionId) {
    const db = await this.init();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_CHUNKS], 'readwrite');
      const store = tx.objectStore(STORE_CHUNKS);
      const index = store.index('sessionId');
      index.openCursor(IDBKeyRange.only(sessionId)).onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
    });
  },

  /**
   * Clear all recording data
   * @returns {Promise<void>}
   */
  async clearAll() {
    const db = await this.init();
    await new Promise((resolve) => {
      const tx = db.transaction([STORE_CHUNKS], 'readwrite');
      tx.objectStore(STORE_CHUNKS).clear();
      tx.oncomplete = () => resolve();
    });
  }
};

window.RecordingDB = RecordingDB;
```

**Step 2: Add script tag to `index.html`**

After the `media_db.js` script tag (line 283), add:

```html
<script src="js/utils/recording_db.js"></script>
```

**Step 3: Commit**

```bash
git add js/utils/recording_db.js index.html
git commit -m "feat: Add RecordingDB IndexedDB storage for recording chunks"
```

---

### Task 2: RecordingDialog — settings dialog component

**Files:**
- Create: `js/components/RecordingDialog.js`

**Step 1: Create `js/components/RecordingDialog.js`**

This is an ES6 module that uses the existing `Dialog.show()` pattern but with a custom `onRender` hook for device enumeration, previews, and level meter.

```javascript
/**
 * WOW3 Recording Dialog
 * Shows recording settings: resolution, cursor, camera, microphone
 * with live previews before starting a recording session.
 */

const RESOLUTIONS = [
  { label: '720p (1280×720)', width: 1280, height: 720 },
  { label: '1080p (1920×1080)', width: 1920, height: 1080 },
  { label: '1440p (2560×1440)', width: 2560, height: 1440 }
];

export class RecordingDialog {
  constructor() {
    /** @type {MediaStream|null} Camera preview stream */
    this._cameraStream = null;
    /** @type {MediaStream|null} Mic preview stream */
    this._micStream = null;
    /** @type {AudioContext|null} */
    this._audioCtx = null;
    /** @type {AnalyserNode|null} */
    this._analyser = null;
    /** @type {number|null} */
    this._levelRAF = null;
  }

  /**
   * Show the recording settings dialog
   * @returns {Promise<Object|null>} Settings object or null if cancelled
   *   { resolution: { width, height }, cursor: boolean, cameraDeviceId: string|null, micDeviceId: string|null }
   */
  async show() {
    // Request temporary permission to enumerate devices with labels
    let tempStream = null;
    try {
      tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch (e) {
      // User may deny — we'll still show the dialog but without device labels
      console.warn('Could not get temp media stream for device enumeration:', e);
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(d => d.kind === 'videoinput');
    const microphones = devices.filter(d => d.kind === 'audioinput');

    // Release temp stream
    if (tempStream) {
      tempStream.getTracks().forEach(t => t.stop());
    }

    const cameraOptions = cameras.map((d, i) =>
      `<option value="${d.deviceId}">${d.label || 'Camera ' + (i + 1)}</option>`
    ).join('');

    const micOptions = microphones.map((d, i) =>
      `<option value="${d.deviceId}">${d.label || 'Microphone ' + (i + 1)}</option>`
    ).join('');

    const resolutionOptions = RESOLUTIONS.map((r, i) =>
      `<option value="${i}" ${i === 1 ? 'selected' : ''}>${r.label}</option>`
    ).join('');

    const bodyHtml = `
      <div class="recording-settings">
        <div class="recording-field">
          <label>Resolution</label>
          <select id="rec-resolution" class="browser-default">${resolutionOptions}</select>
        </div>

        <div class="recording-field">
          <label>
            <input type="checkbox" id="rec-cursor" checked />
            <span>Show cursor</span>
          </label>
        </div>

        <hr class="recording-divider" />

        <div class="recording-field">
          <label>Camera</label>
          <select id="rec-camera" class="browser-default">
            <option value="">OFF</option>
            ${cameraOptions}
          </select>
          <div id="rec-camera-preview-container" class="recording-preview-container" style="display:none;">
            <video id="rec-camera-preview" autoplay muted playsinline class="recording-camera-preview"></video>
          </div>
        </div>

        <div class="recording-field">
          <label>Microphone</label>
          <select id="rec-mic" class="browser-default">
            <option value="">OFF</option>
            ${micOptions}
          </select>
          <div id="rec-mic-preview-container" class="recording-preview-container" style="display:none;">
            <div id="rec-mic-level" class="recording-mic-level">
              <div id="rec-mic-level-bar" class="recording-mic-level-bar"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const self = this;

    const result = await Dialog.show({
      title: 'Record Presentation',
      body: bodyHtml,
      boxClass: 'dialog-recording',
      buttons: [
        { text: 'Cancel', type: 'secondary', value: null },
        { text: 'Start Recording', type: 'danger', value: 'start', resolveInput: true }
      ],
      onRender(box) {
        const cameraSelect = box.querySelector('#rec-camera');
        const micSelect = box.querySelector('#rec-mic');

        cameraSelect.addEventListener('change', () => self._updateCameraPreview(box));
        micSelect.addEventListener('change', () => self._updateMicPreview(box));
      }
    });

    // Cleanup previews
    this._stopAllPreviews();

    if (!result || result === null) return null;

    // Extract settings from result
    const resIdx = parseInt(document.querySelector('#rec-resolution')?.value ?? '1', 10);
    // Dialog is already removed at this point, so we read from resolveInput
    const inputs = typeof result === 'object' ? result : {};

    const resolution = RESOLUTIONS[inputs['rec-resolution'] ?? resIdx] || RESOLUTIONS[1];
    const cursor = inputs['rec-cursor'] !== undefined ? inputs['rec-cursor'] : true;
    const cameraDeviceId = inputs['rec-camera'] || null;
    const micDeviceId = inputs['rec-mic'] || null;

    return {
      resolution: { width: resolution.width, height: resolution.height },
      cursor,
      cameraDeviceId,
      micDeviceId
    };
  }

  /**
   * Update camera preview when selection changes
   * @param {HTMLElement} box - Dialog box element
   * @private
   */
  async _updateCameraPreview(box) {
    const select = box.querySelector('#rec-camera');
    const container = box.querySelector('#rec-camera-preview-container');
    const video = box.querySelector('#rec-camera-preview');
    const deviceId = select.value;

    // Stop existing camera stream
    if (this._cameraStream) {
      this._cameraStream.getTracks().forEach(t => t.stop());
      this._cameraStream = null;
    }

    if (!deviceId) {
      container.style.display = 'none';
      return;
    }

    try {
      this._cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: 160, height: 120 }
      });
      video.srcObject = this._cameraStream;
      container.style.display = 'block';
    } catch (e) {
      console.warn('Camera preview failed:', e);
      container.style.display = 'none';
    }
  }

  /**
   * Update microphone level meter when selection changes
   * @param {HTMLElement} box - Dialog box element
   * @private
   */
  async _updateMicPreview(box) {
    const select = box.querySelector('#rec-mic');
    const container = box.querySelector('#rec-mic-preview-container');
    const levelBar = box.querySelector('#rec-mic-level-bar');
    const deviceId = select.value;

    // Stop existing mic stream and analyser
    this._stopMicPreview();

    if (!deviceId) {
      container.style.display = 'none';
      return;
    }

    try {
      this._micStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } }
      });

      this._audioCtx = new AudioContext();
      const source = this._audioCtx.createMediaStreamSource(this._micStream);
      this._analyser = this._audioCtx.createAnalyser();
      this._analyser.fftSize = 256;
      source.connect(this._analyser);

      container.style.display = 'block';

      const dataArray = new Uint8Array(this._analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!this._analyser) return;
        this._analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const pct = Math.min(100, (avg / 128) * 100);
        levelBar.style.width = pct + '%';
        this._levelRAF = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (e) {
      console.warn('Mic preview failed:', e);
      container.style.display = 'none';
    }
  }

  /**
   * Stop microphone preview
   * @private
   */
  _stopMicPreview() {
    if (this._levelRAF) {
      cancelAnimationFrame(this._levelRAF);
      this._levelRAF = null;
    }
    if (this._analyser) {
      this._analyser = null;
    }
    if (this._audioCtx) {
      this._audioCtx.close().catch(() => {});
      this._audioCtx = null;
    }
    if (this._micStream) {
      this._micStream.getTracks().forEach(t => t.stop());
      this._micStream = null;
    }
  }

  /**
   * Stop all preview streams
   * @private
   */
  _stopAllPreviews() {
    if (this._cameraStream) {
      this._cameraStream.getTracks().forEach(t => t.stop());
      this._cameraStream = null;
    }
    this._stopMicPreview();
  }
}
```

**Step 2: Commit**

```bash
git add js/components/RecordingDialog.js
git commit -m "feat: Add RecordingDialog settings component"
```

---

### Task 3: RecordingController — core recording engine

**Files:**
- Create: `js/controllers/RecordingController.js`
- Modify: `js/controllers/index.js:11` (add export)

**Step 1: Create `js/controllers/RecordingController.js`**

This is the main controller handling MediaRecorder, canvas compositing, camera PiP overlay, and the full recording lifecycle.

```javascript
/**
 * WOW3 Recording Controller
 * Manages presentation recording: tab capture, camera PiP compositing,
 * MediaRecorder lifecycle, and IndexedDB chunk persistence.
 */

import { RecordingDialog } from '../components/RecordingDialog.js';
import { appEvents, AppEvents } from '../utils/events.js';
import { toast } from '../utils/toasts.js';

/** Camera PiP circle diameter in canvas pixels */
const PIP_DIAMETER = 150;
/** Margin from edge for default PiP position */
const PIP_MARGIN = 20;
/** Border width for PiP circle */
const PIP_BORDER = 3;
/** Chunk interval in milliseconds (10 seconds) */
const CHUNK_INTERVAL_MS = 10000;

export class RecordingController {
  /**
   * Create recording controller
   * @param {import('./EditorController.js').EditorController} editorController
   */
  constructor(editorController) {
    this.editor = editorController;

    /** @type {boolean} */
    this.isRecording = false;

    /** @type {string|null} Current recording session ID */
    this._sessionId = null;

    /** @type {MediaRecorder|null} */
    this._mediaRecorder = null;

    /** @type {MediaStream|null} Tab capture stream */
    this._tabStream = null;

    /** @type {MediaStream|null} Camera stream */
    this._cameraStream = null;

    /** @type {MediaStream|null} Mic stream */
    this._micStream = null;

    /** @type {HTMLCanvasElement|null} Compositing canvas */
    this._canvas = null;

    /** @type {CanvasRenderingContext2D|null} */
    this._ctx = null;

    /** @type {HTMLVideoElement|null} Hidden video for tab stream */
    this._tabVideo = null;

    /** @type {HTMLVideoElement|null} Hidden video for camera stream */
    this._camVideo = null;

    /** @type {number|null} RAF id for compositing loop */
    this._rafId = null;

    /** @type {number} Chunk counter */
    this._chunkIndex = 0;

    /** @type {{ x: number, y: number }} PiP position (center of circle) */
    this._pipPos = { x: 0, y: 0 };

    /** @type {boolean} Whether PiP is being dragged */
    this._pipDragging = false;

    /** @type {{ x: number, y: number }} Drag offset */
    this._pipDragOffset = { x: 0, y: 0 };

    /** @type {Object|null} Current recording settings */
    this._settings = null;
  }

  /**
   * Initialize recording controller
   */
  async init() {
    console.log('Initializing RecordingController...');

    // Setup record button
    const recordBtn = document.getElementById('record-btn');
    if (recordBtn) {
      recordBtn.addEventListener('click', () => this._onRecordButtonClick());
    }

    console.log('RecordingController initialized');
  }

  /**
   * Handle record/stop button click
   * @private
   */
  async _onRecordButtonClick() {
    if (this.isRecording) {
      await this.stop();
    } else {
      await this.startFlow();
    }
  }

  /**
   * Show settings dialog and start recording
   */
  async startFlow() {
    const dialog = new RecordingDialog();
    const settings = await dialog.show();
    if (!settings) return;

    this._settings = settings;

    try {
      await this._startRecording(settings);
    } catch (err) {
      console.error('Failed to start recording:', err);
      toast.error('Failed to start recording: ' + err.message);
      this._cleanup();
    }
  }

  /**
   * Start the recording with given settings
   * @param {Object} settings - Recording settings from dialog
   * @private
   */
  async _startRecording(settings) {
    const { resolution, cursor, cameraDeviceId, micDeviceId } = settings;

    // 1. Get tab capture stream
    this._tabStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: cursor ? 'always' : 'never',
        width: { ideal: resolution.width },
        height: { ideal: resolution.height }
      },
      audio: true, // Capture tab audio if available
      preferCurrentTab: true
    });

    // Listen for user stopping share via browser UI
    this._tabStream.getVideoTracks()[0].addEventListener('ended', () => {
      if (this.isRecording) this.stop();
    });

    // 2. Get camera stream (if enabled)
    if (cameraDeviceId) {
      try {
        this._cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: cameraDeviceId }, width: 320, height: 240 }
        });
      } catch (e) {
        console.warn('Camera capture failed, continuing without camera:', e);
      }
    }

    // 3. Get mic stream (if enabled)
    if (micDeviceId) {
      try {
        this._micStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: micDeviceId } }
        });
      } catch (e) {
        console.warn('Mic capture failed, continuing without mic:', e);
      }
    }

    // 4. Create compositing canvas
    this._canvas = document.createElement('canvas');
    this._canvas.width = resolution.width;
    this._canvas.height = resolution.height;
    this._ctx = this._canvas.getContext('2d');

    // 5. Create hidden video elements for streams
    this._tabVideo = document.createElement('video');
    this._tabVideo.srcObject = this._tabStream;
    this._tabVideo.muted = true;
    this._tabVideo.play();

    if (this._cameraStream) {
      this._camVideo = document.createElement('video');
      this._camVideo.srcObject = this._cameraStream;
      this._camVideo.muted = true;
      this._camVideo.play();
    }

    // 6. Set default PiP position (bottom-right)
    this._pipPos = {
      x: resolution.width - PIP_DIAMETER / 2 - PIP_MARGIN,
      y: resolution.height - PIP_DIAMETER / 2 - PIP_MARGIN
    };

    // 7. Setup PiP drag if camera is enabled
    if (this._cameraStream) {
      this._setupPipDrag();
    }

    // 8. Start compositing loop
    this._startCompositing();

    // 9. Mix audio tracks
    const canvasStream = this._canvas.captureStream(30);
    const audioTracks = this._mixAudioTracks();
    audioTracks.forEach(track => canvasStream.addTrack(track));

    // 10. Start MediaRecorder
    this._sessionId = 'rec_' + Date.now();
    this._chunkIndex = 0;

    this._mediaRecorder = new MediaRecorder(canvasStream, {
      mimeType: this._getSupportedMimeType(),
      videoBitsPerSecond: 5000000 // 5 Mbps
    });

    this._mediaRecorder.ondataavailable = async (event) => {
      if (event.data && event.data.size > 0) {
        try {
          await window.RecordingDB.saveChunk(this._sessionId, this._chunkIndex++, event.data);
        } catch (e) {
          console.error('Failed to save chunk:', e);
        }
      }
    };

    this._mediaRecorder.onstop = () => {
      // Handled in stop()
    };

    this._mediaRecorder.start(CHUNK_INTERVAL_MS);
    this.isRecording = true;

    // 11. Update toolbar button to STOP state
    this._updateRecordButton(true);

    // 12. Auto-start fullscreen playback
    if (this.editor.playbackController) {
      this.editor.playbackController.start(0);
    }

    toast.success('Recording started');
  }

  /**
   * Get a supported MIME type for MediaRecorder
   * @returns {string} Supported MIME type
   * @private
   */
  _getSupportedMimeType() {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'video/webm';
  }

  /**
   * Mix all audio tracks (tab audio + mic) into a single set of tracks
   * @returns {MediaStreamTrack[]} Mixed audio tracks
   * @private
   */
  _mixAudioTracks() {
    const audioCtx = new AudioContext();
    const destination = audioCtx.createMediaStreamDestination();

    // Tab audio
    const tabAudioTracks = this._tabStream.getAudioTracks();
    if (tabAudioTracks.length > 0) {
      const tabAudioStream = new MediaStream(tabAudioTracks);
      const tabSource = audioCtx.createMediaStreamSource(tabAudioStream);
      tabSource.connect(destination);
    }

    // Mic audio
    if (this._micStream) {
      const micSource = audioCtx.createMediaStreamSource(this._micStream);
      micSource.connect(destination);
    }

    this._mixAudioCtx = audioCtx;
    return destination.stream.getAudioTracks();
  }

  /**
   * Start the canvas compositing loop
   * @private
   */
  _startCompositing() {
    const draw = () => {
      if (!this.isRecording) return;

      const ctx = this._ctx;
      const w = this._canvas.width;
      const h = this._canvas.height;

      // Draw tab capture
      if (this._tabVideo && this._tabVideo.readyState >= 2) {
        ctx.drawImage(this._tabVideo, 0, 0, w, h);
      }

      // Draw camera PiP circle
      if (this._camVideo && this._camVideo.readyState >= 2) {
        const r = PIP_DIAMETER / 2;
        const cx = this._pipPos.x;
        const cy = this._pipPos.y;

        ctx.save();

        // Draw white border circle
        ctx.beginPath();
        ctx.arc(cx, cy, r + PIP_BORDER, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();

        // Drop shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(cx, cy, r + PIP_BORDER, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Clip to circle and draw camera
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();

        // Draw camera video scaled to fill circle
        const vw = this._camVideo.videoWidth;
        const vh = this._camVideo.videoHeight;
        const scale = Math.max(PIP_DIAMETER / vw, PIP_DIAMETER / vh);
        const sw = vw * scale;
        const sh = vh * scale;
        ctx.drawImage(this._camVideo, cx - sw / 2, cy - sh / 2, sw, sh);

        ctx.restore();
      }

      this._rafId = requestAnimationFrame(draw);
    };

    this._rafId = requestAnimationFrame(draw);
  }

  /**
   * Setup PiP circle drag interaction
   * PiP is draggable on the fullscreen presentation view during recording.
   * @private
   */
  _setupPipDrag() {
    const presentationView = document.getElementById('presentation-view');
    if (!presentationView) return;

    const _toCanvasCoords = (clientX, clientY) => {
      // Map screen coordinates to canvas coordinates
      const rect = presentationView.getBoundingClientRect();
      const scaleX = this._canvas.width / rect.width;
      const scaleY = this._canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const _isInsidePip = (canvasX, canvasY) => {
      const dx = canvasX - this._pipPos.x;
      const dy = canvasY - this._pipPos.y;
      return (dx * dx + dy * dy) <= (PIP_DIAMETER / 2 + PIP_BORDER) ** 2;
    };

    this._pipMouseDown = (e) => {
      if (!this.isRecording || !this._cameraStream) return;
      const pos = _toCanvasCoords(e.clientX, e.clientY);
      if (_isInsidePip(pos.x, pos.y)) {
        this._pipDragging = true;
        this._pipDragOffset = {
          x: pos.x - this._pipPos.x,
          y: pos.y - this._pipPos.y
        };
        e.preventDefault();
        e.stopPropagation();
      }
    };

    this._pipMouseMove = (e) => {
      if (!this._pipDragging) return;
      const pos = _toCanvasCoords(e.clientX, e.clientY);
      const r = PIP_DIAMETER / 2 + PIP_BORDER;
      this._pipPos = {
        x: Math.max(r, Math.min(this._canvas.width - r, pos.x - this._pipDragOffset.x)),
        y: Math.max(r, Math.min(this._canvas.height - r, pos.y - this._pipDragOffset.y))
      };
      e.preventDefault();
      e.stopPropagation();
    };

    this._pipMouseUp = (e) => {
      if (this._pipDragging) {
        this._pipDragging = false;
        e.preventDefault();
        e.stopPropagation();
      }
    };

    presentationView.addEventListener('mousedown', this._pipMouseDown, true);
    document.addEventListener('mousemove', this._pipMouseMove, true);
    document.addEventListener('mouseup', this._pipMouseUp, true);
  }

  /**
   * Remove PiP drag listeners
   * @private
   */
  _removePipDrag() {
    const presentationView = document.getElementById('presentation-view');
    if (presentationView && this._pipMouseDown) {
      presentationView.removeEventListener('mousedown', this._pipMouseDown, true);
    }
    if (this._pipMouseMove) {
      document.removeEventListener('mousemove', this._pipMouseMove, true);
    }
    if (this._pipMouseUp) {
      document.removeEventListener('mouseup', this._pipMouseUp, true);
    }
    this._pipMouseDown = null;
    this._pipMouseMove = null;
    this._pipMouseUp = null;
  }

  /**
   * Stop recording and build final video
   */
  async stop() {
    if (!this.isRecording) return;

    this.isRecording = false;

    // Stop MediaRecorder (triggers final ondataavailable)
    if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
      this._mediaRecorder.stop();
    }

    // Wait for the final chunk to be saved
    await new Promise(resolve => setTimeout(resolve, 500));

    // Stop playback
    if (this.editor.playbackController && this.editor.playbackController.isPlaying) {
      this.editor.playbackController.stop();
    }

    // Show processing modal
    const overlay = this._showProcessingModal();

    try {
      // Assemble chunks from IndexedDB
      const chunks = await window.RecordingDB.getChunks(this._sessionId);
      if (chunks.length === 0) {
        toast.warning('No recording data found');
        return;
      }

      const blobs = chunks.map(c => c.blob);
      const finalBlob = new Blob(blobs, { type: this._getSupportedMimeType() });

      // Download file
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.editor.presentation.title || 'presentation'}_${new Date().toISOString().slice(0, 10)}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Clean up chunks from IndexedDB
      await window.RecordingDB.deleteSession(this._sessionId);

      toast.success('Recording saved!');
    } catch (err) {
      console.error('Failed to build recording:', err);
      toast.error('Failed to build recording');
    } finally {
      // Remove processing modal
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }

      // Full cleanup
      this._cleanup();

      // Update toolbar button back to record state
      this._updateRecordButton(false);
    }
  }

  /**
   * Show a blocking modal while the video is being assembled
   * @returns {HTMLElement} The overlay element
   * @private
   */
  _showProcessingModal() {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box recording-processing-modal">
        <div class="dialog-header">Building Video</div>
        <div class="dialog-body" style="text-align: center; padding: 24px;">
          <div class="preloader-wrapper active" style="margin: 0 auto 16px;">
            <div class="spinner-layer spinner-blue-only">
              <div class="circle-clipper left"><div class="circle"></div></div>
              <div class="gap-patch"><div class="circle"></div></div>
              <div class="circle-clipper right"><div class="circle"></div></div>
            </div>
          </div>
          <p>Assembling your recording...<br>Please wait.</p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  /**
   * Clean up all streams, canvas, and state
   * @private
   */
  _cleanup() {
    // Stop compositing loop
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    // Stop streams
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

    // Close audio context
    if (this._mixAudioCtx) {
      this._mixAudioCtx.close().catch(() => {});
      this._mixAudioCtx = null;
    }

    // Remove PiP drag listeners
    this._removePipDrag();

    // Clear references
    this._tabVideo = null;
    this._camVideo = null;
    this._canvas = null;
    this._ctx = null;
    this._mediaRecorder = null;
    this._sessionId = null;
    this._settings = null;
  }

  /**
   * Update the record button appearance
   * @param {boolean} recording - Whether currently recording
   * @private
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
}

export default RecordingController;
```

**Step 2: Add export to `js/controllers/index.js`**

After line 11 (the SettingsController export), add:

```javascript
export { RecordingController } from './RecordingController.js';
```

**Step 3: Commit**

```bash
git add js/controllers/RecordingController.js js/controllers/index.js
git commit -m "feat: Add RecordingController with canvas compositing and PiP drag"
```

---

### Task 4: CSS — recording styles

**Files:**
- Create: `css/recording.css`
- Modify: `index.html:38` (add link tag)

**Step 1: Create `css/recording.css`**

```css
/**
 * WOW3 Recording Feature Styles
 * Record button states, settings dialog, PiP overlay, processing modal
 */

/* ==================== RECORD BUTTON ==================== */

#record-btn i {
  color: rgba(255, 255, 255, 0.9);
}

#record-btn.recording-active {
  position: relative;
}

#record-btn.recording-active i {
  color: #f44336;
  animation: recording-pulse 1.5s ease-in-out infinite;
}

@keyframes recording-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ==================== RECORDING SETTINGS DIALOG ==================== */

.dialog-box.dialog-recording {
  max-width: 480px;
}

.recording-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.recording-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.recording-field > label {
  font-size: 14px;
  font-weight: 500;
  color: #424242;
}

.recording-field select {
  height: 36px;
  padding: 0 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
}

.recording-field select:focus {
  border-color: #2196F3;
}

.recording-divider {
  border: none;
  border-top: 1px solid #e0e0e0;
  margin: 4px 0;
}

/* Camera preview */
.recording-preview-container {
  margin-top: 8px;
}

.recording-camera-preview {
  width: 160px;
  height: 120px;
  border-radius: 8px;
  background: #000;
  object-fit: cover;
}

/* Mic level meter */
.recording-mic-level {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.recording-mic-level-bar {
  height: 100%;
  width: 0;
  background: linear-gradient(90deg, #4caf50, #8bc34a, #ffeb3b, #f44336);
  border-radius: 4px;
  transition: width 0.05s linear;
}

/* ==================== PROCESSING MODAL ==================== */

.recording-processing-modal {
  max-width: 360px;
  text-align: center;
}

.recording-processing-modal .dialog-body p {
  color: #666;
  font-size: 14px;
  line-height: 1.6;
}
```

**Step 2: Add CSS link to `index.html`**

After line 38 (`css/settings.css`), add:

```html
<link rel="stylesheet" href="css/recording.css">
```

**Step 3: Commit**

```bash
git add css/recording.css index.html
git commit -m "feat: Add recording feature CSS styles"
```

---

### Task 5: Toolbar button + wiring

**Files:**
- Modify: `index.html:69-71` (add record button)
- Modify: `js/app.js:58` (instantiate RecordingController)

**Step 1: Add record button to toolbar in `index.html`**

After the divider-vertical (line 69) and before the play-from-slide button (line 70), add:

```html
<li><a href="#" id="record-btn" title="Record Presentation"><i class="material-icons">fiber_manual_record</i></a></li>
```

The toolbar-right section should look like:

```html
<ul id="toolbar-right" class="toolbar-group toolbar-right">
  <li><a href="#" id="import-btn" title="Import Presentation"><i class="material-icons">download</i></a></li>
  <li><a href="#" id="export-btn" title="Export Presentation"><i class="material-icons">backup</i></a></li>
  <li class="divider-vertical"></li>
  <li><a href="#" id="record-btn" title="Record Presentation"><i class="material-icons">fiber_manual_record</i></a></li>
  <li><a href="#" id="play-from-slide-btn" title="Play from this slide"><i class="material-icons">slideshow</i></a></li>
  <li><a href="#" id="play-btn" title="Play Presentation"><i class="material-icons">play_arrow</i></a></li>
</ul>
```

**Step 2: Wire up RecordingController in `js/app.js`**

In the import at the top (line 13-15 area), add `RecordingController` to the imports:

```javascript
import {
  EditorController,
  SlideController,
  ElementController,
  AnimationEditorController,
  PlaybackController,
  SettingsController,
  RecordingController
} from './controllers/index.js';
```

After initializing playbackController (around line 58), add:

```javascript
this.editor.recordingController = new RecordingController(this.editor);
```

After `this.editor.playbackController.init()` (around line 66), add:

```javascript
await this.editor.recordingController.init();
```

**Step 3: Commit**

```bash
git add index.html js/app.js
git commit -m "feat: Add Record button to toolbar and wire up RecordingController"
```

---

### Task 6: PlaybackController integration — prevent fullscreen exit from stopping recording

**Files:**
- Modify: `js/controllers/PlaybackController.js:170-177`

**Step 1: Modify fullscreen exit handler**

When recording is active and the user clicks STOP, the RecordingController calls `playbackController.stop()` which exits fullscreen. But we also need to make sure the fullscreen exit handler in PlaybackController doesn't double-stop.

In `PlaybackController.setupNavigation()`, update the fullscreenChangeHandler (around line 170-177):

Replace:
```javascript
const fullscreenChangeHandler = () => {
  if (!document.fullscreenElement && this.isPlaying) {
    this.stop();
  }
};
```

With:
```javascript
const fullscreenChangeHandler = () => {
  if (!document.fullscreenElement && this.isPlaying) {
    // If recording is active, stop recording first (which will stop playback)
    const recorder = this.editor.recordingController;
    if (recorder && recorder.isRecording) {
      recorder.stop();
    } else {
      this.stop();
    }
  }
};
```

**Step 2: Commit**

```bash
git add js/controllers/PlaybackController.js
git commit -m "feat: Integrate PlaybackController with RecordingController for fullscreen exit"
```

---

### Task 7: Update CHANGES.md

**Files:**
- Modify: `CHANGES.md` (create if not exists)

**Step 1: Add recording feature entry**

Add entry documenting the new recording feature and all files created/modified.

**Step 2: Commit all and verify**

```bash
git add CHANGES.md
git commit -m "docs: Add recording feature to CHANGES.md"
```

---

## Summary of all files

| Action | File |
|--------|------|
| Create | `js/utils/recording_db.js` |
| Create | `js/components/RecordingDialog.js` |
| Create | `js/controllers/RecordingController.js` |
| Create | `css/recording.css` |
| Modify | `index.html` (CSS link, script tag, record button) |
| Modify | `js/controllers/index.js` (export) |
| Modify | `js/app.js` (import + instantiate) |
| Modify | `js/controllers/PlaybackController.js` (fullscreen handler) |
| Modify | `CHANGES.md` |

## Execution notes

- No tests exist in this project (vanilla JS, no test framework) — manual browser testing required.
- The recording feature requires HTTPS or localhost (for `getDisplayMedia` and `getUserMedia`).
- `getDisplayMedia` with `preferCurrentTab: true` hints the browser to auto-select the current tab.
