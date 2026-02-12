/**
 * WOW3 Audio Element
 * Audio element with playback controls
 * Uses IndexedDB for binary storage via MediaDB
 */

import { Element } from './Element.js';
import { ElementType } from '../utils/constants.js';

export class AudioElement extends Element {
  /**
   * Create an audio element
   * @param {Object} properties - Element properties
   */
  constructor(properties = {}) {
    super(ElementType.AUDIO, properties);

    // Audio-specific properties
    // Note: url can be either a media ID (media_xxx) or external URL
    this.properties.url = properties.properties?.url || '';
    this.properties.autoplay = properties.properties?.autoplay || false;
    this.properties.loop = properties.properties?.loop || false;
    this.properties.controls = properties.properties?.controls !== false;
  }

  /**
   * Render audio element to DOM
   * @param {number} zIndex - Z-index for stacking (optional)
   * @returns {HTMLElement} DOM element
   */
  render(zIndex = null) {
    const el = super.render(zIndex);
    el.classList.add('audio-element');

    if (this.properties.url) {
      const audio = document.createElement('audio');
      audio.controls = this.properties.controls;
      audio.autoplay = this.properties.autoplay;
      audio.loop = this.properties.loop;
      audio.style.cssText = `
        width: 90%;
        margin: auto;
      `;

      // Check if URL is a media ID or external URL
      if (this.properties.url.startsWith('media_')) {
        // Load from MediaDB
        this.loadFromMediaDB(audio);
      } else {
        // External URL
        audio.src = this.properties.url;
      }

      audio.onerror = () => {
        el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#f5f5f5;color:#999;">Audio not found</div>';
      };

      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.background = '#f5f5f5';
      el.style.border = '2px dashed #ccc';

      el.appendChild(audio);
    } else {
      el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#f5f5f5;color:#999;border:2px dashed #ccc;"><i class="material-icons" style="font-size:48px;">audiotrack</i></div>';
    }

    return el;
  }

  /**
   * Load audio from MediaDB
   * @param {HTMLAudioElement} audio - Audio element
   */
  async loadFromMediaDB(audio) {
    try {
      const dataURL = await window.MediaDB.getMediaDataURL(this.properties.url);
      if (dataURL) {
        audio.src = dataURL;
      } else {
        throw new Error('Media not found in IndexedDB');
      }
    } catch (error) {
      console.error('Failed to load audio from MediaDB:', error);
      audio.onerror();
    }
  }

  /**
   * Set audio source
   * @param {string|File} source - Audio URL, data URL, media ID, or File object
   */
  async setUrl(source) {
    if (source instanceof File || source instanceof Blob) {
      // Upload to MediaDB
      const item = await window.MediaDB.addMedia(source);
      this.properties.url = item.id;
      console.log('✅ Audio uploaded to MediaDB:', item.id);
    } else {
      // Direct URL or media ID
      this.properties.url = source;
    }
  }

  /**
   * Export to JSON (includes data URL for portability)
   * @returns {Object} JSON representation
   */
  async toJSON() {
    const base = super.toJSON();

    // If URL is a media ID, export as data URL
    if (this.properties.url && this.properties.url.startsWith('media_')) {
      try {
        const mediaData = await window.MediaDB.exportMedia(this.properties.url);
        if (mediaData) {
          base.properties.mediaExport = mediaData;
        }
      } catch (error) {
        console.error('Failed to export media:', error);
      }
    }

    return base;
  }

  /**
   * Import from JSON (handles data URLs)
   * @param {Object} data - JSON data
   * @returns {AudioElement} Audio element instance
   */
  static async fromJSON(data) {
    // Check if there's exported media data
    if (data.properties?.mediaExport) {
      try {
        // Import media to IndexedDB
        const mediaId = await window.MediaDB.importMedia(data.properties.mediaExport);
        data.properties.url = mediaId;
        delete data.properties.mediaExport;
      } catch (error) {
        console.error('Failed to import media:', error);
      }
    }

    return new AudioElement(data);
  }
}

export default AudioElement;
