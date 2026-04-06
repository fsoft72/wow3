import { appEvents, AppEvents } from '@wow/core/utils/events.js';
import { DragHandler, ResizeHandler, RotateHandler, MarqueeHandler, CropHandler } from '@wow/core/interactions';

/**
 * Bridges wow-core interaction handlers with the clip-based model.
 * Implements the ElementController API surface that DragHandler,
 * ResizeHandler, RotateHandler, and MarqueeHandler expect.
 */
export class ClipController {
  /**
   * @param {import('./TimelineController.js').TimelineController} timeline
   * @param {import('../views/CanvasRenderer.js').CanvasRenderer} canvasRenderer
   */
  constructor(timeline, canvasRenderer) {
    this.timeline = timeline;
    this.canvasRenderer = canvasRenderer;

    /** @type {Set<import('@wow/core/models/Element.js').Element>} */
    this._selectedElements = new Set();
    this._cropMode = false;

    // Interaction handlers (initialized in init())
    this.dragHandler = null;
    this.resizeHandler = null;
    this.rotateHandler = null;
    this.cropHandler = null;
    this.marqueeHandler = null;

    /** @type {Function|null} Set by app.js to access HistoryManager */
    this.onRecordHistory = null;

    /** @type {Function|null} Set by app.js to update properties panel */
    this.onSelectionChanged = null;

    // Editor facade — the interface wow-core handlers expect
    this.editor = this._createEditorFacade();
  }

  /**
   * Initialize interaction handlers and connect to canvas.
   */
  init() {
    this.dragHandler = new DragHandler(this);
    this.resizeHandler = new ResizeHandler(this);
    this.rotateHandler = new RotateHandler(this);
    this.cropHandler = new CropHandler(this);
    this.marqueeHandler = new MarqueeHandler(this);
    this.marqueeHandler.init();

    // When CanvasRenderer creates an element, attach our handlers
    this.canvasRenderer.onElementCreated = (clip, element, dom) => {
      this.attachHandlers(dom, element);
    };

    this.canvasRenderer.onElementRemoved = (clipId, element) => {
      // If the removed element was selected, deselect it
      if (this._selectedElements.has(element)) {
        this._selectedElements.delete(element);
        this._notifySelectionChanged();
      }
    };
  }

  // ── Selection API (expected by wow-core handlers) ──

  /** @returns {import('@wow/core/models/Element.js').Element|null} */
  get selectedElement() {
    if (this._selectedElements.size === 0) return null;
    return this._selectedElements.values().next().value;
  }

  /** @returns {import('@wow/core/models/Element.js').Element[]} */
  get selectedElements() {
    return [...this._selectedElements];
  }

  /**
   * @param {import('@wow/core/models/Element.js').Element} element
   * @returns {boolean}
   */
  isSelected(element) {
    return this._selectedElements.has(element);
  }

  /**
   * Select a single element (clears previous selection).
   * @param {import('@wow/core/models/Element.js').Element} element
   */
  selectElement(element) {
    this.deselectAll();
    this._selectedElements.add(element);

    const dom = document.getElementById(element.id);
    if (dom) {
      dom.classList.add('selected');
      this._addHandles(dom, element);
    }

    // Also select the clip on the timeline
    const clipId = this.canvasRenderer.getClipIdForElement(element.id);
    if (clipId) {
      this.timeline.selectedClipId = clipId;
    }

    this._notifySelectionChanged();
    appEvents.emit(AppEvents.ELEMENT_SELECTED, element);
  }

  /**
   * Add element to current selection.
   * @param {import('@wow/core/models/Element.js').Element} element
   */
  addToSelection(element) {
    if (this._selectedElements.has(element)) return;
    this._selectedElements.add(element);
    const dom = document.getElementById(element.id);
    if (dom) dom.classList.add('selected');
    this._notifySelectionChanged();
  }

  /**
   * Deselect all elements.
   */
  deselectAll() {
    for (const el of this._selectedElements) {
      const dom = document.getElementById(el.id);
      if (dom) {
        dom.classList.remove('selected');
        this._removeHandles(dom);
      }
    }
    this._selectedElements.clear();
    this.timeline.selectedClipId = null;
    this._notifySelectionChanged();
    appEvents.emit(AppEvents.ELEMENT_DESELECTED);
  }

  // ── Element operations ──

