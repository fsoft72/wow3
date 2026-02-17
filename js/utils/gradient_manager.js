/**
 * Gradient Manager for WOW3
 * Data layer for CSS gradients: creation, persistence, CSS conversion.
 * UI rendering is handled by GradientSelector (js/components/gradient_selector.js).
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
   * @param {string} type - 'linear' or 'radial'
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

  /**
   * Build CSS animation properties for a cycling gradient.
   * Returns empty string when speed is 0 (no animation).
   * @param {number} speed - Animation speed (0 = off, 1 = slow 10s, 10 = fast 1s)
   * @param {string} [animationType='pingpong'] - Animation type ('pingpong' | 'cycle')
   * @returns {string} CSS property string
   */
  buildAnimationCSS(speed, animationType) {
    if ( ! speed || speed <= 0 ) return '';
    const duration = 11 - speed;
    const type = animationType || 'pingpong';
    const keyframes = type === 'cycle' ? 'wow3GradientCycleForward' : 'wow3GradientCycle';
    const easing = type === 'cycle' ? 'linear' : 'ease';
    return `background-size: 200% 200%; animation: ${keyframes} ${duration}s ${easing} infinite;`;
  },

  // ─── Gradient Editor Widget (used inside the dialog) ──────

  /**
   * Render an interactive color-stop editor inside the given container.
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

    container.innerHTML = `
      <div class="gradient-editor" id="${containerId}-editor">
        <div class="gradient-bar-wrapper">
          <div class="gradient-bar" style="background: ${this.toCSS(gradient)}"></div>
          <div class="gradient-stops"></div>
        </div>
        <div class="gradient-editor-hint">Double-click bar to add stop &middot; Drag down to remove</div>
      </div>
    `;

    const bar = container.querySelector('.gradient-bar');
    const stopsContainer = container.querySelector('.gradient-stops');

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
  }
};

window.GradientManager = GradientManager;
