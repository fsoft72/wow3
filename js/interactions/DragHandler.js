/**
 * WOW3 Drag Handler
 * Handles element dragging with alignment guides and multi-element drag
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

    /** @type {Map<string, {x: number, y: number}>} Start positions for multi-drag */
    this._multiDragStarts = new Map();
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
      // Don't drag if in crop mode
      if (this.elementController.cropHandler?.isCropMode) return;

      // Don't drag if clicking on handles
      if (
        e.target.classList.contains('resize-handle') ||
        e.target.classList.contains('rotate-handle') ||
        e.target.classList.contains('crop-handle') ||
        e.target.classList.contains('crop-corner')
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
   * Start dragging element(s)
   * @param {MouseEvent} e - Mouse event
   * @param {HTMLElement} elementDOM - Element DOM
   * @param {Element} element - Element model
   */
  startDrag(e, elementDOM, element) {
    e.preventDefault();
    e.stopPropagation();

    const ec = this.elementController;

    // If dragged element is NOT in selection, select it first (single drag)
    if (!ec.isSelected(element)) {
      ec.selectElement(element);
    }

    this.isDragging = true;
    this.currentElement = element;
    this.dragStart = { x: e.clientX, y: e.clientY };
    this.elementStart = { x: element.position.x, y: element.position.y };

    // Capture start positions for ALL selected elements
    this._multiDragStarts.clear();
    const selectedElements = ec.selectedElements;
    const isMulti = selectedElements.length > 1;

    selectedElements.forEach((el) => {
      this._multiDragStarts.set(el.id, { x: el.position.x, y: el.position.y });
      const dom = document.getElementById(el.id);
      if (dom) dom.classList.add('dragging');
    });

    const canvas = document.getElementById('slide-canvas');

    // Get other elements for alignment (exclude ALL selected elements)
    const currentSlide = ec.editor.presentation.getCurrentSlide();
    const selectedIds = new Set(selectedElements.map((el) => el.id));
    const otherElements = currentSlide.elements
      .filter((el) => !selectedIds.has(el.id))
      .map((el) => el.position);

    const onMouseMove = (e) => {
      if (!this.isDragging) return;

      const dx = e.clientX - this.dragStart.x;
      const dy = e.clientY - this.dragStart.y;

      if (isMulti) {
        // Multi-drag: apply raw dx/dy to all selected elements (no snap)
        selectedElements.forEach((el) => {
          const start = this._multiDragStarts.get(el.id);
          if (!start) return;

          const newX = start.x + dx;
          const newY = start.y + dy;

          el.updatePosition({ x: newX, y: newY });
          const dom = document.getElementById(el.id);
          if (dom) {
            dom.style.left = newX + 'px';
            dom.style.top = newY + 'px';
          }
        });

        this.alignmentGuides.hide();
      } else {
        // Single drag: snap + constrain + guides (existing behavior)
        let newX = this.elementStart.x + dx;
        let newY = this.elementStart.y + dy;

        const snapped = snapPosition(
          { x: newX, y: newY, width: element.position.width, height: element.position.height },
          otherElements
        );

        const constrained = constrainToCanvas({
          x: snapped.x,
          y: snapped.y,
          width: element.position.width,
          height: element.position.height,
          rotation: element.position.rotation
        });

        newX = constrained.x;
        newY = constrained.y;

        const guidesToShow = {
          horizontal: Math.abs(newY - snapped.y) < 1 ? snapped.guides.horizontal : [],
          vertical: Math.abs(newX - snapped.x) < 1 ? snapped.guides.vertical : []
        };

        element.updatePosition({ x: newX, y: newY });
        elementDOM.style.left = newX + 'px';
        elementDOM.style.top = newY + 'px';

        // Update position values in properties panel
        if (ec.editor.uiManager && ec.editor.uiManager.rightSidebar) {
          ec.editor.uiManager.rightSidebar.updatePositionValues(element);
        }

        this.alignmentGuides.showGuides(canvas, guidesToShow);
      }

      appEvents.emit(AppEvents.ELEMENT_MOVED, element);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (!this.isDragging) return;

      this.isDragging = false;
      this.currentElement = null;

      // Remove dragging class from all selected elements
      selectedElements.forEach((el) => {
        const dom = document.getElementById(el.id);
        if (dom) dom.classList.remove('dragging');
      });

      this._multiDragStarts.clear();
      this.alignmentGuides.hide();

      // Record history
      ec.editor.recordHistory();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
}

export default DragHandler;
