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

  // toJSON() is inherited from Element — all properties (including url) are serialized automatically.
  // Media export (embedding binary data) is handled by storage.js exportPresentation().
}

Element.registerClass('audio', AudioElement);

export default AudioElement;
