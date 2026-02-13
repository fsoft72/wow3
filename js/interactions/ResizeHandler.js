/**
 * WOW3 Resize Handler
 * Handles element resizing with aspect ratio preservation
 */

import { constrainToCanvas } from '../utils/positioning.js';
import { UI } from '../utils/constants.js';
import { appEvents, AppEvents } from '../utils/events.js';

export class ResizeHandler {
  /**
   * Create resize handler
   * @param {ElementController} elementController - Element controller instance
   */
  constructor(elementController) {
    this.elementController = elementController;
    this.isResizing = false;
  }

  /**
   * Attach resize handler to handle
   * @param {HTMLElement} handleDOM - Resize handle DOM
   * @param {Element} element - Element model
   */
  attach(handleDOM, element) {
    handleDOM.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.startResize(e, handleDOM, element);
    });
  }

  /**
   * Start resizing element
   * @param {MouseEvent} e - Mouse event
   * @param {HTMLElement} handleDOM - Handle DOM
   * @param {Element} element - Element model
   */
  startResize(e, handleDOM, element) {
    e.preventDefault();
    this.isResizing = true;

    const direction = handleDOM.dataset.direction;
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...element.position };

    // Circle clip shapes always lock to 1:1; cropped elements lock to wrapper ratio;
    // uncropped images/videos lock to their natural aspect ratio (or Ctrl)
    const hasCrop = element.properties.crop != null;
    const isCircle = element.properties.clipShape === 'circle';
    const lockAspectRatio =
      isCircle ||
      hasCrop ||
      e.ctrlKey ||
      element.properties.aspectRatio !== null && element.properties.aspectRatio !== undefined;

    const aspectRatio = isCircle
      ? 1
      : hasCrop
        ? startPos.width / startPos.height
        : (element.properties.aspectRatio || startPos.width / startPos.height);

    const elementDOM = document.getElementById(element.id);

    // Capture initial crop state for proportional scaling
    const startCrop = element.properties.crop
      ? { ...element.properties.crop }
      : null;

    const onMouseMove = (e) => {
      if (!this.isResizing) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newWidth = startPos.width;
      let newHeight = startPos.height;
      let newX = startPos.x;
      let newY = startPos.y;

      // Calculate new dimensions based on direction
      switch (direction) {
        case 'se': // Bottom-right
          newWidth = startPos.width + dx;
          newHeight = lockAspectRatio
            ? newWidth / aspectRatio
            : startPos.height + dy;
          break;

        case 'sw': // Bottom-left
          newWidth = startPos.width - dx;
          newHeight = lockAspectRatio
            ? newWidth / aspectRatio
            : startPos.height + dy;
          newX = startPos.x + dx;
          break;

        case 'ne': // Top-right
          newWidth = startPos.width + dx;
          newHeight = lockAspectRatio
            ? newWidth / aspectRatio
            : startPos.height - dy;
          newY = lockAspectRatio
            ? startPos.y + (startPos.height - newHeight)
            : startPos.y + dy;
          break;

        case 'nw': // Top-left
          newWidth = startPos.width - dx;
          newHeight = lockAspectRatio
            ? newWidth / aspectRatio
            : startPos.height - dy;
          newX = startPos.x + dx;
          newY = lockAspectRatio
            ? startPos.y + (startPos.height - newHeight)
            : startPos.y + dy;
          break;

        case 'e': // Right
          newWidth = startPos.width + dx;
          if (lockAspectRatio) {
            newHeight = newWidth / aspectRatio;
            newY = startPos.y + (startPos.height - newHeight) / 2;
          }
          break;

        case 'w': // Left
          newWidth = startPos.width - dx;
          newX = startPos.x + dx;
          if (lockAspectRatio) {
            newHeight = newWidth / aspectRatio;
            newY = startPos.y + (startPos.height - newHeight) / 2;
          }
          break;

        case 'n': // Top
          newHeight = startPos.height - dy;
          newY = startPos.y + dy;
          if (lockAspectRatio) {
            newWidth = newHeight * aspectRatio;
            newX = startPos.x + (startPos.width - newWidth) / 2;
          }
          break;

        case 's': // Bottom
          newHeight = startPos.height + dy;
          if (lockAspectRatio) {
            newWidth = newHeight * aspectRatio;
            newX = startPos.x + (startPos.width - newWidth) / 2;
          }
          break;
      }

      // Minimum size constraints
      newWidth = Math.max(UI.MIN_ELEMENT_SIZE, newWidth);
      newHeight = Math.max(UI.MIN_ELEMENT_SIZE, newHeight);

      // Scale crop proportionally when resizing a cropped element (uniform scale)
      if (startCrop && element.properties.crop) {
        const scale = newWidth / startPos.width;
        element.properties.crop.contentWidth = startCrop.contentWidth * scale;
        element.properties.crop.contentHeight = startCrop.contentHeight * scale;
        element.properties.crop.contentLeft = startCrop.contentLeft * scale;
        element.properties.crop.contentTop = startCrop.contentTop * scale;

        // Update content DOM styles
        const media = elementDOM.querySelector('img, video');
        if (media) {
          media.style.width = `${element.properties.crop.contentWidth}px`;
          media.style.height = `${element.properties.crop.contentHeight}px`;
          media.style.left = `${element.properties.crop.contentLeft}px`;
          media.style.top = `${element.properties.crop.contentTop}px`;
        }
      }

      // Update element
      element.updatePosition({
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight
      });

      // Apply to DOM
      elementDOM.style.left = newX + 'px';
      elementDOM.style.top = newY + 'px';
      elementDOM.style.width = newWidth + 'px';
      elementDOM.style.height = newHeight + 'px';

      // Update position values in properties panel
      if (this.elementController.editor.uiManager && this.elementController.editor.uiManager.rightSidebar) {
        this.elementController.editor.uiManager.rightSidebar.updatePositionValues(element);
      }

      appEvents.emit(AppEvents.ELEMENT_RESIZED, element);
    };

    const onMouseUp = () => {
      if (!this.isResizing) return;

      this.isResizing = false;

      // Record history
      this.elementController.editor.recordHistory();

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
}

export default ResizeHandler;
