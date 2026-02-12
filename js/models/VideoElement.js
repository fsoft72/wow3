/**
 * WOW3 Video Element
 * Video element with playback controls
 * Uses IndexedDB for binary storage via MediaDB
 */

import { Element } from './Element.js';
import { ElementType } from '../utils/constants.js';

export class VideoElement extends Element {
  /**
   * Create a video element
   * @param {Object} properties - Element properties
   */
  constructor(properties = {}) {
    super(ElementType.VIDEO, properties);

    // Video-specific properties
    // Note: url can be either a media ID (media_xxx) or external URL
    this.properties.url = properties.properties?.url || '';
    this.properties.aspectRatio = properties.properties?.aspectRatio || 16 / 9;
    this.properties.autoplay = properties.properties?.autoplay || false;
    this.properties.loop = properties.properties?.loop || false;
    this.properties.muted = properties.properties?.muted || false;
    this.properties.controls = properties.properties?.controls !== false;
  }

  /**
   * Render video element to DOM
   * @param {number} zIndex - Z-index for stacking (optional)
   * @returns {HTMLElement} DOM element
   */
  render(zIndex = null) {
    const el = super.render(zIndex);
    el.classList.add('video-element');

    if (this.properties.url) {
      const video = document.createElement('video');
      video.controls = this.properties.controls;
      video.autoplay = this.properties.autoplay;
      video.loop = this.properties.loop;
      video.muted = this.properties.muted;
      video.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
      `;

      // Check if URL is a media ID or external URL
      if (this.properties.url.startsWith('media_')) {
        // Load from MediaDB
        this.loadFromMediaDB(video);
      } else {
        // External URL
        video.src = this.properties.url;
      }

      // Store aspect ratio when video loads
      video.onloadedmetadata = () => {
        if (video.videoWidth && video.videoHeight) {
          this.properties.aspectRatio = video.videoWidth / video.videoHeight;
        }
      };

      video.onerror = () => {
        el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#f5f5f5;color:#999;">Video not found</div>';
      };

      el.appendChild(video);
    } else {
      el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#f5f5f5;color:#999;border:2px dashed #ccc;"><i class="material-icons" style="font-size:48px;">videocam</i></div>';
    }

    return el;
  }

  /**
   * Load video from MediaDB
   * @param {HTMLVideoElement} video - Video element
   */
  async loadFromMediaDB(video) {
    try {
      const dataURL = await window.MediaDB.getMediaDataURL(this.properties.url);
      if (dataURL) {
        video.src = dataURL;
      } else {
        throw new Error('Media not found in IndexedDB');
      }
    } catch (error) {
      console.error('Failed to load video from MediaDB:', error);
      video.onerror();
    }
  }

  /**
   * Set video source
   * @param {string|File} source - Video URL, data URL, media ID, or File object
   */
  async setUrl(source) {
    if (source instanceof File || source instanceof Blob) {
      // Upload to MediaDB
      const item = await window.MediaDB.addMedia(source);
      this.properties.url = item.id;
      console.log('✅ Video uploaded to MediaDB:', item.id);
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
   * @returns {VideoElement} Video element instance
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

    return new VideoElement(data);
  }
}

export default VideoElement;