  /**
   * Attach click, drag, and context menu handlers to a rendered element.
   * @param {HTMLElement} dom
   * @param {import('@wow/core/models/Element.js').Element} element
   */
  attachHandlers(dom, element) {
    if (dom._clipHandlerAttached) return;
    dom._clipHandlerAttached = true;

    dom.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        if (this.isSelected(element)) {
          this._selectedElements.delete(element);
          dom.classList.remove('selected');
          this._removeHandles(dom);
        } else {
          this.addToSelection(element);
        }
        this._notifySelectionChanged();
      } else {
        this.selectElement(element);
      }
    });

    // Double-click to edit text
    if (element.type === 'text') {
      dom.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.enableTextEditing(dom, element);
      });
    }

    if (this.dragHandler) {
      this.dragHandler.attach(dom, element);
    }
  }

  /**
   * Enable inline text editing on a text element.
   * @param {HTMLElement} dom
   * @param {import('@wow/core/models/Element.js').Element} element
   */
  enableTextEditing(dom, element) {
    const textContent = dom.querySelector('.text-content');
    if (!textContent) return;

    textContent.contentEditable = true;
    textContent.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(textContent);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    const finish = () => {
      textContent.contentEditable = false;
      element.updateText(textContent.innerText);

      // Sync back to clip model
      const clipId = this.canvasRenderer.getClipIdForElement(element.id);
      if (clipId) {
        this._syncElementToClip(clipId, element);
      }

      this.editor.recordHistory();
      textContent.removeEventListener('blur', finish);
      appEvents.emit(AppEvents.ELEMENT_UPDATED, element);
    };

    textContent.addEventListener('blur', finish);
  }

  /**
   * Update an element property and sync back to clip.
   * Called by wow-core panels via window.app.editor.elementController.updateElementProperty().
   * @param {string} propertyPath - e.g. 'properties.font.size'
   * @param {*} value
   */
  updateElementProperty(propertyPath, value) {
    const element = this.selectedElement;
    if (!element) return;

    // Navigate the property path and set value
    const parts = propertyPath.split('.');
    let target = element;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!target[parts[i]]) target[parts[i]] = {};
      target = target[parts[i]];
    }
    target[parts[parts.length - 1]] = value;

    // Sync element properties back to clip
    const clipId = this.canvasRenderer.getClipIdForElement(element.id);
    if (clipId) {
      this._syncElementToClip(clipId, element);
    }

    // Re-render element on canvas
    if (clipId) {
      const result = this.canvasRenderer.rerenderClip(clipId);
      if (result) {
        // Re-select the new element
        this._selectedElements.clear();
        this._selectedElements.add(result.element);
        result.dom.classList.add('selected');
        this._addHandles(result.dom, result.element);
      }
    }

    this.editor.recordHistory();
    appEvents.emit(AppEvents.ELEMENT_UPDATED, element);
  }

  /**
   * Called by DragHandler after drag ends — sync position from DOM back to model.
   * @param {import('@wow/core/models/Element.js').Element} element
   */
  updateElementFromDOM(element) {
    const clipId = this.canvasRenderer.getClipIdForElement(element.id);
    if (clipId) {
      this.canvasRenderer.syncElementToClip(clipId);
      this.timeline.project.touch();
    }
  }

  // ── Private helpers ──

  /** @private */
  _addHandles(dom, element) {
    if (this._cropMode) return;
    // Remove old handles first
    this._removeHandles(dom);

    const directions = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    for (const dir of directions) {
      const handle = document.createElement('div');
      handle.className = `resize-handle ${dir}`;
      handle.dataset.direction = dir;
      dom.appendChild(handle);
      if (this.resizeHandler) {
        this.resizeHandler.attach(handle, element);
      }
    }

    const rotateHandle = document.createElement('div');
    rotateHandle.className = 'rotate-handle';
    dom.appendChild(rotateHandle);
    if (this.rotateHandler) {
      this.rotateHandler.attach(rotateHandle, element);
    }
  }

  /** @private */
  _removeHandles(dom) {
    dom.querySelectorAll('.resize-handle, .rotate-handle').forEach(h => h.remove());
  }

  /** @private */
  _syncElementToClip(clipId, element) {
    const clip = this._findClip(clipId);
    if (!clip) return;

    // Sync position
    clip.position.x = element.position.x;
    clip.position.y = element.position.y;
    clip.position.width = element.position.width;
    clip.position.height = element.position.height;
    clip.position.rotation = element.position.rotation;

    // Sync element-specific properties
    clip.properties = structuredClone(element.properties);
    this.timeline.project.touch();
  }

  /** @private */
  _findClip(clipId) {
    for (const track of this.timeline.project.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) return clip;
    }
    return null;
  }

  /** @private */
  _notifySelectionChanged() {
    if (this.onSelectionChanged) {
      const clipId = this.selectedElement
        ? this.canvasRenderer.getClipIdForElement(this.selectedElement.id)
        : null;
      this.onSelectionChanged(clipId, this.selectedElement);
    }
  }

  /**
   * Creates the editor facade expected by wow-core handlers.
   * @private
   */
  _createEditorFacade() {
    const self = this;
    return {
      recordHistory() {
        if (self.onRecordHistory) self.onRecordHistory();
      },
      getActiveSlide() {
        // Return a mock slide with the currently visible elements
        return {
          elements: [...self.canvasRenderer._activeElements.values()]
        };
      },
      get presentation() {
        return {
          getCurrentSlide() {
            return {
              elements: [...self.canvasRenderer._activeElements.values()]
            };
          }
        };
      },
      get uiManager() {
        return {
          rightSidebar: {
            updatePositionValues(element) {
              // Sync position change from drag/resize to clip
              const clipId = self.canvasRenderer.getClipIdForElement(element.id);
              if (clipId) {
                self.canvasRenderer.syncElementToClip(clipId);
              }
              if (self.onSelectionChanged) {
                self.onSelectionChanged(
                  self.timeline.selectedClipId,
                  self.selectedElement
                );
              }
            },
            updateProperties(element, force) {
              if (self.onSelectionChanged) {
                const clipId = self.canvasRenderer.getClipIdForElement(element.id);
                self.onSelectionChanged(clipId, element);
              }
            }
          }
        };
      }
    };
  }
}
