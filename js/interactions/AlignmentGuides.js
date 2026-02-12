/**
 * WOW3 Alignment Guides
 * Visual snap guides for aligning elements to other elements and canvas borders
 */

import { CANVAS } from '../utils/constants.js';

export class AlignmentGuides {
  constructor() {
    this.guides = [];
    this.container = null;
  }

  /**
   * Ensure the guides container exists inside the canvas
   * @param {HTMLElement} canvas - Canvas element
   */
  ensureContainer(canvas) {
    // Check if existing reference is still in the DOM (renderCurrentSlide clears canvas)
    if (this.container && this.container.isConnected) return;

    this.container = document.getElementById('alignment-guides');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'alignment-guides';
      this.container.className = 'alignment-guides';
      canvas.appendChild(this.container);
    }
  }

  /**
   * Show pre-computed snap guides
   * @param {HTMLElement} canvas - Canvas element
   * @param {Object} guides - { horizontal: [{position, type}], vertical: [{position, type}] }
   */
  showGuides(canvas, guides) {
    this.hide();
    this.ensureContainer(canvas);

    guides.horizontal.forEach((guide) => {
      this.showGuide('horizontal', guide.position, guide.type);
    });

    guides.vertical.forEach((guide) => {
      this.showGuide('vertical', guide.position, guide.type);
    });
  }

  /**
   * Show a single alignment guide line
   * @param {string} orientation - 'horizontal' or 'vertical'
   * @param {number} position - Position in pixels
   * @param {string} guideType - 'element' or 'canvas'
   */
  showGuide(orientation, position, guideType = 'element') {
    const guide = document.createElement('div');
    guide.className = `alignment-guide ${orientation} ${guideType}`;

    if (orientation === 'vertical') {
      // Clamp to visible area so right-edge guides aren't clipped
      const displayPos = Math.min(position, CANVAS.WIDTH - 1);
      guide.style.left = displayPos + 'px';
      guide.style.top = '0';
      guide.style.width = '1px';
      guide.style.height = '100%';
    } else {
      const displayPos = Math.min(position, CANVAS.HEIGHT - 1);
      guide.style.top = displayPos + 'px';
      guide.style.left = '0';
      guide.style.width = '100%';
      guide.style.height = '1px';
    }

    if (this.container) {
      this.container.appendChild(guide);
      this.guides.push(guide);
    }
  }

  /**
   * Hide all alignment guides
   */
  hide() {
    this.guides.forEach((guide) => guide.remove());
    this.guides = [];
  }

  /**
   * Cleanup and remove container
   */
  destroy() {
    this.hide();
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}

export default AlignmentGuides;
