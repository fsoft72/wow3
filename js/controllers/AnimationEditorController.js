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
    this._panelVisible = false;
    this._activeTab = 'elements';
  }

  /**
   * Initialize the animation editor controller
   */
  async init() {
    console.log('Initializing AnimationEditorController...');
    this._setupFloatingPanel();

    // Listen for element selection to update the inspector
    appEvents.on(AppEvents.ELEMENT_SELECTED, (element) => {
      this.showInspector(element);
    });

    // Listen for element deselection
    appEvents.on(AppEvents.ELEMENT_DESELECTED, () => {
      this.clearInspector();
    });

    // Refresh build order and elements list when slide changes
    appEvents.on(AppEvents.SLIDE_SELECTED, () => {
      this._renderBuildOrder();
      if (this._activeTab === 'elements') {
        this._renderElementsList();
      }
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
    this._updateAnimTabState();

    if (this._activeTab === 'elements') {
      this._renderElementsList();
    }

    if (this._panelVisible && this._activeTab !== 'elements') {
      this.switchPanelTab('anim');
    }
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
    this._updateAnimTabState();

    if (this._activeTab === 'elements') {
      this._renderElementsList();
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
   * Toggle the floating animations panel open/closed
   */
  togglePanel() {
    if (this._panelVisible) {
      this.hidePanel();
    } else {
      this.showPanel();
    }
  }

  /**
   * Show the floating panel. Restores last position/size or centers on screen.
   */
  showPanel() {
    const panel = document.getElementById('animations-panel');
    const btn = document.getElementById('animations-panel-btn');
    if (!panel) return;

    // Apply remembered size
    if (this._savedWidth) panel.style.width = this._savedWidth;
    if (this._savedHeight) panel.style.height = this._savedHeight;

    // Position: use saved or center on screen
    if (this._savedLeft != null && this._savedTop != null) {
      panel.style.left = this._savedLeft;
      panel.style.top = this._savedTop;
    } else {
      const w = parseInt(panel.style.width) || 520;
      const h = parseInt(panel.style.height) || 500;
      panel.style.left = `${Math.round((window.innerWidth - w) / 2)}px`;
      panel.style.top = `${Math.round((window.innerHeight - h) / 2)}px`;
    }

    panel.classList.add('visible');
    if (btn) btn.classList.add('active');
    this._panelVisible = true;

    // Refresh the active tab content
    if (this._activeTab === 'elements') {
      this._renderElementsList();
    }
  }

  /**
   * Hide the floating panel with fade-out. Remembers position and size.
   */
  hidePanel() {
    const panel = document.getElementById('animations-panel');
    const btn = document.getElementById('animations-panel-btn');
    if (!panel) return;

    // Save current position and size for next open
    this._savedLeft = panel.style.left;
    this._savedTop = panel.style.top;
    this._savedWidth = panel.style.width;
    this._savedHeight = panel.style.height;

    panel.classList.remove('visible');
    if (btn) btn.classList.remove('active');
    this._panelVisible = false;
  }

  /**
   * Switch the active tab in the floating panel
   * @param {string} tabName - Tab name: 'sequence', 'anim', or 'elements'
   */
  switchPanelTab(tabName) {
    this._activeTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.animations-panel-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.panelTab === tabName);
    });

    // Update content panes
    document.querySelectorAll('.animations-panel-content').forEach((pane) => {
      pane.classList.toggle('active', pane.id === `animations-panel-${tabName}`);
    });

    // Render elements list when switching to that tab
    if (tabName === 'elements') {
      this._renderElementsList();
    }
  }

  /**
   * Setup the floating animations panel: bind toggle, close, tab buttons, and drag
   * @private
   */
  _setupFloatingPanel() {
    const toggleBtn = document.getElementById('animations-panel-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.togglePanel());
    }

    const closeBtn = document.querySelector('.animations-panel-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hidePanel());
    }

    document.querySelectorAll('.animations-panel-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        this.switchPanelTab(btn.dataset.panelTab);
      });
    });

    this._setupPanelDrag();
    this._setupPanelResize();
  }

  /**
   * Setup pointer-based dragging on the panel header
   * @private
   */
  _setupPanelDrag() {
    const panel = document.getElementById('animations-panel');
    const header = document.querySelector('.animations-panel-header');
    if (!panel || !header) return;

    header.addEventListener('pointerdown', (e) => {
      // Ignore clicks on buttons inside the header (tabs, close)
      if (e.target.closest('button')) return;

      e.preventDefault();
      const panelRect = panel.getBoundingClientRect();
      const offsetX = e.clientX - panelRect.left;
      const offsetY = e.clientY - panelRect.top;

      const onMove = (ev) => {
        let newLeft = ev.clientX - offsetX;
        let newTop = ev.clientY - offsetY;

        // Clamp to viewport
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - panelRect.width));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - panelRect.height));

        panel.style.left = `${newLeft}px`;
        panel.style.top = `${newTop}px`;
      };

      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  }

  /**
   * Setup pointer-based resizing on the panel resize handle
   * @private
   */
  _setupPanelResize() {
    const panel = document.getElementById('animations-panel');
    const handle = document.querySelector('.animations-panel-resize');
    if (!panel || !handle) return;

    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const panelRect = panel.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = panelRect.width;
      const startHeight = panelRect.height;

      const onMove = (ev) => {
        const newWidth = Math.max(360, startWidth + (ev.clientX - startX));
        const newHeight = Math.max(200, startHeight + (ev.clientY - startY));

        panel.style.width = `${newWidth}px`;
        panel.style.height = `${newHeight}px`;
      };

      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  }

  /**
   * Enable or disable the "Anim" tab based on whether an element is selected.
   * If disabling while on the anim tab, auto-switch to sequence.
   * @private
   */
  _updateAnimTabState() {
    const animTab = document.querySelector('.animations-panel-tab[data-panel-tab="anim"]');
    if (!animTab) return;

    if (this._currentElement) {
      animTab.disabled = false;
    } else {
      animTab.disabled = true;
      if (this._activeTab === 'anim') {
        this.switchPanelTab('elements');
      }
    }
  }

  /**
   * Render the elements list for the "Elements" tab
   * @private
   */
  _renderElementsList() {
    const container = document.getElementById('panel-elements-list');
    if (!container) return;

    const slide = this.editor.getActiveSlide();
    if (!slide || !slide.elements || slide.elements.length === 0) {
      container.innerHTML = '<p class="grey-text center-align" style="padding: 12px; font-size: 12px;">No elements on this slide</p>';
      return;
    }

    const ELEMENT_ICONS = {
      text: 'text_fields',
      image: 'image',
      video: 'videocam',
      audio: 'audiotrack',
      shape: 'crop_square',
      list: 'list',
      link: 'link',
      countdown_timer: 'timer'
    };

    const selectedId = this._currentElement ? this._currentElement.id : null;

    container.innerHTML = slide.elements.map((el) => {
      const icon = ELEMENT_ICONS[el.type] || 'widgets';
      const name = this._getElementLabel(el);
      const isSelected = el.id === selectedId;

      return `<div class="panel-element-item ${isSelected ? 'selected' : ''}" data-element-id="${el.id}">
        <i class="material-icons">${icon}</i>
        <span class="panel-element-name">${name}</span>
        <span class="panel-element-type">${el.type}</span>
        <button class="element-visibility-toggle" data-element-id="${el.id}" title="${el.hiddenInEditor ? 'Show' : 'Hide'} in editor">
          <i class="material-icons">${el.hiddenInEditor ? 'visibility_off' : 'visibility'}</i>
        </button>
      </div>`;
    }).join('');

    // Bind click to select element
    container.querySelectorAll('.panel-element-item').forEach((item) => {
      item.addEventListener('click', () => {
        const elementId = item.dataset.elementId;
        const element = slide.elements.find((el) => el.id === elementId);
        if (!element) return;

        if (this.editor.elementController) {
          this.editor.elementController.selectElement(element);
        }
      });
    });

    // Bind visibility toggle
    container.querySelectorAll('.element-visibility-toggle').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Don't trigger element selection
        const elementId = btn.dataset.elementId;
        if (this.editor.elementController) {
          this.editor.elementController.toggleElementVisibility(elementId);
        }
      });
    });
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

    container.innerHTML = `
      <div class="anim-category-tabs">${tabsHtml}</div>
      <div class="effect-grid">${effectsHtml}</div>
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
            <option value="${ANIMATION_TRIGGER.AFTER_PREVIOUS}" ${anim.trigger === ANIMATION_TRIGGER.AFTER_PREVIOUS ? 'selected' : ''}>Auto</option>
            <option value="${ANIMATION_TRIGGER.ON_CLICK}" ${anim.trigger === ANIMATION_TRIGGER.ON_CLICK ? 'selected' : ''}>On Click</option>
            <option value="${ANIMATION_TRIGGER.WITH_PREVIOUS}" ${anim.trigger === ANIMATION_TRIGGER.WITH_PREVIOUS ? 'selected' : ''}>Chain</option>
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
    if (element.name) return element.name;
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
