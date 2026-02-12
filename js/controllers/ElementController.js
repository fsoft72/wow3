/**
 * WOW3 Element Controller
 * Manages element operations and interactions
 */

import {
  TextElement,
  ImageElement,
  VideoElement,
  AudioElement,
  ShapeElement,
  ListElement,
  LinkElement
} from '../models/index.js';
import { appEvents, AppEvents } from '../utils/events.js';
import { centerOnCanvas } from '../utils/positioning.js';

export class ElementController {
  /**
   * Create element controller
   * @param {EditorController} editorController - Editor controller instance
   */
  constructor(editorController) {
    this.editor = editorController;
    this.selectedElement = null;

    // Interaction handlers (will be set externally)
    this.dragHandler = null;
    this.resizeHandler = null;
    this.rotateHandler = null;

    // Clipboard
    this.clipboard = null;
  }

  /**
   * Initialize element controller
   */
  async init() {
    console.log('Initializing ElementController...');
    console.log('ElementController initialized');
  }

  /**
   * Create new element
   * @param {string} type - Element type
   */
  createElement(type) {
    const ElementClass = this.getElementClass(type);
    const element = new ElementClass();

    // Center element on canvas
    const centered = centerOnCanvas({
      width: element.position.width,
      height: element.position.height
    });
    element.position.x = centered.x;
    element.position.y = centered.y;

    // Add to current slide
    const currentSlide = this.editor.presentation.getCurrentSlide();
    currentSlide.addElement(element);

    // Re-render and select
    this.editor.slideController.renderCurrentSlide();
    this.selectElement(element);

    appEvents.emit(AppEvents.ELEMENT_ADDED, element);

    M.toast({ html: `${type} element added`, classes: 'green' });
  }

  /**
   * Get element class by type
   * @param {string} type - Element type
   * @returns {Class} Element class
   */
  getElementClass(type) {
    const classes = {
      text: TextElement,
      image: ImageElement,
      video: VideoElement,
      audio: AudioElement,
      shape: ShapeElement,
      list: ListElement,
      link: LinkElement
    };

    return classes[type] || TextElement;
  }

  /**
   * Delete element
   * @param {string} elementId - Element ID
   */
  deleteElement(elementId) {
    const currentSlide = this.editor.presentation.getCurrentSlide();
    const success = currentSlide.removeElement(elementId);

    if (success) {
      if (this.selectedElement && this.selectedElement.id === elementId) {
        this.selectedElement = null;
      }

      this.editor.slideController.renderCurrentSlide();
      appEvents.emit(AppEvents.ELEMENT_REMOVED, elementId);

      M.toast({ html: 'Element deleted', classes: 'green' });
    }
  }

  /**
   * Select element
   * @param {Element} element - Element to select
   */
  selectElement(element) {
    // Deselect previous
    if (this.selectedElement) {
      const prevDOM = document.getElementById(this.selectedElement.id);
      if (prevDOM) {
        prevDOM.classList.remove('selected');
        this.removeHandles(prevDOM);
      }
    }

    // Select new
    this.selectedElement = element;
    const elementDOM = document.getElementById(element.id);

    if (elementDOM) {
      elementDOM.classList.add('selected');
      this.addHandles(elementDOM);

      // Update properties panel
      if (this.editor.uiManager && this.editor.uiManager.rightSidebar) {
        this.editor.uiManager.rightSidebar.updateProperties(element);
      }

      appEvents.emit(AppEvents.ELEMENT_SELECTED, element);
    }
  }

  /**
   * Deselect current element
   */
  deselectElement() {
    if (this.selectedElement) {
      const elementDOM = document.getElementById(this.selectedElement.id);
      if (elementDOM) {
        elementDOM.classList.remove('selected');
        this.removeHandles(elementDOM);
      }

      this.selectedElement = null;

      // Clear properties panel
      if (this.editor.uiManager && this.editor.uiManager.rightSidebar) {
        this.editor.uiManager.rightSidebar.clearProperties();
      }

      appEvents.emit(AppEvents.ELEMENT_DESELECTED);
    }
  }

