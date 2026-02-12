/**
 * WOW3 Marquee Handler
 * Rubber-band rectangle selection on canvas background
 */

import { rectsIntersect } from '../utils/dom.js';

export class MarqueeHandler {
  /**
   * Create marquee handler
   * @param {ElementController} elementController - Element controller instance
   */
  constructor(elementController) {
    this.elementController = elementController;
    this._isDrawing = false;
    this._startX = 0;
    this._startY = 0;
    this._box = null;
    this._canvas = null;
  }

  /**
   * Initialize marquee handler (attach mousedown on canvas)
   */
  init() {
    this._canvas = document.getElementById('slide-canvas');
    if (!this._canvas) return;

    this._canvas.addEventListener('mousedown', (e) => {
      // Only fire when clicking directly on the canvas background
      if (e.target !== this._canvas) return;

      this._onMouseDown(e);
    });
  }

  /**
   * Handle mousedown on canvas background
   * @param {MouseEvent} e
   */
  _onMouseDown(e) {
    e.preventDefault();

    const canvasRect = this._canvas.getBoundingClientRect();
    this._startX = e.clientX - canvasRect.left;
    this._startY = e.clientY - canvasRect.top;
    this._isDrawing = true;

    // If no Ctrl key, deselect everything first
    if (!e.ctrlKey && !e.metaKey) {
      this.elementController.deselectAll();
    }

    // Create selection box element
    this._box = document.createElement('div');
    this._box.className = 'selection-box';
    this._box.style.left = this._startX + 'px';
    this._box.style.top = this._startY + 'px';
    this._box.style.width = '0px';
    this._box.style.height = '0px';
    this._canvas.appendChild(this._box);

    const onMouseMove = (e) => {
      if (!this._isDrawing) return;

      const currentX = e.clientX - canvasRect.left;
      const currentY = e.clientY - canvasRect.top;

      // Calculate box position and size (handle negative drag)
      const x = Math.min(this._startX, currentX);
      const y = Math.min(this._startY, currentY);
      const w = Math.abs(currentX - this._startX);
      const h = Math.abs(currentY - this._startY);

      this._box.style.left = x + 'px';
      this._box.style.top = y + 'px';
      this._box.style.width = w + 'px';
      this._box.style.height = h + 'px';
    };

    const onMouseUp = (e) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (!this._isDrawing) return;
      this._isDrawing = false;

      const currentX = e.clientX - canvasRect.left;
      const currentY = e.clientY - canvasRect.top;

      const w = Math.abs(currentX - this._startX);
      const h = Math.abs(currentY - this._startY);

      // Remove the selection box
      if (this._box && this._box.parentNode) {
        this._box.remove();
      }
      this._box = null;

      // If marquee is too small (<3px), treat as a click → deselect
      if (w < 3 && h < 3) {
        if (!e.ctrlKey && !e.metaKey) {
          this.elementController.deselectAll();
        }
        return;
      }

      // Build marquee rect in canvas coordinates
      const marqueeRect = {
        x: Math.min(this._startX, currentX),
        y: Math.min(this._startY, currentY),
        width: w,
        height: h
      };

      // Find elements within the marquee
      const currentSlide = this.elementController.editor.presentation.getCurrentSlide();

      currentSlide.elements.forEach((element) => {
        const elRect = {
          x: element.position.x,
          y: element.position.y,
          width: element.position.width,
          height: element.position.height
        };

        if (rectsIntersect(marqueeRect, elRect)) {
          this.elementController.addToSelection(element);
        }
      });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
}

export default MarqueeHandler;
