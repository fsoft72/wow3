/**
 * WOW3 Element Controller
 * Manages element operations and interactions
 */

import {
  Element,
  TextElement,
  ImageElement,
  VideoElement,
  AudioElement,
  ShapeElement,
  ListElement,
  LinkElement,
  CountdownTimerElement,
  EmptyElement
} from '../models/index.js';
import { generateId } from '../utils/dom.js';
import { appEvents, AppEvents } from '../utils/events.js';
import { centerOnCanvas } from '../utils/positioning.js';
import { toast } from '../utils/toasts.js';
import { CANVAS } from '../utils/constants.js';

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

    /** @type {{ elements: Object[], boundingBox: { x: number, y: number, width: number, height: number } } | null} */
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
      countdown_timer: CountdownTimerElement,
      empty: EmptyElement
    };

    return classes[type] || TextElement;
  }

  /**
   * Delete element
   * @param {string} elementId - Element ID
   */
  deleteElement(elementId) {
    const currentSlide = this.editor.getActiveSlide();

    // Unregister from AudioManager if it's an audio element
    if (window.AudioManager) {
      window.AudioManager.unregister(elementId);
    }

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
      // Unregister from AudioManager if it's an audio element
      if (window.AudioManager) {
        window.AudioManager.unregister(id);
      }

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
   * Toggle element visibility in editor (does not affect playback)
   * @param {string} elementId - Element ID to toggle
   */
  toggleElementVisibility(elementId) {
    const slide = this.editor.getActiveSlide();
    if (!slide) return;

    const element = slide.getElement(elementId);
    if (!element) return;

    // Toggle visibility
    element.hiddenInEditor = !element.hiddenInEditor;

    // If element is currently selected and being hidden, deselect it
    if (element.hiddenInEditor && this._selectedElements.has(element)) {
      this.deselectElement(element);
    }

    // Record history for undo/redo
    this.editor.recordHistory();

    // Re-render canvas to show/hide element
    this.editor.slideController.renderCurrentSlide();

    // Re-render elements list to update eye icon
    if (this.editor.animationEditorController) {
      this.editor.animationEditorController._renderElementsList();
    }

    toast.info(element.hiddenInEditor ? 'Element hidden in editor' : 'Element visible in editor');
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
   * Show context menu for an element
   * @param {MouseEvent} e - Mouse event
   * @param {Element} element - Element to show menu for
   */
  showElementContextMenu(e, element) {
    ContextMenu.show(e, [
      {
        label: 'Duplicate',
        icon: 'content_copy',
        action: () => {
          this.selectElement(element);
          this.duplicateSelectedElements();
        }
      },
      {
        label: element.hiddenInEditor ? 'Show' : 'Hide',
        icon: element.hiddenInEditor ? 'visibility' : 'visibility_off',
        action: () => {
          this.toggleElementVisibility(element.id);
        }
      },
      { divider: true },
      {
        label: 'Delete',
        icon: 'delete',
        action: () => {
          this.selectElement(element);
          this.deleteSelectedElements();
        }
      }
    ], { theme: 'light' });
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
    // Click to select (with Ctrl/Shift+Click support)
    elementDOM.addEventListener('click', (e) => {
      e.stopPropagation();

      // Skip hidden elements
      if (element.hiddenInEditor) return;

      // Don't re-select while in crop mode (would exit crop via deselectAll)
      if (this._cropMode) return;

      // If the drag handler already changed selection on mousedown, skip
      if (this.dragHandler && this.dragHandler._handledSelection) {
        this.dragHandler._handledSelection = false;
        return;
      }

      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        this.toggleSelection(element);
      } else {
        this.selectElement(element);
      }
    });

    // Right-click to show context menu
    elementDOM.addEventListener('contextmenu', (e) => {
      // Skip hidden elements
      if (element.hiddenInEditor) return;

      this.showElementContextMenu(e, element);
    });

    // Double-click to edit text
    if (element.type === 'text') {
      elementDOM.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.enableTextEditing(elementDOM, element);
      });
    }

    // Double-click on images/videos: open Media Manager if empty, crop mode if has media
    if (element.type === 'image' || element.type === 'video') {
      elementDOM.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (!element.properties.url) {
          this._openMediaManagerFor(element);
        } else {
          this.enterCropMode(element);
        }
      });
    }

    // Double-click on empty audio: open Media Manager
    if (element.type === 'audio') {
      elementDOM.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (!element.properties.url) {
          this._openMediaManagerFor(element);
        }
      });
    }

    // Attach drag handler so any element can initiate a drag (including multi-selection)
    if (this.dragHandler) {
      this.dragHandler.attach(elementDOM, element);
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

    // Empty elements have no resize or rotate handles
    if (this.selectedElement && this.selectedElement.type === 'empty') return;

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

      // Remove ALL DOM nodes with this ID to prevent duplicates
      canvas.querySelectorAll(`#${CSS.escape(this.selectedElement.id)}`).forEach(el => el.remove());

      const newDOM = this.selectedElement.render(zIndex >= 0 ? zIndex : 0);

      // Re-render children
      this.selectedElement.children.forEach((child, childIndex) => {
        const childDOM = child.render(zIndex * 100 + childIndex + 1);
        newDOM.appendChild(childDOM);
        this.attachHandlers(childDOM, child);
      });

      if (nextSibling && nextSibling.parentNode === canvas) {
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
   * Sync a style property across ALL countdown_timer elements in the presentation.
   * Called by the panel after changing a visual property so every timer looks identical.
   * @param {string} property - Property path relative to the element (e.g. 'properties.font.size')
   * @param {*} value - New value
   */
  syncCountdownTimerStyle(property, value) {
    const presentation = this.editor.presentation;
    if (!presentation) return;

    const paths = property.split('.');

    const applyToElement = (el) => {
      if (el.type !== 'countdown_timer') return;
      // Skip the currently selected element (already updated by updateElementProperty)
      if (this.selectedElement && el.id === this.selectedElement.id) return;

      let target = el;
      for (let i = 0; i < paths.length - 1; i++) {
        target = target[paths[i]];
        if (!target) return;
      }
      target[paths[paths.length - 1]] = value;
    };

    // Walk all slides
    for (const slide of presentation.slides) {
      for (const el of slide.elements) {
        applyToElement(el);
      }
    }

    // Walk shells
    for (const shell of presentation.shells) {
      for (const el of shell.elements) {
        applyToElement(el);
      }
    }
  }

  /**
   * Compute the axis-aligned bounding box for an array of elements
   * @param {Element[]} elements - Elements to measure
   * @returns {{ x: number, y: number, width: number, height: number }}
   * @private
   */
  _computeBoundingBox(elements) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const el of elements) {
      const { x, y, width, height } = el.position;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + width > maxX) maxX = x + width;
      if (y + height > maxY) maxY = y + height;
    }

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  /**
   * Copy all selected elements to clipboard
   */
  copySelectedElements() {
    if (this._selectedElements.size === 0) return;

    const elements = this.selectedElements;
    const snapshots = elements.map((el) => el.toJSON());
    const boundingBox = this._computeBoundingBox(elements);

    this.clipboard = { elements: snapshots, boundingBox };

    const label = elements.length === 1 ? 'Element copied' : `${elements.length} elements copied`;
    toast.success(label);
  }

  /**
   * Cut all selected elements (copy + delete)
   */
  cutSelectedElements() {
    if (this._selectedElements.size === 0) return;

    const elements = this.selectedElements;
    const snapshots = elements.map((el) => el.toJSON());
    const boundingBox = this._computeBoundingBox(elements);

    this.clipboard = { elements: snapshots, boundingBox };

    // Delete all selected elements from the slide
    const currentSlide = this.editor.getActiveSlide();
    const ids = elements.map((el) => el.id);

    ids.forEach((id) => {
      currentSlide.removeElement(id);
      appEvents.emit(AppEvents.ELEMENT_REMOVED, id);
    });

    this._selectedElements.clear();
    this.editor.slideController.renderCurrentSlide();
    this._updateSelectionUI();
    this.editor.recordHistory();

    const label = ids.length === 1 ? 'Element cut' : `${ids.length} elements cut`;
    toast.success(label);
  }

  /**
   * Paste elements from clipboard onto the active slide
   */
  pasteElements() {
    if (!this.clipboard) return;

    const { elements: snapshots, boundingBox } = this.clipboard;
    const currentSlide = this.editor.getActiveSlide();
    const pasted = [];

    for (const snapshot of snapshots) {
      // Deep-clone the snapshot and mint fresh IDs
      const data = JSON.parse(JSON.stringify(snapshot));
      data.id = generateId('element');
      if (data.children) {
        data.children = data.children.map((child) => ({
          ...child,
          id: generateId('element')
        }));
      }

      // Offset relative to bounding-box origin + 20px paste offset
      data.position.x = (data.position.x - boundingBox.x) + boundingBox.x + 20;
      data.position.y = (data.position.y - boundingBox.y) + boundingBox.y + 20;

      const element = Element.fromJSON(data);
      currentSlide.addElement(element);
      pasted.push(element);
    }

    // Shift bounding box so successive pastes cascade (+20, +40, +60...)
    this.clipboard.boundingBox = {
      ...boundingBox,
      x: boundingBox.x + 20,
      y: boundingBox.y + 20
    };

    this.editor.slideController.renderCurrentSlide();

    // Select all pasted elements
    if (pasted.length === 1) {
      this.selectElement(pasted[0]);
    } else {
      this.deselectAll();
      for (const el of pasted) {
        this.addToSelection(el);
      }
    }

    this.editor.recordHistory();

    const label = pasted.length === 1 ? 'Element pasted' : `${pasted.length} elements pasted`;
    toast.success(label);

    for (const el of pasted) {
      appEvents.emit(AppEvents.ELEMENT_ADDED, el);
    }
  }

  /**
   * Duplicate all selected elements with a +20px offset
   */
  duplicateSelectedElements() {
    if (this._selectedElements.size === 0) return;

    const elements = this.selectedElements;
    const currentSlide = this.editor.getActiveSlide();
    const duplicates = [];

    for (const el of elements) {
      const cloned = el.clone();
      cloned.position.x += 20;
      cloned.position.y += 20;
      currentSlide.addElement(cloned);
      duplicates.push(cloned);
    }

    this.editor.slideController.renderCurrentSlide();

    // Select all duplicates
    if (duplicates.length === 1) {
      this.selectElement(duplicates[0]);
    } else {
      this.deselectAll();
      for (const el of duplicates) {
        this.addToSelection(el);
      }
    }

    this.editor.recordHistory();

    const label = duplicates.length === 1 ? 'Element duplicated' : `${duplicates.length} elements duplicated`;
    toast.success(label);

    for (const el of duplicates) {
      appEvents.emit(AppEvents.ELEMENT_ADDED, el);
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
   * Create a media element at a specific position and upload the file
   * @param {string} type - Element type ('image', 'video', 'audio')
   * @param {File} file - File object to upload
   * @param {{ x: number, y: number }} dropPosition - Canvas-relative drop coordinates
   */
  async createMediaElement(type, file, dropPosition) {
    const ElementClass = this.getElementClass(type);
    const element = new ElementClass();

    // Add to current slide
    const currentSlide = this.editor.getActiveSlide();
    currentSlide.addElement(element);

    // Upload file to MediaDB and set URL
    await element.setUrl(file);

    // Auto-resize image/video to actual dimensions before positioning
    if (type === 'image' || type === 'video') {
      await this._autoResizeMedia(element, file);
    }

    // Center element on drop point, clamped to canvas bounds
    element.position.x = Math.max(0, Math.min(
      dropPosition.x - element.position.width / 2,
      CANVAS.WIDTH - element.position.width
    ));
    element.position.y = Math.max(0, Math.min(
      dropPosition.y - element.position.height / 2,
      CANVAS.HEIGHT - element.position.height
    ));

    // Render and select
    await this.editor.slideController.renderCurrentSlide();
    this.selectElement(element);
    this.editor.recordHistory();

    appEvents.emit(AppEvents.ELEMENT_ADDED, element);
    toast.success(`${type} element added`);
  }

  /**
   * Open the Media Manager to pick media for an empty image or video element
   * @param {Element} element - Image or video element without a URL
   */
  _openMediaManagerFor(element) {
    if (typeof MediaManager === 'undefined') return;

    MediaManager.open(async (data) => {
      const mediaId = data.localUrl
        ? data.localUrl.replace('local://', '')
        : data.originalItem?.id;
      if (!mediaId) return;

      await this.updateMediaUrl(element, mediaId);
    });
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

      // Auto-resize image/video elements to match actual dimensions
      if (element.type === 'image' || element.type === 'video') {
        await this._autoResizeMedia(element, source);
      }

      await this.editor.slideController.renderCurrentSlide();
      this.selectElement(element);
      this.editor.recordHistory();
    } catch (error) {
      console.error('Failed to update media URL:', error);
      toast.error('Failed to update media');
    }
  }

  /**
   * Resolve a source (File, Blob, media ID, or URL) to a usable src string
   * @param {Element} element - Element (used to read properties.url as fallback)
   * @param {string|File|Blob} source - Original source passed to setUrl
   * @returns {Promise<{ src: string, objectUrl: string|null }|null>}
   */
  async _resolveMediaSrc(element, source) {
    let src;
    let objectUrl = null;

    if (source instanceof File || source instanceof Blob) {
      objectUrl = URL.createObjectURL(source);
      src = objectUrl;
    } else {
      const url = element.properties.url;
      if (!url) return null;
      if (url.startsWith('media_')) {
        src = await window.MediaDB.getMediaDataURL(url);
      } else {
        src = url;
      }
    }

    if (!src) return null;
    return { src, objectUrl };
  }

  /**
   * Resolve the natural dimensions of an image from a File, media ID, or URL
   * @param {Element} element - Image element (used to read properties.url as fallback)
   * @param {string|File|Blob} source - Original source passed to setUrl
   * @returns {Promise<{ width: number, height: number }|null>}
   */
  async _resolveImageSize(element, source) {
    const resolved = await this._resolveMediaSrc(element, source);
    if (!resolved) return null;

    const { src, objectUrl } = resolved;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = src;
    });
  }

  /**
   * Resolve the natural dimensions of a video from a File, media ID, or URL
   * @param {Element} element - Video element (used to read properties.url as fallback)
   * @param {string|File|Blob} source - Original source passed to setUrl
   * @returns {Promise<{ width: number, height: number }|null>}
   */
  async _resolveVideoSize(element, source) {
    const resolved = await this._resolveMediaSrc(element, source);
    if (!resolved) return null;

    const { src, objectUrl } = resolved;

    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve({ width: video.videoWidth, height: video.videoHeight });
      };
      video.onerror = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      video.src = src;
    });
  }

  /**
   * Auto-resize a media element to match its actual dimensions.
   * Scales down to fit within canvas bounds, preserving aspect ratio.
   * @param {Element} element - Image or video element to resize
   * @param {string|File|Blob} source - Original source passed to setUrl
   */
  async _autoResizeMedia(element, source) {
    const size = element.type === 'video'
      ? await this._resolveVideoSize(element, source)
      : await this._resolveImageSize(element, source);
    if (!size) return;

    let { width, height } = size;

    // Scale down to fit within canvas if larger
    if (width > CANVAS.WIDTH || height > CANVAS.HEIGHT) {
      const scale = Math.min(CANVAS.WIDTH / width, CANVAS.HEIGHT / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    element.position.width = width;
    element.position.height = height;
    element.properties.aspectRatio = size.width / size.height;

    // Clamp position so element stays within canvas
    element.position.x = Math.max(0, Math.min(element.position.x, CANVAS.WIDTH - width));
    element.position.y = Math.max(0, Math.min(element.position.y, CANVAS.HEIGHT - height));
  }
}

export default ElementController;
