/**
 * WOW3 Audio Element
 * Audio element with playback controls
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
    this.properties.url = properties.properties?.url || '';
    this.properties.autoplay = properties.properties?.autoplay || false;
    this.properties.loop = properties.properties?.loop || false;
    this.properties.controls = properties.properties?.controls !== false;
  }

  /**
   * Render audio element to DOM
   * @returns {HTMLElement} DOM element
   */
  render() {
    const el = super.render();
    el.classList.add('audio-element');

    if (this.properties.url) {
      const audio = document.createElement('audio');
      audio.src = this.properties.url;
      audio.controls = this.properties.controls;
      audio.autoplay = this.properties.autoplay;
      audio.loop = this.properties.loop;
      audio.style.cssText = `
        width: 90%;
        margin: auto;
      `;

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
   * Set audio URL
   * @param {string} url - Audio URL
   */
  setUrl(url) {
    this.properties.url = url;
  }
}

export default AudioElement;
