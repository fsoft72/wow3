/**
 * WOW3 Image Element
 * Image element with aspect ratio preservation
 * Uses IndexedDB for binary storage via MediaDB
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
    // Note: url can be either a media ID (media_xxx) or external URL
    this.properties.url = properties.properties?.url || '';
    this.properties.aspectRatio = properties.properties?.aspectRatio || null;
    this.properties.objectFit = properties.properties?.objectFit || 'cover';

    // Crop state: null = no crop, object = cropped
    this.properties.crop = properties.properties?.crop || null;
  }

  /**
   * Render image element to DOM
   * @param {number} zIndex - Z-index for stacking (optional)
   * @returns {HTMLElement} DOM element
   */
  render(zIndex = null) {
    const el = super.render(zIndex);
    el.classList.add('image-element');

    if (this.properties.url) {
      const crop = this.properties.crop;
      const img = document.createElement('img');
      img.alt = 'Image';

      if (crop) {
        // Cropped mode: overflow hidden on wrapper, absolute positioned content
        el.style.overflow = 'hidden';
        img.style.cssText = `
          position: absolute;
          left: ${crop.contentLeft}px;
          top: ${crop.contentTop}px;
          width: ${crop.contentWidth}px;
          height: ${crop.contentHeight}px;
          pointer-events: none;
          object-fit: fill;
        `;
      } else {
        // Normal mode: 100% fill with object-fit
        img.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: ${this.properties.objectFit};
          pointer-events: none;
        `;
      }

      // Check if URL is a media ID or external URL
      if (this.properties.url.startsWith('media_')) {
        // Load from MediaDB
        this.loadFromMediaDB(img);
      } else {
        // External URL
        img.src = this.properties.url;
      }

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
   * Load image from MediaDB
   * @param {HTMLImageElement} img - Image element
   */
  async loadFromMediaDB(img) {
    try {
      const dataURL = await window.MediaDB.getMediaDataURL(this.properties.url);
      if (dataURL) {
        img.src = dataURL;
      } else {
        throw new Error('Media not found in IndexedDB');
      }
    } catch (error) {
      console.error('Failed to load image from MediaDB:', error);
      img.onerror();
    }
  }

  /**
   * Set image source
   * @param {string|File} source - Image URL, data URL, media ID, or File object
   */
  async setUrl(source) {
    if (source instanceof File || source instanceof Blob) {
      // Upload to MediaDB
      const item = await window.MediaDB.addMedia(source);
      this.properties.url = item.id;
      console.log('✅ Image uploaded to MediaDB:', item.id);
    } else {
      // Direct URL or media ID
      this.properties.url = source;
    }
  }

  /**
   * Set object fit mode
   * @param {string} mode - 'cover', 'contain', 'fill', etc.
   */
  setObjectFit(mode) {
    this.properties.objectFit = mode;
  }

  // toJSON() is inherited from Element — all properties (including url) are serialized automatically.
  // Media export (embedding binary data) is handled by storage.js exportPresentation().
}

Element.registerClass('image', ImageElement);

export default ImageElement;
