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

    // Crop state: null = no crop, object = cropped
    this.properties.crop = properties.properties?.crop || null;
  }

  /**
   * Render video element to DOM
   * @param {number} zIndex - Z-index for stacking (optional)
   * @returns {HTMLElement} DOM element
   */
  render(zIndex = null) {
    const el = super.render(zIndex);
    el.classList.add('video-element');

    const url = this.properties.url;

    if (url) {
      const type = this._getVideoType(url);

      if (type === 'youtube') {
        const youtubeId = this._parseYouTubeId(url);
        const iframe = document.createElement('iframe');
        
        // Use no-cookie embed
        let src = `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`;
        
        // Add parameters based on properties
        if (this.properties.autoplay) src += '&autoplay=1&mute=1';
        if (this.properties.loop) src += `&loop=1&playlist=${youtubeId}`;
        if (this.properties.controls === false) src += '&controls=0';
        
        iframe.src = src;
        iframe.style.cssText = `
          width: 100%;
          height: 100%;
          border: none;
          pointer-events: auto;
        `;
        iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        iframe.allowFullscreen = true;
        el.appendChild(iframe);

        // Add overlay to allow selection in editor (iframes capture clicks)
        const isPresentation = window.app && window.app.uiManager && window.app.uiManager.currentMode === 'presentation';
        if (!isPresentation) {
          const overlay = document.createElement('div');
          overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10;
          `;
          el.appendChild(overlay);
        }
      } else {
        const crop = this.properties.crop;
        const video = document.createElement('video');
        video.controls = this.properties.controls;
        video.autoplay = this.properties.autoplay;
        video.loop = this.properties.loop;
        video.muted = this.properties.muted;

        if (type === 'local') {
          const mediaId = url.replace('local://', '');
          this.loadFromMediaDB(video, mediaId);
        } else {
          // External URL
          video.src = url;
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

        if (crop) {
          // Cropped mode: inner clipper div with overflow hidden (element itself must not clip handles)
          const clipper = document.createElement('div');
          clipper.className = 'crop-clipper';
          clipper.style.cssText = `
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            overflow: hidden;
            pointer-events: none;
          `;
          video.style.cssText = `
            position: absolute;
            left: ${crop.contentLeft}px;
            top: ${crop.contentTop}px;
            width: ${crop.contentWidth}px;
            height: ${crop.contentHeight}px;
            object-fit: fill;
          `;
          clipper.appendChild(video);
          el.appendChild(clipper);
        } else {
          video.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
          `;
          el.appendChild(video);
        }
      }
    } else {
      el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#f5f5f5;color:#999;border:2px dashed #ccc;"><i class="material-icons" style="font-size:48px;">videocam</i></div>';
    }

    return el;
  }

  /**
   * Parse YouTube URL or ID
   * @param {string} url - YouTube URL or ID
   * @returns {string|null} YouTube video ID or null if not a YouTube source
   * @private
   */
  _parseYouTubeId(url) {
    if (!url) return null;
    
    // Regular YouTube URL formats
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);

    if (match && match[2].length === 11) {
      return match[2];
    }
    
    // If it's already an 11-character ID
    if (url.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(url)) {
      return url;
    }

    return null;
  }

  /**
   * Detect video source type
   * @param {string} url - Video source URL
   * @returns {string} Type: 'local', 'youtube', 'external', or 'none'
   * @private
   */
  _getVideoType(url) {
    if (!url) return 'none';
    if (url.startsWith('media_') || url.startsWith('local://')) return 'local';
    if (this._parseYouTubeId(url)) return 'youtube';
    return 'external';
  }

  /**
   * Load video from MediaDB
   * @param {HTMLVideoElement} video - Video element
   * @param {string} mediaId - Optional media ID (defaults to this.properties.url)
   */
  async loadFromMediaDB(video, mediaId = null) {
    try {
      const id = mediaId || this.properties.url;
      const dataURL = await window.MediaDB.getMediaDataURL(id);
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
      
      // For YouTube, default to 16:9 aspect ratio
      if (this._getVideoType(source) === 'youtube') {
        this.properties.aspectRatio = 16 / 9;
      }
    }
  }

  // toJSON() is inherited from Element — all properties (including url) are serialized automatically.
  // Media export (embedding binary data) is handled by storage.js exportPresentation().
}

Element.registerClass('video', VideoElement);

export default VideoElement;
