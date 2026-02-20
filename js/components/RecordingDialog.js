/**
 * RecordingDialog — Settings dialog for screen recording.
 *
 * Shows a dialog with resolution, cursor, camera, and microphone options.
 * Camera selection shows a live video preview; microphone selection shows
 * a live audio level meter via AnalyserNode.
 *
 * Uses the global Dialog.show() system with resolveInput to collect form values.
 *
 * Usage:
 *   const dialog = new RecordingDialog();
 *   const settings = await dialog.show();
 *   // settings: { resolution: { width, height }, cursor: boolean, cameraDeviceId: string|null, micDeviceId: string|null }
 *   // or null if cancelled
 */

// ─── Constants ───────────────────────────────────────────

const RESOLUTIONS = [
  { label: '720p (1280x720)',   value: '1280x720',  width: 1280, height: 720  },
  { label: '1080p (1920x1080)', value: '1920x1080', width: 1920, height: 1080 },
  { label: '1440p (2560x1440)', value: '2560x1440', width: 2560, height: 1440 },
];

const DEFAULT_RESOLUTION = '1920x1080';

const CAMERA_PREVIEW_WIDTH = 160;
const CAMERA_PREVIEW_HEIGHT = 120;

const LEVEL_METER_FFT_SIZE = 256;

// ─── RecordingDialog Class ───────────────────────────────

export class RecordingDialog {

  constructor() {
    /** @type {MediaStream|null} Active camera preview stream */
    this._cameraStream = null;
    /** @type {MediaStream|null} Active mic preview stream */
    this._micStream = null;
    /** @type {AudioContext|null} AudioContext for level meter */
    this._audioCtx = null;
    /** @type {AnalyserNode|null} AnalyserNode for level meter */
    this._analyser = null;
    /** @type {number|null} requestAnimationFrame ID for level meter */
    this._meterRafId = null;
    /** @type {boolean} Whether the dialog is still open */
    this._alive = false;
  }

  // ─── Public API ──────────────────────────────────────────

  /**
   * Show the recording settings dialog and return the user's choices.
   * @returns {Promise<Object|null>} Resolved settings object, or null if cancelled.
   *   - resolution: { width: number, height: number }
   *   - cursor: boolean
   *   - cameraDeviceId: string|null
   *   - micDeviceId: string|null
   */
  show = async () => {
    // Request temporary getUserMedia to unlock device labels
    const devices = await this._getDevicesWithLabels();

    const cameras = devices.filter(d => d.kind === 'videoinput');
    const mics = devices.filter(d => d.kind === 'audioinput');

    const body = this._buildBody(cameras, mics);

    this._alive = true;

    const result = await Dialog.show({
      title: 'Recording Settings',
      body,
      boxClass: 'dialog-recording',
      buttons: [
        { text: 'Cancel', type: 'secondary', value: null },
        { text: 'Start Recording', type: 'danger', resolveInput: true },
      ],
      onRender: (box) => this._onRender(box, cameras, mics),
    });

    // Cleanup all streams/contexts regardless of outcome
    this._cleanup();

    // User clicked Cancel
    if (result === null) return null;

    // resolveInput returns the collected inputs object
    // When resolveInput has a value, result is { value, input }
    // When resolveInput has no value, result is the inputs object directly
    const inputs = result.input !== undefined ? result.input : result;

    // If we got the Cancel button's null value instead
    if (!inputs || typeof inputs !== 'object') return null;

    return this._parseResult(inputs);
  };

  // ─── Private: Device Enumeration ─────────────────────────

