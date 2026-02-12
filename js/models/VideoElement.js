/**
 * WOW3 Video Element
 * Video element with playback controls
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
    this.properties.url = properties.properties?.url || '';
    this.properties.aspectRatio = properties.properties?.aspectRatio || 16 / 9;
    this.properties.autoplay = properties.properties?.autoplay || false;
    this.properties.loop = properties.properties?.loop || false;
    this.properties.muted = properties.properties?.muted || false;
    this.properties.controls = properties.properties?.controls !== false;
  }

  /**
   * Render video element to DOM
   * @returns {HTMLElement} DOM element
   */
  render() {
    const el = super.render();
    el.classList.add('video-element');

    if (this.properties.url) {
      const video = document.createElement('video');
      video.src = this.properties.url;
      video.controls = this.properties.controls;
      video.autoplay = this.properties.autoplay;
      video.loop = this.properties.loop;
      video.muted = this.properties.muted;
      video.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
      `;

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
   * Set video URL
   * @param {string} url - Video URL
   */
  setUrl(url) {
    this.properties.url = url;
  }
}

export default VideoElement;
