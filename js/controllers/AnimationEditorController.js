/**
 * WOW3 Animation Editor Controller
 * Manages the animation editing UI: inspector, build order, preview.
 */

import {
  ANIMATION_CATEGORY,
  ANIMATION_TRIGGER,
  ANIMATION_DEFINITIONS,
  EASING_MAP,
  getDefinitionsForCategory
} from '../animations/definitions.js';
import { AnimationManager } from '../animations/AnimationManager.js';
import { generateId } from '../utils/dom.js';
import { appEvents, AppEvents } from '../utils/events.js';
import { toast } from '../utils/toasts.js';

export class AnimationEditorController {
  /**
   * Create animation editor controller
   * @param {EditorController} editorController - Editor controller instance
   */
  constructor(editorController) {
    this.editor = editorController;
    this._currentElement = null;
    this._currentCategory = ANIMATION_CATEGORY.BUILD_IN;
    this._previewManager = null;
  }

  /**
   * Initialize the animation editor controller
   */
  async init() {
    console.log('Initializing AnimationEditorController...');
    this._setupTabContent();
    this._setupBuildOrderPanel();

    // Listen for element selection to update the inspector
    appEvents.on(AppEvents.ELEMENT_SELECTED, (element) => {
      this.showInspector(element);
    });

    // Listen for element deselection
    appEvents.on(AppEvents.ELEMENT_DESELECTED, () => {
      this.clearInspector();
    });

    // Refresh build order when slide changes
    appEvents.on(AppEvents.SLIDE_SELECTED, () => {
      this._renderBuildOrder();
    });

    console.log('AnimationEditorController initialized');
  }

  /**
   * Show the animation inspector for the given element
   * @param {Object} element - Element model instance
   */
  showInspector(element) {
    this._currentElement = element;
    this._currentCategory = ANIMATION_CATEGORY.BUILD_IN;
    this._renderInspector();
    this._renderBuildOrder();
  }

  /**
   * Clear the inspector when no element is selected
   */
  clearInspector() {
    this._currentElement = null;
    const container = document.getElementById('animation-inspector');
    if (container) {
      container.innerHTML = '<p class="grey-text center-align" style="padding: 20px;">Select an element to add animations</p>';
    }
  }

  /**
   * Switch the active animation category tab
   * @param {string} category - One of ANIMATION_CATEGORY values
   */
  switchCategory(category) {
    this._currentCategory = category;
    this._renderInspector();
  }

  /**
   * Add an animation effect to the current slide's sequence
   * @param {string} animationType - Animation definition key (e.g. 'fadeIn')
   */
  setEffect(animationType) {
    if (!this._currentElement) return;

    const slide = this.editor.getActiveSlide();
    if (!slide) return;

    const definition = ANIMATION_DEFINITIONS[animationType];
    if (!definition) return;

    const anim = {
      id: generateId('anim'),
      targetElementId: this._currentElement.id,
      type: animationType,
      category: this._currentCategory,
      trigger: ANIMATION_TRIGGER.ON_CLICK,
      duration: definition.options.duration || 600,
      delay: 0,
      easing: definition.options.easing || 'ease-in-out'
    };

    slide.addAnimation(anim);
    this.editor.recordHistory();

    this._renderInspector();
    this._renderBuildOrder();
    this._updateTreeBadges();

    toast.success(`Added ${definition.label}`);
    appEvents.emit(AppEvents.ANIMATION_UPDATED, { element: this._currentElement, animation: anim });
  }

  /**
   * Remove an animation step by its ID
   * @param {string} animId - Animation step ID
   */
  removeEffect(animId) {
    const slide = this.editor.getActiveSlide();
    if (!slide) return;

    slide.removeAnimation(animId);
    this.editor.recordHistory();

    this._renderInspector();
    this._renderBuildOrder();
    this._updateTreeBadges();

    appEvents.emit(AppEvents.ANIMATION_UPDATED, {});
  }

  /**
   * Preview a single animation on the canvas
   * @param {string} animationType - Animation definition key
   */
  previewEffect(animationType) {
    if (!this._currentElement) return;

    const canvas = document.getElementById('slide-canvas');
    if (!canvas) return;

    const definition = ANIMATION_DEFINITIONS[animationType];
    if (!definition) return;

    // Clean up previous preview
    if (this._previewManager) {
      this._previewManager.cleanup();
    }

    const previewStep = {
      id: 'preview',
      targetElementId: this._currentElement.id,
      type: animationType,
      category: this._currentCategory,
      trigger: ANIMATION_TRIGGER.ON_LOAD,
      duration: definition.options.duration || 600,
      delay: 0,
      easing: definition.options.easing || 'ease-in-out'
    };

    this._previewManager = new AnimationManager(canvas);
    this._previewManager.loadSequence([previewStep]);
    this._previewManager.play();
  }

