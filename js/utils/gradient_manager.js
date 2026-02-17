/**
 * Gradient Manager for WOW3
 * Handles creation, editing, saving and selecting CSS gradients.
 * Follows the same object-literal singleton pattern as MediaManager/PanelUtils.
 */

const STORAGE_KEY = 'wow3_gradients';

/** Default gradient presets seeded on first init */
const DEFAULT_PRESETS = [
  {
    id: 'grad_preset_sunset',
    name: 'Sunset',
    type: 'linear',
    angle: 135,
    stops: [
      { color: '#ff512f', position: 0 },
      { color: '#f09819', position: 100 }
    ]
  },
  {
    id: 'grad_preset_ocean',
    name: 'Ocean',
    type: 'linear',
    angle: 135,
    stops: [
      { color: '#2193b0', position: 0 },
      { color: '#6dd5ed', position: 100 }
    ]
  },
  {
    id: 'grad_preset_forest',
    name: 'Forest',
    type: 'linear',
    angle: 135,
    stops: [
      { color: '#11998e', position: 0 },
      { color: '#38ef7d', position: 100 }
    ]
  },
  {
    id: 'grad_preset_purple_haze',
    name: 'Purple Haze',
    type: 'linear',
    angle: 135,
    stops: [
      { color: '#7b4397', position: 0 },
      { color: '#dc2430', position: 100 }
    ]
  },
  {
    id: 'grad_preset_midnight',
    name: 'Midnight',
    type: 'linear',
    angle: 135,
    stops: [
      { color: '#232526', position: 0 },
      { color: '#414345', position: 100 }
    ]
  },
  {
    id: 'grad_preset_peach',
    name: 'Peach',
    type: 'linear',
    angle: 135,
    stops: [
      { color: '#ffecd2', position: 0 },
      { color: '#fcb69f', position: 100 }
    ]
  }
];

