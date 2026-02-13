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
  LinkElement,
  CountdownTimerElement
} from '../models/index.js';
import { appEvents, AppEvents } from '../utils/events.js';
import { centerOnCanvas } from '../utils/positioning.js';
import { toast } from '../utils/toasts.js';

export class ElementController {
  /**
   * Create element controller
   * @param {EditorController} editorController - Editor controller instance
   */
  constructor(editorController) {
    this.editor = editorController;

    /** @type {Set<Element>} */
    this._selectedElements = new Set();

    // Interaction handlers (will be set externally)
    this.dragHandler = null;
    this.resizeHandler = null;
    this.rotateHandler = null;
    this.cropHandler = null;

    /** @type {boolean} Whether crop mode is active */
    this._cropMode = false;

    // Clipboard
    this.clipboard = null;
  }

  /**
   * Backward-compatible getter: returns first selected element or null
   * @returns {Element|null}
   */
  get selectedElement() {
    if (this._selectedElements.size === 0) return null;
    return this._selectedElements.values().next().value;
  }

  /**
   * Backward-compatible setter: clears selection and selects one element
   * @param {Element|null} el
   */
  set selectedElement(el) {
    this._selectedElements.clear();
    if (el) this._selectedElements.add(el);
  }

  /**
   * Get all selected elements as an array
   * @returns {Element[]}
   */
  get selectedElements() {
    return Array.from(this._selectedElements);
  }

  /**
   * Check if multiple elements are selected
   * @returns {boolean}
   */
  get hasMultiSelection() {
    return this._selectedElements.size > 1;
  }

  /**
   * Check if a specific element is currently selected
   * @param {Element} element - Element to check
   * @returns {boolean}
   */
  isSelected(element) {
    return this._selectedElements.has(element);
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
    const currentSlide = this.editor.getActiveSlide();
    currentSlide.addElement(element);

    // Re-render and select
    this.editor.slideController.renderCurrentSlide();
    this.selectElement(element);

    appEvents.emit(AppEvents.ELEMENT_ADDED, element);

    toast.success(`${type} element added`);
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
      link: LinkElement,
      countdown_timer: CountdownTimerElement
    };

