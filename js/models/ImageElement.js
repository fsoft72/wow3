/**
 * WOW3 Image Element
 * Image element with aspect ratio preservation
 */

import { Element } from './Element.js';
import { ElementType } from '../utils/constants.js';

export class ImageElement extends Element {
  /**
   * Create an image element
   * @param {Object} properties - Element properties
   */
  constructor(properties = {}) {
    super(ElementType.IMAGE, properties);

    // Image-specific properties
    this.properties.url = properties.properties?.url || '';
    this.properties.aspectRatio = properties.properties?.aspectRatio || null;
    this.properties.objectFit = properties.properties?.objectFit || 'cover';
  }

  /**
   * Render image element to DOM
   * @returns {HTMLElement} DOM element
   */
  render() {
    const el = super.render();
    el.classList.add('image-element');

    if (this.properties.url) {
      const img = document.createElement('img');
      img.src = this.properties.url;
      img.alt = 'Image';
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: ${this.properties.objectFit};
        pointer-events: none;
      `;

      // Store aspect ratio when image loads
      img.onload = () => {
        if (!this.properties.aspectRatio && img.naturalWidth && img.naturalHeight) {
          this.properties.aspectRatio = img.naturalWidth / img.naturalHeight;
        }
      };

      img.onerror = () => {
        // Show error placeholder
        el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#f5f5f5;color:#999;">Image not found</div>';
      };

      el.appendChild(img);
    } else {
      // Show placeholder
      el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#f5f5f5;color:#999;border:2px dashed #ccc;">No image selected</div>';
    }

    return el;
  }

  /**
   * Set image URL
   * @param {string} url - Image URL or data URL
   */
  setUrl(url) {
    this.properties.url = url;
  }

  /**
   * Set object fit mode
   * @param {string} mode - 'cover', 'contain', 'fill', etc.
   */
  setObjectFit(mode) {
    this.properties.objectFit = mode;
  }
}

export default ImageElement;