  /**
   * Request a temporary getUserMedia stream to unlock device labels,
   * enumerate devices, then release the stream.
   * @returns {Promise<MediaDeviceInfo[]>}
   */
  _getDevicesWithLabels = async () => {
    // mediaDevices API requires HTTPS or localhost
    if (!navigator.mediaDevices) {
      console.warn('navigator.mediaDevices not available (requires HTTPS or localhost)');
      return [];
    }

    let tempStream = null;
    try {
      tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch (e) {
      // If both fail, try audio only, then video only
      try {
        tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e2) {
        try {
          tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (e3) {
          // No permissions at all — fall through with empty labels
        }
      }
    }

    const devices = await navigator.mediaDevices.enumerateDevices();

    // Release temporary stream
    if (tempStream) {
      tempStream.getTracks().forEach(t => t.stop());
    }

    return devices;
  };

  // ─── Private: HTML Building ──────────────────────────────

  /**
   * Build the dialog body HTML.
   * @param {MediaDeviceInfo[]} cameras
   * @param {MediaDeviceInfo[]} mics
   * @returns {string}
   */
  _buildBody = (cameras, mics) => {
    const resolutionOptions = RESOLUTIONS.map(r => {
      const selected = r.value === DEFAULT_RESOLUTION ? 'selected' : '';
      return `<option value="${r.value}" ${selected}>${r.label}</option>`;
    }).join('');

    const cameraOptions = ['<option value="OFF">OFF</option>']
      .concat(cameras.map((c, i) => {
        const label = c.label || `Camera ${i + 1}`;
        return `<option value="${c.deviceId}">${label}</option>`;
      }))
      .join('');

    const micOptions = ['<option value="OFF">OFF</option>']
      .concat(mics.map((m, i) => {
        const label = m.label || `Microphone ${i + 1}`;
        return `<option value="${m.deviceId}">${label}</option>`;
      }))
      .join('');

    return `
      <div class="recording-settings">
        <div class="recording-field">
          <label for="recording-resolution">Resolution</label>
          <select id="recording-resolution" name="recording-resolution" class="browser-default">
            ${resolutionOptions}
          </select>
        </div>

        <div class="recording-field">
          <label for="recording-cursor">
            <input type="checkbox" id="recording-cursor" name="recording-cursor" checked />
            <span>Show cursor</span>
          </label>
        </div>

        <div class="recording-field">
          <label for="recording-persist">
            <input type="checkbox" id="recording-persist" name="recording-persist" checked />
            <span>Save to IndexedDB (crash resilience)</span>
          </label>
        </div>

        <div class="recording-divider"></div>

        <div class="recording-field">
          <label for="recording-camera">Camera</label>
          <select id="recording-camera" name="recording-camera" class="browser-default">
            ${cameraOptions}
          </select>
          <div class="recording-preview-container" id="recording-camera-container" style="display:none;">
            <video id="recording-camera-preview" class="recording-camera-preview"
                   width="${CAMERA_PREVIEW_WIDTH}" height="${CAMERA_PREVIEW_HEIGHT}"
                   autoplay muted playsinline></video>
          </div>
        </div>

        <div class="recording-field">
          <label for="recording-mic">Microphone</label>
          <select id="recording-mic" name="recording-mic" class="browser-default">
            ${micOptions}
          </select>
          <div class="recording-preview-container" id="recording-mic-container" style="display:none;">
            <div class="recording-mic-level">
              <div class="recording-mic-level-bar" id="recording-mic-level-bar"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  // ─── Private: Dialog Lifecycle ───────────────────────────

  /**
   * Called after the dialog DOM is inserted. Sets up event listeners
   * for camera/mic selection changes.
   * @param {HTMLElement} box - The dialog box element
   * @param {MediaDeviceInfo[]} cameras
   * @param {MediaDeviceInfo[]} mics
   */
  _onRender = (box, cameras, mics) => {
    const cameraSelect = box.querySelector('#recording-camera');
    const micSelect = box.querySelector('#recording-mic');

    if (cameraSelect) {
      cameraSelect.addEventListener('change', () => {
        this._handleCameraChange(box, cameraSelect.value);
      });
    }

    if (micSelect) {
      micSelect.addEventListener('change', () => {
        this._handleMicChange(box, micSelect.value);
      });
    }
  };

  /**
   * Handle camera device selection change.
   * Starts or stops the camera preview stream.
   * @param {HTMLElement} box - The dialog box element
   * @param {string} deviceId - Selected device ID or 'OFF'
   */
  _handleCameraChange = async (box, deviceId) => {
    const container = box.querySelector('#recording-camera-container');
    const videoEl = box.querySelector('#recording-camera-preview');

    // Stop any existing camera stream
    this._stopCameraPreview();

    if (deviceId === 'OFF' || !deviceId) {
      if (container) container.style.display = 'none';
      return;
    }

    try {
      this._cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }
      });

      if (!this._alive) {
        this._cameraStream.getTracks().forEach(t => t.stop());
        this._cameraStream = null;
        return;
      }

      if (videoEl) {
        videoEl.srcObject = this._cameraStream;
      }
      if (container) {
        container.style.display = 'block';
      }
    } catch (err) {
      console.warn('RecordingDialog: failed to start camera preview', err);
      if (container) container.style.display = 'none';
    }
  };

  /**
   * Handle microphone device selection change.
   * Starts or stops the mic level meter.
   * @param {HTMLElement} box - The dialog box element
   * @param {string} deviceId - Selected device ID or 'OFF'
   */
  _handleMicChange = async (box, deviceId) => {
    const container = box.querySelector('#recording-mic-container');
    const levelBar = box.querySelector('#recording-mic-level-bar');

    // Stop any existing mic stream and meter
    this._stopMicPreview();

    if (deviceId === 'OFF' || !deviceId) {
      if (container) container.style.display = 'none';
      return;
    }

    try {
      this._micStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } }
      });

      if (!this._alive) {
        this._micStream.getTracks().forEach(t => t.stop());
        this._micStream = null;
        return;
      }

      // Set up AudioContext + AnalyserNode
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = this._audioCtx.createMediaStreamSource(this._micStream);
      this._analyser = this._audioCtx.createAnalyser();
      this._analyser.fftSize = LEVEL_METER_FFT_SIZE;
      source.connect(this._analyser);

      if (container) container.style.display = 'block';

      // Start the level meter animation loop
      this._startLevelMeter(levelBar);
    } catch (err) {
      console.warn('RecordingDialog: failed to start mic preview', err);
      if (container) container.style.display = 'none';
    }
  };

  // ─── Private: Level Meter ────────────────────────────────

  /**
   * Start the requestAnimationFrame loop that reads frequency data
   * from the AnalyserNode and updates the level bar width.
   * @param {HTMLElement|null} levelBar - The level bar DOM element
   */
  _startLevelMeter = (levelBar) => {
    if (!levelBar || !this._analyser) return;

    const dataArray = new Uint8Array(this._analyser.frequencyBinCount);

    const draw = () => {
      if (!this._alive || !this._analyser) return;

      this._meterRafId = requestAnimationFrame(draw);

      this._analyser.getByteFrequencyData(dataArray);

      // Compute average level (0-255) then normalize to percentage
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const percent = Math.min(100, (average / 255) * 100);

      levelBar.style.width = `${percent}%`;
    };

    draw();
  };

  // ─── Private: Stream Cleanup ─────────────────────────────

  /** Stop the camera preview stream and clear the video element. */
  _stopCameraPreview = () => {
    if (this._cameraStream) {
      this._cameraStream.getTracks().forEach(t => t.stop());
      this._cameraStream = null;
    }
  };

  /** Stop the mic preview stream, the level meter, and close the AudioContext. */
  _stopMicPreview = () => {
    if (this._meterRafId !== null) {
      cancelAnimationFrame(this._meterRafId);
      this._meterRafId = null;
    }

    if (this._audioCtx) {
      this._audioCtx.close().catch(() => {});
      this._audioCtx = null;
      this._analyser = null;
    }

    if (this._micStream) {
      this._micStream.getTracks().forEach(t => t.stop());
      this._micStream = null;
    }
  };

  /** Full cleanup — stop all previews and mark dialog as dead. */
  _cleanup = () => {
    this._alive = false;
    this._stopCameraPreview();
    this._stopMicPreview();
  };

  // ─── Private: Result Parsing ─────────────────────────────

  /**
   * Parse the raw input values collected by Dialog into the public API shape.
   * @param {Object} inputs - Raw form values keyed by id/name
   * @returns {Object} Parsed settings
   */
  _parseResult = (inputs) => {
    // Parse resolution
    const resValue = inputs['recording-resolution'] || DEFAULT_RESOLUTION;
    const resDef = RESOLUTIONS.find(r => r.value === resValue) || RESOLUTIONS[1];

    // Parse cursor checkbox
    const cursor = inputs['recording-cursor'] === true || inputs['recording-cursor'] === 'true';

    // Parse persist checkbox
    const persist = inputs['recording-persist'] === true || inputs['recording-persist'] === 'true';

    // Parse camera
    const cameraRaw = inputs['recording-camera'] || 'OFF';
    const cameraDeviceId = cameraRaw === 'OFF' ? null : cameraRaw;

    // Parse microphone
    const micRaw = inputs['recording-mic'] || 'OFF';
    const micDeviceId = micRaw === 'OFF' ? null : micRaw;

    return {
      resolution: { width: resDef.width, height: resDef.height },
      cursor,
      persist,
      cameraDeviceId,
      micDeviceId,
    };
  };
}

// Global helper for easy access
window.RecordingDialog = RecordingDialog;