    return classes[type] || TextElement;
  }

  /**
   * Delete element
   * @param {string} elementId - Element ID
   */
  deleteElement(elementId) {
    const currentSlide = this.editor.getActiveSlide();
    const success = currentSlide.removeElement(elementId);

    if (success) {
      // Remove from selection set
      for (const el of this._selectedElements) {
        if (el.id === elementId) {
          this._selectedElements.delete(el);
          break;
        }
      }

      this.editor.slideController.renderCurrentSlide();
      appEvents.emit(AppEvents.ELEMENT_REMOVED, elementId);

      toast.success('Element deleted');
    }
  }

  /**
   * Delete all currently selected elements
   */
  deleteSelectedElements() {
    if (this._selectedElements.size === 0) return;

    const currentSlide = this.editor.getActiveSlide();
    const ids = this.selectedElements.map((el) => el.id);

    ids.forEach((id) => {
      currentSlide.removeElement(id);
      appEvents.emit(AppEvents.ELEMENT_REMOVED, id);
    });

    this._selectedElements.clear();

    this.editor.slideController.renderCurrentSlide();
    this._updateSelectionUI();
    this.editor.recordHistory();

    const label = ids.length === 1 ? 'Element deleted' : `${ids.length} elements deleted`;
    toast.success(label);
  }

  /**
   * Select a single element (clears previous selection)
   * @param {Element} element - Element to select
   */
  selectElement(element) {
    // Deselect all previous
    this.deselectAll();

    // Select new
    this._selectedElements.add(element);
    const elementDOM = document.getElementById(element.id);

    if (elementDOM) {
      elementDOM.classList.add('selected');
      this.addHandles(elementDOM);

      // Switch to Element tab automatically
      this.switchToElementTab();

      // Update properties panel
      if (this.editor.uiManager && this.editor.uiManager.rightSidebar) {
        this.editor.uiManager.rightSidebar.updateProperties(element);
      }

      appEvents.emit(AppEvents.ELEMENT_SELECTED, element);
    }
  }

  /**
   * Add element to current selection (no handles, just outline)
   * @param {Element} element - Element to add
   */
  addToSelection(element) {
    if (this._selectedElements.has(element)) return;

    this._selectedElements.add(element);
    const elementDOM = document.getElementById(element.id);

    if (elementDOM) {
      elementDOM.classList.add('selected');
    }

    this._updateSelectionUI();
  }

  /**
   * Remove element from current selection
   * @param {Element} element - Element to remove
   */
  removeFromSelection(element) {
    if (!this._selectedElements.has(element)) return;

    this._selectedElements.delete(element);
    const elementDOM = document.getElementById(element.id);

    if (elementDOM) {
      elementDOM.classList.remove('selected');
      this.removeHandles(elementDOM);
    }

    this._updateSelectionUI();
  }

  /**
   * Toggle element selection (Ctrl+Click behavior)
   * @param {Element} element - Element to toggle
   */
  toggleSelection(element) {
    if (this._selectedElements.has(element)) {
      this.removeFromSelection(element);
    } else {
      this.addToSelection(element);
    }
  }

  /**
   * Deselect all elements
   */
  deselectAll() {
    // Exit crop mode first if active
    if (this._cropMode) {
      this.exitCropMode();
    }

    for (const el of this._selectedElements) {
      const dom = document.getElementById(el.id);
      if (dom) {
        dom.classList.remove('selected');
        this.removeHandles(dom);
      }
    }

    this._selectedElements.clear();

    // Clear properties panel
    if (this.editor.uiManager && this.editor.uiManager.rightSidebar) {
      this.editor.uiManager.rightSidebar.clearProperties();
    }

    appEvents.emit(AppEvents.ELEMENT_DESELECTED);
  }

  /**
   * Alias for backward compatibility
   */
  deselectElement() {
    this.deselectAll();
  }

  /**
   * Enter crop mode for the given element
   * @param {Element} element - Element to crop
   */
  enterCropMode(element) {
    if (!this.cropHandler || !this.cropHandler.canCrop(element)) return;

    const dom = document.getElementById(element.id);
    if (!dom) return;

    this._cropMode = true;

    // Remove existing transform handles
    this.removeHandles(dom);

    // Enter crop mode in the handler
    this.cropHandler.enterCropMode(element, dom);
  }

  /**
   * Exit crop mode and return to normal transform mode
   */
  exitCropMode() {
    if (!this._cropMode) return;

    this._cropMode = false;

    if (this.cropHandler) {
      this.cropHandler.exitCropMode();
    }
  }

  /**
   * Update UI after selection changes (handles, properties panel)
   */
  _updateSelectionUI() {
    const size = this._selectedElements.size;

    if (size === 0) {
      // Clear properties
      if (this.editor.uiManager && this.editor.uiManager.rightSidebar) {
        this.editor.uiManager.rightSidebar.clearProperties();
      }
    } else if (size === 1) {
      const el = this.selectedElement;
      const dom = document.getElementById(el.id);

      if (dom) {
        // Ensure handles are present for single selection
        this.removeHandles(dom);
        this.addHandles(dom);
      }

      this.switchToElementTab();

      if (this.editor.uiManager && this.editor.uiManager.rightSidebar) {
        this.editor.uiManager.rightSidebar.updateProperties(el, true);
      }
    } else {
      // Multi-selection: remove all handles, show multi-info
      for (const el of this._selectedElements) {
        const dom = document.getElementById(el.id);
        if (dom) {
          this.removeHandles(dom);
        }
      }

      this.switchToElementTab();

      if (this.editor.uiManager && this.editor.uiManager.rightSidebar) {
        this.editor.uiManager.rightSidebar.showMultiSelectionInfo(size);
      }
    }
  }

  /**
   * Switch to the Element tab in the right sidebar
   */
  switchToElementTab() {
    const tabs = document.querySelector('.tabs');
    if (tabs) {
      const tabsInstance = M.Tabs.getInstance(tabs);
      if (tabsInstance) {
        tabsInstance.select('tab-element');
      }
    }
  }

  /**
   * Attach event handlers to element DOM
   * @param {HTMLElement} elementDOM - Element DOM
   * @param {Element} element - Element model
   */
  attachHandlers(elementDOM, element) {
    // Click to select (with Ctrl+Click support)
    elementDOM.addEventListener('click', (e) => {
      e.stopPropagation();

      // Don't re-select while in crop mode (would exit crop via deselectAll)
      if (this._cropMode) return;

      if (e.ctrlKey || e.metaKey) {
        this.toggleSelection(element);
      } else {
        this.selectElement(element);
      }
    });

    // Double-click to edit text
    if (element.type === 'text') {
      elementDOM.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.enableTextEditing(elementDOM, element);
      });
    }

    // Double-click to enter crop mode for images/videos
    if (element.type === 'image' || element.type === 'video') {
      elementDOM.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.enterCropMode(element);
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
    // Skip if crop mode is active (crop handles managed by CropHandler)
    if (this._cropMode) return;

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
    if (!textContent) return;

    // Enable editing
    textContent.contentEditable = true;
    textContent.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(textContent);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // Disable editing and save on blur
    const updateText = () => {
      textContent.contentEditable = false;
      element.updateText(textContent.innerText);
      this.editor.recordHistory();
      textContent.removeEventListener('blur', updateText);
      appEvents.emit(AppEvents.ELEMENT_UPDATED, element);
    };

    textContent.addEventListener('blur', updateText);
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

    // Re-render only the affected element instead of the entire slide.
    // A full renderCurrentSlide() destroys all DOM nodes, causing media
    // elements (images, video, audio) to flash as they reload.
    const canvas = document.getElementById('slide-canvas');
    const oldDOM = document.getElementById(this.selectedElement.id);

    if (canvas && oldDOM) {
      const activeSlide = this.editor.getActiveSlide();
      const zIndex = activeSlide.elements.indexOf(this.selectedElement);
      const nextSibling = oldDOM.nextSibling;
      oldDOM.remove();

      const newDOM = this.selectedElement.render(zIndex >= 0 ? zIndex : 0);

      // Re-render children
      this.selectedElement.children.forEach((child, childIndex) => {
        const childDOM = child.render(zIndex * 100 + childIndex + 1);
        newDOM.appendChild(childDOM);
        this.attachHandlers(childDOM, child);
      });

      if (nextSibling) {
        canvas.insertBefore(newDOM, nextSibling);
      } else {
        canvas.appendChild(newDOM);
      }

      // Re-attach interaction handlers and selection state
      this.attachHandlers(newDOM, this.selectedElement);
      newDOM.classList.add('selected');
      this.addHandles(newDOM);
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
      toast.success('Element copied');
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

      const currentSlide = this.editor.getActiveSlide();
      currentSlide.addElement(cloned);

      this.editor.slideController.renderCurrentSlide();
      this.selectElement(cloned);
      this.editor.recordHistory();

      toast.success('Element pasted');
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

      const currentSlide = this.editor.getActiveSlide();
      currentSlide.addElement(cloned);

      this.editor.slideController.renderCurrentSlide();
      this.selectElement(cloned);
      this.editor.recordHistory();

      toast.success('Element duplicated');
      appEvents.emit(AppEvents.ELEMENT_ADDED, cloned);
    }
  }

  /**
   * Bring element to front
   */
  bringToFront() {
    if (this.selectedElement) {
      const currentSlide = this.editor.getActiveSlide();
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
      const currentSlide = this.editor.getActiveSlide();
      currentSlide.sendToBack(this.selectedElement.id);

      this.editor.slideController.renderCurrentSlide();
      this.selectElement(this.selectedElement);
      this.editor.recordHistory();
    }
  }

  /**
   * Nudge all selected elements by a pixel offset
   * @param {number} dx - Horizontal delta
   * @param {number} dy - Vertical delta
   */
  nudgeSelected(dx, dy) {
    if (this._selectedElements.size === 0) return;

    for (const el of this._selectedElements) {
      el.position.x += dx;
      el.position.y += dy;

      const dom = document.getElementById(el.id);
      if (dom) {
        dom.style.left = `${el.position.x}px`;
        dom.style.top = `${el.position.y}px`;
      }
    }

    // Update position values in the right sidebar
    if (this._selectedElements.size === 1 && this.editor.uiManager?.rightSidebar) {
      this.editor.uiManager.rightSidebar.updatePositionValues(this.selectedElement);
    }

    this.editor.recordHistory();
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
      toast.error('Failed to update media');
    }
  }
}

export default ElementController;