  /**
   * Update a property on an animation step
   * @param {string} animId - Animation step ID
   * @param {Object} updates - Properties to update
   */
  updateAnimationStep(animId, updates) {
    const slide = this.editor.getActiveSlide();
    if (!slide) return;

    slide.updateAnimation(animId, updates);
    this.editor.recordHistory();
    this._renderBuildOrder();
  }

  /**
   * Handle drag-and-drop reorder of build order steps
   * @param {number} fromIndex - Source index
   * @param {number} toIndex - Destination index
   */
  handleReorder(fromIndex, toIndex) {
    const slide = this.editor.getActiveSlide();
    if (!slide) return;

    slide.reorderAnimation(fromIndex, toIndex);
    this.editor.recordHistory();
    this._renderBuildOrder();
  }

  // ==================== PRIVATE ====================

  /**
   * Setup the animation tab content area
   * @private
   */
  _setupTabContent() {
    const tabContent = document.getElementById('tab-animation');
    if (!tabContent) return;

    tabContent.innerHTML = `
      <div id="animation-inspector">
        <p class="grey-text center-align" style="padding: 20px;">Select an element to add animations</p>
      </div>
    `;
  }

  /**
   * Setup the build order panel
   * @private
   */
  _setupBuildOrderPanel() {
    const panel = document.getElementById('build-order-panel');
    if (!panel) return;

    // Toggle visibility
    const toggleBtn = document.getElementById('toggle-build-order');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('visible');
      });
    }
  }

  /**
   * Render the animation inspector for the current element
   * @private
   */
  _renderInspector() {
    const container = document.getElementById('animation-inspector');
    if (!container || !this._currentElement) return;

    const slide = this.editor.getActiveSlide();
    const elementAnims = slide ? slide.getAnimationsForElement(this._currentElement.id) : [];

    // Category tabs
    const categories = [
      { key: ANIMATION_CATEGORY.BUILD_IN, label: 'Build In', icon: 'login' },
      { key: ANIMATION_CATEGORY.ACTION, label: 'Action', icon: 'animation' },
      { key: ANIMATION_CATEGORY.BUILD_OUT, label: 'Build Out', icon: 'logout' }
    ];

    const tabsHtml = categories.map((cat) => {
      const active = cat.key === this._currentCategory ? 'active' : '';
      return `<button class="anim-category-tab ${active} category-${cat.key}" data-category="${cat.key}">
        <i class="material-icons">${cat.icon}</i> ${cat.label}
      </button>`;
    }).join('');

    // Effect grid
    const defs = getDefinitionsForCategory(this._currentCategory);
    const effectsHtml = defs.map((def) => {
      const isApplied = elementAnims.some((a) => a.type === def.key);
      return `<div class="effect-card ${isApplied ? 'applied' : ''}" data-type="${def.key}">
        <span class="effect-label">${def.label}</span>
        <div class="effect-actions">
          <button class="effect-preview-btn" data-type="${def.key}" title="Preview">
            <i class="material-icons">play_circle</i>
          </button>
          <button class="effect-add-btn" data-type="${def.key}" title="Add">
            <i class="material-icons">add_circle</i>
          </button>
        </div>
      </div>`;
    }).join('');

    // Current element's animations list
    const animListHtml = elementAnims.length > 0
      ? elementAnims.map((a, idx) => {
        const def = ANIMATION_DEFINITIONS[a.type];
        const isAuto = a.trigger !== ANIMATION_TRIGGER.ON_CLICK;
        return `<div class="anim-list-item" data-anim-id="${a.id}" data-anim-index="${idx}">
          <i class="material-icons anim-list-drag-handle">drag_indicator</i>
          <span class="anim-list-type">${def ? def.label : a.type}</span>
          <button class="anim-trigger-toggle ${isAuto ? 'is-auto' : 'is-click'}" data-anim-id="${a.id}" title="${isAuto ? 'Auto (plays automatically)' : 'On Click (waits for advance)'}">
            ${isAuto ? 'Auto' : 'Click'}
          </button>
          <button class="anim-remove-btn" data-anim-id="${a.id}" title="Remove">
            <i class="material-icons">close</i>
          </button>
        </div>`;
      }).join('')
      : '<p class="grey-text" style="font-size: 12px; padding: 4px;">No animations on this element</p>';

    container.innerHTML = `
      <div class="anim-category-tabs">${tabsHtml}</div>
      <div class="effect-grid">${effectsHtml}</div>
      <div class="anim-element-list">
        <h6 style="font-size: 13px; margin: 12px 0 6px;">Current Animations</h6>
        ${animListHtml}
      </div>
    `;

    // Bind events
    container.querySelectorAll('.anim-category-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.switchCategory(btn.dataset.category);
      });
    });

    container.querySelectorAll('.effect-add-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setEffect(btn.dataset.type);
      });
    });

    container.querySelectorAll('.effect-preview-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.previewEffect(btn.dataset.type);
      });
    });

    container.querySelectorAll('.anim-remove-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeEffect(btn.dataset.animId);
      });
    });

    // Trigger toggle (auto <-> click)
    container.querySelectorAll('.anim-trigger-toggle').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const animId = btn.dataset.animId;
        const slide = this.editor.getActiveSlide();
        if (!slide) return;
        const anim = slide.animationSequence.find((a) => a.id === animId);
        if (!anim) return;

        const isCurrentlyAuto = anim.trigger !== ANIMATION_TRIGGER.ON_CLICK;
        const newTrigger = isCurrentlyAuto ? ANIMATION_TRIGGER.ON_CLICK : ANIMATION_TRIGGER.AFTER_PREVIOUS;
        this.updateAnimationStep(animId, { trigger: newTrigger });
        this._renderInspector();
      });
    });

    // Drag-and-drop reorder for current animations list (vertical-only)
    this._setupAnimListDrag(container);
  }

  /**
   * Render the build order panel showing the full slide animation sequence
   * @private
   */
  _renderBuildOrder() {
    const list = document.getElementById('build-order-list');
    if (!list) return;

    const slide = this.editor.getActiveSlide();
    if (!slide || slide.animationSequence.length === 0) {
      list.innerHTML = '<p class="grey-text center-align" style="padding: 12px; font-size: 12px;">No animations on this slide</p>';
      return;
    }

    list.innerHTML = slide.animationSequence.map((anim, idx) => {
      const def = ANIMATION_DEFINITIONS[anim.type];
      const label = def ? def.label : anim.type;
      const isWithPrev = anim.trigger === ANIMATION_TRIGGER.WITH_PREVIOUS;

      // Find element name
      const targetEl = slide.getElement(anim.targetElementId);
      const elName = targetEl ? this._getElementLabel(targetEl) : '(deleted)';

      return `<div class="build-order-card ${isWithPrev ? 'indented' : ''}"
                   data-index="${idx}" data-anim-id="${anim.id}" draggable="true">
        <span class="build-order-num">${idx + 1}</span>
        <div class="build-order-info">
          <span class="build-order-label">${label}</span>
          <span class="build-order-target">${elName}</span>
        </div>
        <div class="build-order-controls">
          <select class="build-order-trigger browser-default" data-anim-id="${anim.id}">
            <option value="${ANIMATION_TRIGGER.AFTER_PREVIOUS}" ${anim.trigger !== ANIMATION_TRIGGER.ON_CLICK ? 'selected' : ''}>Auto</option>
            <option value="${ANIMATION_TRIGGER.ON_CLICK}" ${anim.trigger === ANIMATION_TRIGGER.ON_CLICK ? 'selected' : ''}>On Click</option>
          </select>
          <input type="number" class="build-order-duration browser-default"
                 data-anim-id="${anim.id}" value="${anim.duration}"
                 min="100" max="5000" step="100" title="Duration (ms)">
          <button class="build-order-remove" data-anim-id="${anim.id}" title="Remove">
            <i class="material-icons">close</i>
          </button>
        </div>
      </div>`;
    }).join('');

    // Bind events
    list.querySelectorAll('.build-order-trigger').forEach((select) => {
      select.addEventListener('change', () => {
        this.updateAnimationStep(select.dataset.animId, { trigger: select.value });
      });
    });

    list.querySelectorAll('.build-order-duration').forEach((input) => {
      input.addEventListener('change', () => {
        this.updateAnimationStep(input.dataset.animId, { duration: parseInt(input.value) || 600 });
      });
    });

    list.querySelectorAll('.build-order-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.removeEffect(btn.dataset.animId);
      });
    });

    // Drag and drop reorder
    this._setupDragReorder(list);
  }

  /**
   * Setup pointer-based vertical-only drag-and-drop for the "Current Animations" list.
   * Uses pointer events so we can constrain to the Y axis.
   * @param {HTMLElement} container - The animation inspector container
   * @private
   */
  _setupAnimListDrag(container) {
    const items = container.querySelectorAll('.anim-list-item');
    if (items.length < 2) return;

    items.forEach((item) => {
      const handle = item.querySelector('.anim-list-drag-handle');
      if (!handle) return;

      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const listParent = item.parentElement;
        const siblings = Array.from(listParent.querySelectorAll('.anim-list-item'));
        const startIndex = siblings.indexOf(item);
        const startY = e.clientY;
        const itemRect = item.getBoundingClientRect();
        const parentRect = listParent.getBoundingClientRect();

        // Create a clone to drag visually
        const ghost = item.cloneNode(true);
        ghost.classList.add('anim-list-ghost');
        ghost.style.position = 'fixed';
        ghost.style.left = `${itemRect.left}px`;
        ghost.style.top = `${itemRect.top}px`;
        ghost.style.width = `${itemRect.width}px`;
        ghost.style.zIndex = '10000';
        ghost.style.pointerEvents = 'none';
        document.body.appendChild(ghost);

        // Mark the original as placeholder
        item.classList.add('anim-list-placeholder');

        let currentIndex = startIndex;

        const onMove = (ev) => {
          const dy = ev.clientY - startY;
          // Move ghost vertically only
          ghost.style.top = `${itemRect.top + dy}px`;

          // Determine which slot we're over
          for (let i = 0; i < siblings.length; i++) {
            if (i === currentIndex) continue;
            const rect = siblings[i].getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (ev.clientY < midY && i < currentIndex) {
              listParent.insertBefore(item, siblings[i]);
              siblings.splice(currentIndex, 1);
              siblings.splice(i, 0, item);
              currentIndex = i;
              break;
            } else if (ev.clientY > midY && i > currentIndex) {
              const next = siblings[i].nextElementSibling;
              listParent.insertBefore(item, next);
              siblings.splice(currentIndex, 1);
              siblings.splice(i, 0, item);
              currentIndex = i;
              break;
            }
          }
        };

        const onUp = () => {
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          ghost.remove();
          item.classList.remove('anim-list-placeholder');

          if (currentIndex !== startIndex) {
            this._reorderElementAnims(startIndex, currentIndex);
          }
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      });
    });
  }

  /**
   * Reorder animations for the current element within the slide's global sequence.
   * Maps local element-anim indices to global sequence indices and calls handleReorder.
   * @param {number} localFrom - Source index within element's animations
   * @param {number} localTo - Destination index within element's animations
   * @private
   */
  _reorderElementAnims(localFrom, localTo) {
    if (!this._currentElement) return;
    const slide = this.editor.getActiveSlide();
    if (!slide) return;

    // Build a map of local index -> global index for this element's animations
    const globalIndices = [];
    slide.animationSequence.forEach((a, i) => {
      if (a.targetElementId === this._currentElement.id) {
        globalIndices.push(i);
      }
    });

    if (localFrom >= globalIndices.length || localTo >= globalIndices.length) return;

    const globalFrom = globalIndices[localFrom];
    const globalTo = globalIndices[localTo];
    this.handleReorder(globalFrom, globalTo);
    this._renderInspector();
  }

  /**
   * Setup drag-and-drop reordering on build order cards
   * @param {HTMLElement} list - The list container
   * @private
   */
  _setupDragReorder(list) {
    let dragSrcIndex = null;

    list.querySelectorAll('.build-order-card').forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        dragSrcIndex = parseInt(card.dataset.index);
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        const toIndex = parseInt(card.dataset.index);
        if (dragSrcIndex !== null && dragSrcIndex !== toIndex) {
          this.handleReorder(dragSrcIndex, toIndex);
        }
        dragSrcIndex = null;
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        list.querySelectorAll('.drag-over').forEach((c) => c.classList.remove('drag-over'));
      });
    });
  }

  /**
   * Update animation badges on elements tree items
   * @private
   */
  _updateTreeBadges() {
    if (this.editor.uiManager && this.editor.uiManager.elementsTree) {
      const activeSlide = this.editor.getActiveSlide();
      this.editor.uiManager.elementsTree.render(activeSlide.elements);
    }
  }

  /**
   * Get a short label for an element
   * @param {Object} element - Element model
   * @returns {string}
   * @private
   */
  _getElementLabel(element) {
    if (!element) return 'Unknown';
    switch (element.type) {
      case 'text': return element.properties.text?.substring(0, 15) || 'Text';
      case 'image': return 'Image';
      case 'video': return 'Video';
      case 'audio': return 'Audio';
      case 'shape': return `Shape (${element.properties.shapeType})`;
      case 'list': return 'List';
      case 'link': return element.properties.text || 'Link';
      default: return element.type;
    }
  }
}

export default AnimationEditorController;