const GradientManager = {
  /** @type {Array} All saved gradients */
  _gradients: [],

  /** @type {Object} Active editor state keyed by containerId */
  _editors: {},

  /** @type {Object} Active selector state keyed by containerId */
  _selectors: {},

  // ─── Core API ───────────────────────────────────────────────

  /**
   * Initialize the gradient manager. Loads saved gradients or seeds defaults.
   */
  init() {
    this._load();
  },

  /**
   * Generate a unique gradient ID.
   * @returns {string}
   */
  _generateId() {
    return 'grad_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  },

  /**
   * Create a new gradient object.
   * @param {string} name - Display name
   * @param {string} type - 'linear' (only supported for now)
   * @param {number} angle - Degrees (linear only)
   * @param {Array} stops - Array of {color, position} objects
   * @returns {Object} The created gradient
   */
  create(name, type, angle, stops) {
    return {
      id: this._generateId(),
      name: name || 'Custom Gradient',
      type: type || 'linear',
      angle: angle !== undefined ? angle : 90,
      stops: stops || [
        { color: '#000000', position: 0 },
        { color: '#ffffff', position: 100 }
      ]
    };
  },

  /**
   * Save or update a gradient and persist to localStorage.
   * @param {Object} gradient - Gradient object to save
   * @returns {Object} The saved gradient
   */
  save(gradient) {
    if ( ! gradient.id ) gradient.id = this._generateId();

    const idx = this._gradients.findIndex(g => g.id === gradient.id);
    if ( idx >= 0 ) {
      this._gradients[idx] = { ...gradient };
    } else {
      this._gradients.push({ ...gradient });
    }

    this._persist();
    return gradient;
  },

  /**
   * Delete a gradient by ID.
   * @param {string} id - Gradient ID to delete
   */
  delete(id) {
    this._gradients = this._gradients.filter(g => g.id !== id);
    this._persist();
  },

  /**
   * Get a gradient by ID.
   * @param {string} id - Gradient ID
   * @returns {Object|null}
   */
  getById(id) {
    return this._gradients.find(g => g.id === id) || null;
  },

  /**
   * Get all saved gradients.
   * @returns {Array}
   */
  getAll() {
    return [...this._gradients];
  },

  /**
   * Convert a gradient object to a CSS gradient string.
   * @param {Object} gradient - Gradient object
   * @returns {string} CSS gradient value
   */
  toCSS(gradient) {
    if ( ! gradient || ! gradient.stops || gradient.stops.length < 2 ) return '';

    const sortedStops = [...gradient.stops].sort((a, b) => a.position - b.position);
    const stopsStr = sortedStops.map(s => `${s.color} ${s.position}%`).join(', ');

    if ( gradient.type === 'linear' ) {
      return `linear-gradient(${gradient.angle}deg, ${stopsStr})`;
    }

    // Radial deferred but handle gracefully
    return `radial-gradient(circle, ${stopsStr})`;
  },

  /**
   * Parse a CSS gradient string back into a gradient object (best-effort).
   * @param {string} css - CSS gradient string
   * @returns {Object|null} Parsed gradient or null
   */
  fromCSS(css) {
    if ( ! css ) return null;

    let type = null;
    let angle = 90;
    let stopsStr = null;

    const linearMatch = css.match(/^linear-gradient\(\s*(\d+)deg\s*,\s*(.+)\)$/i);
    if ( linearMatch ) {
      type = 'linear';
      angle = parseInt(linearMatch[1], 10);
      stopsStr = linearMatch[2];
    }

    if ( ! type ) {
      const radialMatch = css.match(/^radial-gradient\(\s*(?:circle|ellipse)?\s*,?\s*(.+)\)$/i);
      if ( radialMatch ) {
        type = 'radial';
        stopsStr = radialMatch[1];
      }
    }

    if ( ! type || ! stopsStr ) return null;

    const stops = [];
    // Match color + position pairs like "#ff512f 0%" or "rgb(255,0,0) 50%"
    const stopRegex = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s+(\d+(?:\.\d+)?)%/g;
    let match;
    while ( (match = stopRegex.exec(stopsStr)) !== null ) {
      stops.push({
        color: match[1],
        position: parseFloat(match[2])
      });
    }

    if ( stops.length < 2 ) return null;

    return {
      id: this._generateId(),
      name: 'Imported Gradient',
      type: type,
      angle: angle,
      stops: stops
    };
  },

  /**
   * Load gradients from localStorage, or seed with defaults.
   * @private
   */
  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if ( raw ) {
        this._gradients = JSON.parse(raw);
      } else {
        this._gradients = DEFAULT_PRESETS.map(p => ({ ...p }));
        this._persist();
      }
    } catch ( e ) {
      console.warn('GradientManager: failed to load from localStorage', e);
      this._gradients = DEFAULT_PRESETS.map(p => ({ ...p }));
    }
  },

  /**
   * Persist gradients to localStorage.
   * @private
   */
  _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._gradients));
    } catch ( e ) {
      console.warn('GradientManager: failed to persist to localStorage', e);
    }
  },

  // ─── Gradient Editor Widget ─────────────────────────────────

  /**
   * Render an interactive gradient editor inside the given container.
   * @param {string} containerId - DOM element ID to render into
   * @param {Object} options - { gradient, onChange }
   * @returns {Object} Editor state handle
   */
  renderEditor(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if ( ! container ) return null;

    const gradient = options.gradient || this.create('Custom', 'linear', 90, [
      { color: '#000000', position: 0 },
      { color: '#ffffff', position: 100 }
    ]);
    const onChange = options.onChange || (() => {});

    const state = {
      gradient: JSON.parse(JSON.stringify(gradient)),
      dragging: null,
      container: container
    };

    this._editors[containerId] = state;
    this._renderEditorDOM(containerId, state, onChange);

    return state;
  },

  /**
   * Build the editor DOM and bind events.
   * @private
   */
  _renderEditorDOM(containerId, state, onChange) {
    const container = state.container;
    const gradient = state.gradient;

    const isLinear = gradient.type !== 'radial';

    container.innerHTML = `
      <div class="gradient-editor" id="${containerId}-editor">
        <div class="gradient-type-row">
          <label>Type</label>
          <div class="gradient-type-toggle">
            <button class="gradient-type-btn ${isLinear ? 'active' : ''}" data-type="linear">Linear</button>
            <button class="gradient-type-btn ${!isLinear ? 'active' : ''}" data-type="radial">Radial</button>
          </div>
        </div>
        <div class="gradient-angle-row" ${!isLinear ? 'style="display:none"' : ''}>
          <label>Angle</label>
          <div class="slider-row">
            <input type="range" class="gradient-angle-slider slider" min="0" max="360" step="1" value="${gradient.angle}">
            <div class="number-box">
              <input type="number" class="gradient-angle-input number-input" min="0" max="360" step="1" value="${gradient.angle}">
              <span class="unit-label">°</span>
            </div>
          </div>
        </div>
        <div class="gradient-bar-wrapper">
          <div class="gradient-bar" style="background: ${this.toCSS(gradient)}"></div>
          <div class="gradient-stops"></div>
        </div>
        <div class="gradient-editor-hint">Double-click bar to add stop &middot; Drag down to remove</div>
      </div>
    `;

    const bar = container.querySelector('.gradient-bar');
    const stopsContainer = container.querySelector('.gradient-stops');
    const angleSlider = container.querySelector('.gradient-angle-slider');
    const angleInput = container.querySelector('.gradient-angle-input');
    const angleRow = container.querySelector('.gradient-angle-row');
    const typeBtns = container.querySelectorAll('.gradient-type-btn');

    /** Update preview and fire onChange */
    const update = () => {
      bar.style.background = this.toCSS(state.gradient);
      onChange(state.gradient, this.toCSS(state.gradient));
    };

    /** Render all stop handles */
    const renderStops = () => {
      stopsContainer.innerHTML = '';
      const sortedStops = [...state.gradient.stops].sort((a, b) => a.position - b.position);

      sortedStops.forEach((stop, i) => {
        const handle = document.createElement('div');
        handle.className = 'gradient-stop-handle';
        handle.style.left = stop.position + '%';
        handle.style.backgroundColor = stop.color;
        handle.dataset.index = state.gradient.stops.indexOf(stop);

        // Hidden color input for this stop
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = stop.color;
        colorInput.className = 'gradient-stop-color-input';
        handle.appendChild(colorInput);

        // Click to open color picker
        handle.addEventListener('click', (e) => {
          if ( state.justDragged ) {
            state.justDragged = false;
            return;
          }
          e.stopPropagation();
          colorInput.click();
        });

        colorInput.addEventListener('input', (e) => {
          const idx = parseInt(handle.dataset.index, 10);
          state.gradient.stops[idx].color = e.target.value;
          handle.style.backgroundColor = e.target.value;
          update();
        });

        colorInput.addEventListener('click', (e) => e.stopPropagation());

        // Drag to reposition
        handle.addEventListener('mousedown', (e) => {
          if ( e.target === colorInput ) return;
          e.preventDefault();
          e.stopPropagation();

          const barRect = bar.getBoundingClientRect();
          const idx = parseInt(handle.dataset.index, 10);
          state.dragging = { idx, startY: e.clientY };
          handle.classList.add('dragging');

          const onMouseMove = (ev) => {
            const pos = ((ev.clientX - barRect.left) / barRect.width) * 100;
            const clamped = Math.max(0, Math.min(100, Math.round(pos * 10) / 10));
            state.gradient.stops[idx].position = clamped;
            handle.style.left = clamped + '%';

            // Vertical distance for removal
            const dy = Math.abs(ev.clientY - state.dragging.startY);
            if ( dy > 40 && state.gradient.stops.length > 2 ) {
              handle.classList.add('removing');
            } else {
              handle.classList.remove('removing');
            }

            update();
          };

          const onMouseUp = (ev) => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            handle.classList.remove('dragging');

            const dy = Math.abs(ev.clientY - state.dragging.startY);
            if ( dy > 40 && state.gradient.stops.length > 2 ) {
              state.gradient.stops.splice(idx, 1);
              renderStops();
              update();
            }

            // If mouse moved more than 3px, mark as drag (don't open color picker)
            const dx = Math.abs(ev.clientX - (barRect.left + (state.gradient.stops[idx]?.position || 0) * barRect.width / 100));
            if ( dy > 3 || dx > 3 ) {
              state.justDragged = true;
            }

            state.dragging = null;
          };

          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        });

        stopsContainer.appendChild(handle);
      });
    };

    // Type toggle
    typeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        typeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.gradient.type = btn.dataset.type;
        angleRow.style.display = btn.dataset.type === 'linear' ? '' : 'none';
        update();
      });
    });

    // Angle slider + number input sync
    const updateAngle = (val) => {
      const clamped = Math.max(0, Math.min(360, parseInt(val, 10) || 0));
      state.gradient.angle = clamped;
      angleSlider.value = clamped;
      angleInput.value = clamped;
      update();
    };

    angleSlider.addEventListener('input', (e) => updateAngle(e.target.value));
    angleInput.addEventListener('change', (e) => updateAngle(e.target.value));

    // Double-click bar to add stop
    bar.addEventListener('dblclick', (e) => {
      const rect = bar.getBoundingClientRect();
      const pos = Math.round(((e.clientX - rect.left) / rect.width) * 100);
      const clamped = Math.max(0, Math.min(100, pos));

      // Interpolate color from neighboring stops
      const sorted = [...state.gradient.stops].sort((a, b) => a.position - b.position);
      let color = '#888888';
      for ( let i = 0; i < sorted.length - 1; i++ ) {
        if ( clamped >= sorted[i].position && clamped <= sorted[i + 1].position ) {
          color = sorted[i].color;
          break;
        }
      }

      state.gradient.stops.push({ color, position: clamped });
      renderStops();
      update();
    });

    renderStops();
  },

  // ─── Gradient Selector / Dropdown Widget ────────────────────

  /**
   * Render a gradient selector (dropdown) inside the given container.
   * @param {string} containerId - DOM element ID to render into
   * @param {Object} options - { value, onChange }
   */
  renderSelector(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if ( ! container ) return;

    const value = options.value || '#ffffff';
    const onChange = options.onChange || (() => {});

    const state = {
      value: value,
      open: false,
      onChange: onChange
    };
    this._selectors[containerId] = state;

    container.innerHTML = `
      <div class="gradient-selector" id="${containerId}-selector">
        <div class="gradient-selector-current">
          <div class="gradient-selector-preview" style="background: ${value}"></div>
          <span class="gradient-selector-label">${this._labelForValue(value)}</span>
          <span class="gradient-selector-chevron">&#9662;</span>
        </div>
        <div class="gradient-selector-dropdown"></div>
      </div>
    `;

    const selector = container.querySelector('.gradient-selector');
    const current = container.querySelector('.gradient-selector-current');
    const dropdown = container.querySelector('.gradient-selector-dropdown');

    // Toggle dropdown
    current.addEventListener('click', (e) => {
      e.stopPropagation();
      state.open = !state.open;
      if ( state.open ) {
        this._populateDropdown(containerId, dropdown, state, onChange);
        selector.classList.add('open');
      } else {
        selector.classList.remove('open');
      }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if ( state.open && ! selector.contains(e.target) ) {
        state.open = false;
        selector.classList.remove('open');
      }
    });
  },

  /**
   * Build dropdown items: solid color, saved gradients, and custom option.
   * @private
   */
  _populateDropdown(containerId, dropdown, state, onChange) {
    const gradients = this.getAll();

    let html = '';

    // Solid color option
    html += `
      <div class="gradient-selector-item" data-action="solid">
        <div class="gradient-selector-item-preview" style="background: #ffffff"></div>
        <span class="gradient-selector-item-label">Solid Color</span>
        <input type="color" class="gradient-selector-solid-input" value="${state.value.startsWith('#') ? state.value : '#ffffff'}" style="position:absolute;opacity:0;pointer-events:none;">
      </div>
    `;

    // Saved gradients
    gradients.forEach(g => {
      const css = this.toCSS(g);
      const isPreset = g.id.startsWith('grad_preset_');
      const dupBtn = isPreset ? `<button class="gradient-selector-item-dup" data-dup-id="${g.id}" title="Duplicate gradient">&#x2398;</button>` : '';
      const editBtn = isPreset ? '' : `<button class="gradient-selector-item-edit" data-edit-id="${g.id}" title="Edit gradient">&#9998;</button>`;
      const deleteBtn = isPreset ? '' : `<button class="gradient-selector-item-delete" data-delete-id="${g.id}" title="Delete gradient">&times;</button>`;
      html += `
        <div class="gradient-selector-item" data-gradient-id="${g.id}">
          <div class="gradient-selector-item-preview" style="background: ${css}"></div>
          <span class="gradient-selector-item-label">${g.name}</span>
          ${dupBtn}
          ${editBtn}
          ${deleteBtn}
        </div>
      `;
    });

    // Custom gradient option
    html += `
      <div class="gradient-selector-item gradient-selector-custom" data-action="custom">
        <span class="gradient-selector-item-label">Custom Gradient...</span>
      </div>
    `;

    dropdown.innerHTML = html;

    // Bind solid color
    const solidItem = dropdown.querySelector('[data-action="solid"]');
    const solidInput = dropdown.querySelector('.gradient-selector-solid-input');
    solidItem.addEventListener('click', (e) => {
      e.stopPropagation();
      solidInput.style.pointerEvents = 'auto';
      solidInput.click();
    });
    solidInput.addEventListener('input', (e) => {
      const color = e.target.value;
      state.value = color;
      this._updateSelectorPreview(containerId, color);
      onChange(color);
    });
    solidInput.addEventListener('change', (e) => {
      solidInput.style.pointerEvents = 'none';
    });

    // Bind gradient items
    dropdown.querySelectorAll('[data-gradient-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        if ( e.target.classList.contains('gradient-selector-item-delete') ) return;
        if ( e.target.classList.contains('gradient-selector-item-edit') ) return;
        if ( e.target.classList.contains('gradient-selector-item-dup') ) return;
        const id = item.dataset.gradientId;
        const gradient = this.getById(id);
        if ( ! gradient ) return;
        const css = this.toCSS(gradient);
        state.value = css;
        this._updateSelectorPreview(containerId, css);
        onChange(css);
        this._closeSelector(containerId);
      });
    });

    // Bind duplicate buttons
    dropdown.querySelectorAll('.gradient-selector-item-dup').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.dupId;
        const source = this.getById(id);
        if ( ! source ) return;
        const copy = this.create(
          source.name + ' Copy',
          source.type,
          source.angle,
          source.stops.map(s => ({ ...s }))
        );
        this._closeSelector(containerId);
        this._openGradientDialog(containerId, state, onChange, copy);
      });
    });

    // Bind edit buttons
    dropdown.querySelectorAll('.gradient-selector-item-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.editId;
        const gradient = this.getById(id);
        if ( ! gradient ) return;
        this._closeSelector(containerId);
        this._openGradientDialog(containerId, state, onChange, gradient);
      });
    });

    // Bind delete buttons
    dropdown.querySelectorAll('.gradient-selector-item-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.deleteId;
        this.delete(id);
        this._populateDropdown(containerId, dropdown, state, onChange);
      });
    });

    // Bind custom gradient
    const customItem = dropdown.querySelector('[data-action="custom"]');
    customItem.addEventListener('click', (e) => {
      e.stopPropagation();
      this._closeSelector(containerId);
      this._openGradientDialog(containerId, state, onChange);
    });
  },

  /**
   * Open a Dialog with the full gradient editor inside.
   * @private
   * @param {string} containerId - Selector container ID
   * @param {Object} state - Selector state
   * @param {Function} onChange - Change callback
   * @param {Object} [existingGradient] - Gradient to edit (omit to create new)
   */
  _openGradientDialog(containerId, state, onChange, existingGradient) {
    let gradient;
    if ( existingGradient ) {
      gradient = JSON.parse(JSON.stringify(existingGradient));
    } else {
      gradient = this.fromCSS(state.value);
      if ( ! gradient ) {
        gradient = this.create('Custom Gradient', 'linear', 90, [
          { color: state.value.startsWith('#') ? state.value : '#000000', position: 0 },
          { color: '#ffffff', position: 100 }
        ]);
      }
    }

    let editedGradient = JSON.parse(JSON.stringify(gradient));
    let editedCSS = this.toCSS(editedGradient);
    let editedName = gradient.name;

    Dialog.show({
      title: 'Custom Gradient',
      boxClass: 'dialog-gradient-editor',
      body: `
        <div id="dialog-gradient-editor-container"></div>
        <div class="gradient-dialog-name-row">
          <label>Name</label>
          <input type="text" class="panel-input gradient-dialog-name" value="${gradient.name}" placeholder="Gradient name">
        </div>
      `,
      buttons: [
        { text: 'Cancel', type: 'secondary', value: false },
        { text: 'Apply', type: 'primary', value: 'apply' },
        { text: 'Save & Apply', type: 'primary', value: 'save' }
      ],
      onRender: (box) => {
        this.renderEditor('dialog-gradient-editor-container', {
          gradient: editedGradient,
          onChange: (g, css) => {
            editedGradient = g;
            editedCSS = css;
          }
        });

        // Capture name on every keystroke — the Dialog removes the DOM before .then() runs
        const nameInput = box.querySelector('.gradient-dialog-name');
        if ( nameInput ) {
          nameInput.addEventListener('input', (e) => {
            editedName = e.target.value.trim();
          });
        }
      }
    }).then((result) => {
      if ( result === false || result === null ) return;

      if ( editedName ) {
        editedGradient.name = editedName;
      }

      if ( result === 'save' ) {
        this.save(editedGradient);
      }

      const css = this.toCSS(editedGradient);
      state.value = css;
      this._updateSelectorPreview(containerId, css);
      onChange(css);
    });
  },

  /**
   * Update the selector preview strip and label.
   * @private
   */
  _updateSelectorPreview(containerId, value) {
    const container = document.getElementById(containerId);
    if ( ! container ) return;

    const preview = container.querySelector('.gradient-selector-preview');
    const label = container.querySelector('.gradient-selector-label');

    if ( preview ) preview.style.background = value;
    if ( label ) label.textContent = this._labelForValue(value);
  },

  /**
   * Close the selector dropdown.
   * @private
   */
  _closeSelector(containerId) {
    const container = document.getElementById(containerId);
    if ( ! container ) return;

    const selector = container.querySelector('.gradient-selector');
    if ( selector ) selector.classList.remove('open');

    const state = this._selectors[containerId];
    if ( state ) state.open = false;
  },

  /**
   * Derive a display label from a CSS value.
   * @private
   * @param {string} value - CSS color or gradient string
   * @returns {string}
   */
  _labelForValue(value) {
    if ( ! value ) return 'None';
    if ( value.startsWith('linear-gradient') || value.startsWith('radial-gradient') ) {
      // Check if it matches a saved gradient
      const all = this.getAll();
      for ( const g of all ) {
        if ( this.toCSS(g) === value ) return g.name;
      }
      return 'Custom Gradient';
    }
    return value;
  },

  /**
   * Update a selector from external state (e.g. when switching slides).
   * @param {string} containerId - The selector container ID
   * @param {string} cssValue - The current CSS background value
   */
  updateSelector(containerId, cssValue) {
    const state = this._selectors[containerId];
    if ( ! state ) return;

    state.value = cssValue || '#ffffff';
    this._updateSelectorPreview(containerId, state.value);
  }
};

window.GradientManager = GradientManager;
