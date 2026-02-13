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

    // Clip shape: 'none', 'circle', 'rectangle'
    this.properties.clipShape = properties.properties?.clipShape || 'none';
    this.properties.shapeBorderWidth = properties.properties?.shapeBorderWidth ?? 0;
    this.properties.shapeBorderColor = properties.properties?.shapeBorderColor || '#000000';
    this.properties.shapeScale = properties.properties?.shapeScale ?? 100;
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

      let content;

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
        img.style.cssText = `
          position: absolute;
          left: ${crop.contentLeft}px;
          top: ${crop.contentTop}px;
          width: ${crop.contentWidth}px;
          height: ${crop.contentHeight}px;
          pointer-events: none;
          object-fit: fill;
        `;
        clipper.appendChild(img);
        content = clipper;
      } else {
        // Normal mode: 100% fill with object-fit
        img.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: ${this.properties.objectFit};
          pointer-events: none;
        `;
        content = img;
      }

      // Wrap content in clip shape wrapper if a shape is active
      if (this.properties.clipShape && this.properties.clipShape !== 'none') {
        const wrapper = this._createShapeWrapper();
        const scaleContainer = this._createScaleContainer();
        scaleContainer.appendChild(content);
        wrapper.appendChild(scaleContainer);
        el.appendChild(wrapper);
      } else {
        el.appendChild(content);
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
    } else {
      // Show placeholder
      el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#f5f5f5;color:#999;border:2px dashed #ccc;">No image selected</div>';
    }

    return el;
  }

  /**
   * Create the clip shape wrapper div with border-radius, overflow, and border
   * @returns {HTMLElement} Shape wrapper element
   * @private
   */
  _createShapeWrapper() {
    const wrapper = document.createElement('div');
    wrapper.className = 'clip-shape-wrapper';

    let borderRadius = '0';
    if (this.properties.clipShape === 'circle') {
      borderRadius = '50%';
    } else if (this.properties.clipShape === 'rectangle') {
      borderRadius = `${this.properties.borderRadius || 0}px`;
    }

    const borderWidth = this.properties.shapeBorderWidth || 0;
    const borderColor = this.properties.shapeBorderColor || '#000000';
    const borderStyle = borderWidth > 0 ? `border: ${borderWidth}px solid ${borderColor};` : '';

    wrapper.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      overflow: hidden;
      border-radius: ${borderRadius};
      box-sizing: border-box;
      ${borderStyle}
    `;

    return wrapper;
  }

  /**
   * Create the scale container div inside the shape wrapper
   * @returns {HTMLElement} Scale container element
   * @private
   */
  _createScaleContainer() {
    const container = document.createElement('div');
    container.className = 'clip-shape-content';

    const scale = (this.properties.shapeScale || 100) / 100;

    container.style.cssText = `
      width: 100%; height: 100%;
      transform: scale(${scale});
      transform-origin: center center;
    `;

    return container;
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
