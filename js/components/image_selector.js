/**
 * ImageSelector — Reusable media source selector component.
 *
 * Renders a URL input + library button + upload area with drag & drop.
 * Extracts the duplicated pattern from ImagePanel, VideoPanel, AudioPanel.
 *
 * Usage:
 *   const selector = new ImageSelector('my-container', {
 *     label: 'Image Source',
 *     accept: 'image/*',
 *     mediaType: 'image',
 *     placeholder: 'Enter URL or media ID',
 *     value: '',
 *     onMediaChange: (value) => { ... }
 *   });
 *
 *   selector.getValue();          // current URL string
 *   selector.setValue('media_1'); // update display
 */
import { toast } from '../utils/toasts.js';

class ImageSelector {

  /**
   * @param {string} containerId - ID of the DOM element to render into
   * @param {Object} [options]
   * @param {string} [options.label='Image Source'] - Label text for the URL input
   * @param {string} [options.accept='image/*'] - File accept attribute
   * @param {string} [options.mediaType='image'] - Media type name for toast messages
   * @param {string} [options.placeholder='Enter URL or media ID'] - Input placeholder
   * @param {string} [options.value=''] - Initial URL value
   * @param {Function} [options.onMediaChange] - Called with the new value (string or File)
   */
  constructor(containerId, options = {}) {
    this._containerId = containerId;
    this._container = document.getElementById(containerId);
    if (!this._container) return;

    this._label = options.label || 'Image Source';
    this._accept = options.accept || 'image/*';
    this._mediaType = options.mediaType || 'image';
    this._placeholder = options.placeholder || 'Enter URL or media ID';
    this._value = options.value || '';
    this._onMediaChange = options.onMediaChange || (() => {});

    this._render();
    this._bind();
  }

  // ─── Public API ───────────────────────────────────────────

  /**
   * Get the current URL value.
   * @returns {string}
   */
  getValue() {
    return this._value;
  }

  /**
   * Set the URL value and update the input display.
   * @param {string} url
   */
  setValue(url) {
    this._value = url || '';
    if (this._urlInput) this._urlInput.value = this._value;
  }

  // ─── Rendering ────────────────────────────────────────────

  /** Build the DOM inside the container. */
  _render() {
    const typePrefix = this._mediaType;

    this._container.innerHTML = `
      <div class="control-group">
        <label>${this._label}</label>
        <div class="media-input-group">
          <input type="text" id="${typePrefix}-selector-url" class="panel-input"
                 value="${this._value}" placeholder="${this._placeholder}">
          <button id="${typePrefix}-selector-library" class="btn-icon" title="Select from Media Library">
            <i class="material-icons">photo_library</i>
          </button>
        </div>
      </div>

      <div class="control-group">
        <label>Upload ${this._mediaType.charAt(0).toUpperCase() + this._mediaType.slice(1)}</label>
        <div class="upload-area" id="${typePrefix}-selector-upload-area">
          <input type="file" id="${typePrefix}-selector-file-input" accept="${this._accept}" style="display: none;">
          <button id="${typePrefix}-selector-btn-upload" class="btn-upload">
            <i class="material-icons">cloud_upload</i>
            <span>Choose File or Drag & Drop</span>
          </button>
        </div>
      </div>
    `;

    const p = typePrefix;
    this._urlInput = document.getElementById(`${p}-selector-url`);
    this._btnLibrary = document.getElementById(`${p}-selector-library`);
    this._uploadArea = document.getElementById(`${p}-selector-upload-area`);
    this._fileInput = document.getElementById(`${p}-selector-file-input`);
    this._btnUpload = document.getElementById(`${p}-selector-btn-upload`);
  }

  /** Attach all event listeners. */
  _bind() {
    const typeName = this._mediaType.charAt(0).toUpperCase() + this._mediaType.slice(1);
    const mimePrefix = this._accept.replace('/*', '/');

    // URL input change
    if (this._urlInput) {
      this._urlInput.addEventListener('change', (e) => {
        this._value = e.target.value;
        this._onMediaChange(this._value);
      });
    }

    // Select from library button
    if (this._btnLibrary) {
      this._btnLibrary.addEventListener('click', () => {
        MediaManager.open(async (data) => {
          const mediaId = data.localUrl ? data.localUrl.replace('local://', '') : data.originalItem?.id;
          if (mediaId) {
            this._value = mediaId;
            if (this._urlInput) this._urlInput.value = mediaId;
            this._onMediaChange(mediaId);
          }
        });
      });
    }

    // File upload button
    if (this._btnUpload && this._fileInput) {
      this._btnUpload.addEventListener('click', () => this._fileInput.click());

      this._fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        toast.info(`Uploading ${this._mediaType}...`);
        try {
          this._onMediaChange(file);
          toast.success(`${typeName} uploaded successfully!`);
        } catch (error) {
          console.error('Upload failed:', error);
          toast.error(`Failed to upload ${this._mediaType}`);
        }
      });
    }

    // Drag & drop
    if (this._uploadArea) {
      this._uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        this._uploadArea.classList.add('drag-over');
      });

      this._uploadArea.addEventListener('dragleave', () => {
        this._uploadArea.classList.remove('drag-over');
      });

      this._uploadArea.addEventListener('drop', async (e) => {
        e.preventDefault();
        this._uploadArea.classList.remove('drag-over');

        const file = e.dataTransfer.files[0];
        if (!file || !file.type.startsWith(mimePrefix)) return;
        toast.info(`Uploading ${this._mediaType}...`);
        try {
          this._onMediaChange(file);
          toast.success(`${typeName} uploaded successfully!`);
        } catch (error) {
          console.error('Upload failed:', error);
          toast.error(`Failed to upload ${this._mediaType}`);
        }
      });
    }
  }
}

window.ImageSelector = ImageSelector;
