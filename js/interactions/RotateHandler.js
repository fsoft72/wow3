/**
 * WOW3 Rotate Handler
 * Handles element rotation with snap-to-angle feature
 */

import { appEvents, AppEvents } from '../utils/events.js';

export class RotateHandler {
  /**
   * Create rotate handler
   * @param {ElementController} elementController - Element controller instance
   */
  constructor(elementController) {
    this.elementController = elementController;
    this.isRotating = false;
  }

  /**
   * Attach rotate handler to handle
   * @param {HTMLElement} handleDOM - Rotate handle DOM
   * @param {Element} element - Element model
   */
  attach(handleDOM, element) {
    handleDOM.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.startRotate(e, handleDOM, element);
    });
  }

  /**
   * Start rotating element
   * @param {MouseEvent} e - Mouse event
   * @param {HTMLElement} handleDOM - Rotate handle DOM
   * @param {Element} element - Element model
   */
  startRotate(e, handleDOM, element) {
    e.preventDefault();
    this.isRotating = true;

    const elementDOM = document.getElementById(element.id);
    const rect = elementDOM.getBoundingClientRect();

    // Calculate center point
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate initial angle
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const startRotation = element.position.rotation;

    // Change cursor
    handleDOM.style.cursor = 'grabbing';

    const onMouseMove = (e) => {
      if (!this.isRotating) return;

      // Calculate current angle
      const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      const deltaAngle = (currentAngle - startAngle) * (180 / Math.PI);

      let newRotation = startRotation + deltaAngle;

      // Snap to 15-degree increments if Shift is pressed
      if (e.shiftKey) {
        newRotation = Math.round(newRotation / 15) * 15;
      }

      // Normalize angle to 0-360 range
      newRotation = ((newRotation % 360) + 360) % 360;

      // Update element
      element.updatePosition({ rotation: newRotation });

      // Apply to DOM
      elementDOM.style.transform = `rotate(${newRotation}deg)`;

      appEvents.emit(AppEvents.ELEMENT_ROTATED, element);
    };

    const onMouseUp = () => {
      if (!this.isRotating) return;

      this.isRotating = false;

      // Reset cursor
      handleDOM.style.cursor = 'grab';

      // Record history
      this.elementController.editor.recordHistory();

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
}

export default RotateHandler;
