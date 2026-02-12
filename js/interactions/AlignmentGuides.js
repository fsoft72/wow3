/**
 * WOW3 Alignment Guides
 * Visual guides for aligning elements
 */

import { findAlignmentGuides } from '../utils/positioning.js';

export class AlignmentGuides {
  constructor() {
    this.guides = [];
    this.container = null;
  }

  /**
   * Update alignment guides for dragged element
   * @param {Element} draggedElement - Element being dragged
   * @param {HTMLElement} canvas - Canvas element
   * @param {Array} otherElements - Array of other element positions
   */
  update(draggedElement, canvas, otherElements) {
    // Clear existing guides
    this.hide();

    // Get alignment container
    if (!this.container) {
      this.container = document.getElementById('alignment-guides');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'alignment-guides';
        this.container.className = 'alignment-guides';
        canvas.appendChild(this.container);
      }
    }

    // Find alignments
    const alignments = findAlignmentGuides(draggedElement.position, otherElements);

    // Show horizontal guides
    alignments.horizontal.forEach((guide) => {
      this.showGuide('horizontal', guide.position);
    });

    // Show vertical guides
    alignments.vertical.forEach((guide) => {
      this.showGuide('vertical', guide.position);
    });
  }

  /**
   * Show alignment guide
   * @param {string} type - 'horizontal' or 'vertical'
   * @param {number} position - Position in pixels
   */
  showGuide(type, position) {
    const guide = document.createElement('div');
    guide.className = `alignment-guide ${type}`;

    if (type === 'vertical') {
      guide.style.left = position + 'px';
      guide.style.top = '0';
      guide.style.width = '1px';
      guide.style.height = '100%';
    } else {
      guide.style.top = position + 'px';
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
   * Cleanup
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