  /**
   * Attach event handlers to element DOM
   * @param {HTMLElement} elementDOM - Element DOM
   * @param {Element} element - Element model
   */
  attachHandlers(elementDOM, element) {
    // Click to select
    elementDOM.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectElement(element);
    });

    // Double-click to edit text
    if (element.type === 'text') {
      elementDOM.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.enableTextEditing(elementDOM, element);
      });
    }

    // Prevent default drag on images
    if (element.type === 'image') {
      const img = elementDOM.querySelector('img');
      if (img) {
        img.addEventListener('dragstart', (e) => e.preventDefault());
      }
    }
  }

  /**
   * Add resize and rotate handles to element
   * @param {HTMLElement} elementDOM - Element DOM
   */
  addHandles(elementDOM) {
    // Add resize handles
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

    handles.forEach((direction) => {
      const handle = document.createElement('div');
      handle.className = `resize-handle ${direction}`;
      handle.dataset.direction = direction;
      elementDOM.appendChild(handle);

      // Attach resize handler
      if (this.resizeHandler) {
        this.resizeHandler.attach(handle, this.selectedElement);
      }
    });

    // Add rotation handle
    const rotateHandle = document.createElement('div');
    rotateHandle.className = 'rotate-handle';
    elementDOM.appendChild(rotateHandle);

    // Attach rotate handler
    if (this.rotateHandler) {
      this.rotateHandler.attach(rotateHandle, this.selectedElement);
    }

    // Attach drag handler to element
    if (this.dragHandler) {
      this.dragHandler.attach(elementDOM, this.selectedElement);
    }
  }

  /**
   * Remove handles from element
   * @param {HTMLElement} elementDOM - Element DOM
   */
  removeHandles(elementDOM) {
    const handles = elementDOM.querySelectorAll('.resize-handle, .rotate-handle');
    handles.forEach((handle) => handle.remove());
  }

  /**
   * Enable text editing
   * @param {HTMLElement} elementDOM - Element DOM
   * @param {Element} element - Element model
   */
  enableTextEditing(elementDOM, element) {
    const textContent = elementDOM.querySelector('.text-content');
    if (textContent) {
      textContent.focus();

      // Select all text
      const range = document.createRange();
      range.selectNodeContents(textContent);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      // Update on blur
      const updateText = () => {
        element.updateText(textContent.innerText);
        this.editor.recordHistory();
        textContent.removeEventListener('blur', updateText);
        appEvents.emit(AppEvents.ELEMENT_UPDATED, element);
      };

      textContent.addEventListener('blur', updateText);
    }
  }

  /**
   * Update element property
   * @param {string} property - Property path (e.g., 'position.x' or 'properties.font.size')
   * @param {*} value - New value
   */
  updateElementProperty(property, value) {
    if (!this.selectedElement) return;

    // Navigate property path and set value
    const paths = property.split('.');
    let target = this.selectedElement;

    for (let i = 0; i < paths.length - 1; i++) {
      target = target[paths[i]];
    }

    target[paths[paths.length - 1]] = value;

    // Re-render element
    this.editor.slideController.renderCurrentSlide();

    // Re-select element to maintain selection
    const element = this.editor.presentation
      .getCurrentSlide()
      .getElement(this.selectedElement.id);

    if (element) {
      this.selectElement(element);
    }

    this.editor.recordHistory();
    appEvents.emit(AppEvents.ELEMENT_UPDATED, this.selectedElement);
  }

  /**
   * Copy selected element
   */
  copySelectedElement() {
    if (this.selectedElement) {
      this.clipboard = this.selectedElement.clone();
      M.toast({ html: 'Element copied', classes: 'green' });
    }
  }

  /**
   * Paste element from clipboard
   */
  pasteElement() {
    if (this.clipboard) {
      const cloned = this.clipboard.clone();

      // Offset position slightly
      cloned.position.x += 20;
      cloned.position.y += 20;

      const currentSlide = this.editor.presentation.getCurrentSlide();
      currentSlide.addElement(cloned);

      this.editor.slideController.renderCurrentSlide();
      this.selectElement(cloned);
      this.editor.recordHistory();

      M.toast({ html: 'Element pasted', classes: 'green' });
      appEvents.emit(AppEvents.ELEMENT_ADDED, cloned);
    }
  }

  /**
   * Duplicate selected element
   */
  duplicateSelectedElement() {
    if (this.selectedElement) {
      const cloned = this.selectedElement.clone();

      // Offset position
      cloned.position.x += 20;
      cloned.position.y += 20;

      const currentSlide = this.editor.presentation.getCurrentSlide();
      currentSlide.addElement(cloned);

      this.editor.slideController.renderCurrentSlide();
      this.selectElement(cloned);
      this.editor.recordHistory();

      M.toast({ html: 'Element duplicated', classes: 'green' });
      appEvents.emit(AppEvents.ELEMENT_ADDED, cloned);
    }
  }

  /**
   * Bring element to front
   */
  bringToFront() {
    if (this.selectedElement) {
      const currentSlide = this.editor.presentation.getCurrentSlide();
      currentSlide.bringToFront(this.selectedElement.id);

      this.editor.slideController.renderCurrentSlide();
      this.selectElement(this.selectedElement);
      this.editor.recordHistory();
    }
  }

  /**
   * Send element to back
   */
  sendToBack() {
    if (this.selectedElement) {
      const currentSlide = this.editor.presentation.getCurrentSlide();
      currentSlide.sendToBack(this.selectedElement.id);

      this.editor.slideController.renderCurrentSlide();
      this.selectElement(this.selectedElement);
      this.editor.recordHistory();
    }
  }

  /**
   * Update element position from DOM
   * @param {Element} element - Element model
   */
  updateElementFromDOM(element) {
    const elementDOM = document.getElementById(element.id);
    if (elementDOM) {
      element.updateFromDOM(elementDOM);
    }
  }

  /**
   * Update media element URL (handles both File objects and URLs)
   * @param {Element} element - Media element (image, video, audio)
   * @param {string|File} source - URL, media ID, or File object
   */
  async updateMediaUrl(element, source) {
    if (!element || !element.setUrl) return;

    try {
      await element.setUrl(source);
      await this.editor.slideController.renderCurrentSlide();
      this.selectElement(element);
      this.editor.recordHistory();
    } catch (error) {
      console.error('Failed to update media URL:', error);
      M.toast({ html: 'Failed to update media', classes: 'red' });
    }
  }
}

export default ElementController;
