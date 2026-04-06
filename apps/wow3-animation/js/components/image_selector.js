/**
 * ImageSelector — Reusable media source selector component.
 *
 * Renders a URL input + library button + upload area with drag & drop.
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
 */
import { toast } from '@wow/core/utils/toasts.js';

class ImageSelector {

  /**
   * @param {string} containerId - ID of the DOM element to render into
   * @param {Object} [options]
   * @param {string} [options.label='Image Source'] - Label text
   * @param {string} [options.accept='image/*'] - File accept attribute
   * @param {string} [options.mediaType='image'] - Media type name
   * @param {string} [options.placeholder='Enter URL or media ID']
   * @param {string} [options.value=''] - Initial URL value
   * @param {Function} [options.onMediaChange] - Called with the new value
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

  /** @returns {string} */
  getValue() { return this._value; }

  /** @param {string} url */
  setValue(url) {
    this._value = url || '';
    if (this._urlInput) this._urlInput.value = this._value;
  }

  /** @private */
  _render() {
    const p = this._mediaType;

    this._container.innerHTML = `
      <div class="control-group">
        <label>${this._label}</label>
        <div class="media-input-group">
          <input type="text" id="${p}-selector-url" class="panel-input"
                 value="${this._value}" placeholder="${this._placeholder}">
          <button id="${p}-selector-library" class="btn-icon" title="Select from Media Library">
            <i class="material-icons">photo_library</i>
          </button>
        </div>
      </div>

      <div class="control-group">
        <label>Upload ${p.charAt(0).toUpperCase() + p.slice(1)}</label>
        <div class="upload-area" id="${p}-selector-upload-area">
          <input type="file" id="${p}-selector-file-input" accept="${this._accept}" style="display: none;">
          <button id="${p}-selector-btn-upload" class="btn-upload">
            <i class="material-icons">cloud_upload</i>
            <span>Choose File or Drag & Drop</span>
          </button>
        </div>
      </div>
    `;

    this._urlInput = document.getElementById(`${p}-selector-url`);
    this._btnLibrary = document.getElementById(`${p}-selector-library`);
    this._uploadArea = document.getElementById(`${p}-selector-upload-area`);
    this._fileInput = document.getElementById(`${p}-selector-file-input`);
    this._btnUpload = document.getElementById(`${p}-selector-btn-upload`);
  }

  /** @private */
  _bind() {
    const typeName = this._mediaType.charAt(0).toUpperCase() + this._mediaType.slice(1);
    const mimePrefix = this._accept.replace('/*', '/');

    if (this._urlInput) {
      this._urlInput.addEventListener('change', (e) => {
        this._value = e.target.value;
        this._onMediaChange(this._value);
      });
    }

    if (this._btnLibrary) {
      this._btnLibrary.addEventListener('click', () => {
        if (typeof MediaManager === 'undefined') return;
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
