/**
 * WOW3 Drag Handler
 * Handles element dragging with alignment guides
 */

import { AlignmentGuides } from './AlignmentGuides.js';
import { constrainToCanvas, snapPosition } from '../utils/positioning.js';
import { appEvents, AppEvents } from '../utils/events.js';

export class DragHandler {
  /**
   * Create drag handler
   * @param {ElementController} elementController - Element controller instance
   */
  constructor(elementController) {
    this.elementController = elementController;
    this.alignmentGuides = new AlignmentGuides();
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.elementStart = { x: 0, y: 0 };
    this.currentElement = null;
  }

  /**
   * Attach drag handler to element
   * @param {HTMLElement} elementDOM - Element DOM
   * @param {Element} element - Element model
   */
  attach(elementDOM, element) {
    // Prevent duplicate listeners from accumulating on re-selection
    if (elementDOM._dragHandlerAttached) return;
    elementDOM._dragHandlerAttached = true;

    elementDOM.addEventListener('mousedown', (e) => {
      // Don't drag if clicking on handles
      if (
        e.target.classList.contains('resize-handle') ||
        e.target.classList.contains('rotate-handle')
      ) {
        return;
      }

      // Don't drag if editing text
      if (e.target.contentEditable === 'true' || e.target.tagName === 'INPUT') {
        return;
      }

      this.startDrag(e, elementDOM, element);
    });
  }

  /**
   * Start dragging element
   * @param {MouseEvent} e - Mouse event
   * @param {HTMLElement} elementDOM - Element DOM
   * @param {Element} element - Element model
   */
  startDrag(e, elementDOM, element) {
    e.preventDefault();
    e.stopPropagation();

    this.isDragging = true;
    this.currentElement = element;

    elementDOM.classList.add('dragging');

    this.dragStart = { x: e.clientX, y: e.clientY };
    this.elementStart = { x: element.position.x, y: element.position.y };

    const canvas = document.getElementById('slide-canvas');
    const canvasRect = canvas.getBoundingClientRect();

    // Get all other elements for alignment
    const currentSlide = this.elementController.editor.presentation.getCurrentSlide();
    const otherElements = currentSlide.elements
      .filter((el) => el.id !== element.id)
      .map((el) => el.position);

    const onMouseMove = (e) => {
      if (!this.isDragging) return;

      const dx = e.clientX - this.dragStart.x;
      const dy = e.clientY - this.dragStart.y;

      // Calculate new position
      let newX = this.elementStart.x + dx;
      let newY = this.elementStart.y + dy;

      // Apply magnetic snapping to other elements and canvas borders
      const snapped = snapPosition(
        { x: newX, y: newY, width: element.position.width, height: element.position.height },
        otherElements
      );

      // Constrain to canvas
      const constrained = constrainToCanvas({
        x: snapped.x,
        y: snapped.y,
        width: element.position.width,
        height: element.position.height,
        rotation: element.position.rotation
      });

      newX = constrained.x;
      newY = constrained.y;

      // Only show guides if constraint didn't override snap
      const guidesToShow = {
        horizontal: Math.abs(newY - snapped.y) < 1 ? snapped.guides.horizontal : [],
        vertical: Math.abs(newX - snapped.x) < 1 ? snapped.guides.vertical : []
      };

      // Update position
      element.updatePosition({ x: newX, y: newY });
      elementDOM.style.left = newX + 'px';
      elementDOM.style.top = newY + 'px';

      // Update position values in properties panel
      if (this.elementController.editor.uiManager && this.elementController.editor.uiManager.rightSidebar) {
        this.elementController.editor.uiManager.rightSidebar.updatePositionValues(element);
      }

      // Show snap guides
      this.alignmentGuides.showGuides(canvas, guidesToShow);

      appEvents.emit(AppEvents.ELEMENT_MOVED, element);
    };

    const onMouseUp = () => {
      // Always clean up listeners to prevent leaks
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (!this.isDragging) return;

      this.isDragging = false;
      this.currentElement = null;

      elementDOM.classList.remove('dragging');
      this.alignmentGuides.hide();

      // Record history
      this.elementController.editor.recordHistory();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
}

export default DragHandler;
