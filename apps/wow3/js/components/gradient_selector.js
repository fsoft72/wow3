/**
 * GradientSelector — Reusable gradient/color picker widget.
 *
 * Renders a dropdown selector (presets, solid color, custom gradient),
 * plus type toggle (linear/radial) and angle controls that appear when
 * a gradient is active. Delegates data operations to window.GradientManager.
 *
 * Usage:
 *   const sel = new GradientSelector('my-container', {
 *     value: '#ffffff',
 *     onChange: (cssValue) => { ... }
 *   });
 *
 *   // Later, to sync from external state:
 *   sel.update('#ff0000');
 *   sel.update('linear-gradient(90deg, #000 0%, #fff 100%)');
 */
class GradientSelector {

  /**
   * @param {string} containerId - ID of the DOM element to render into
   * @param {Object} [options]
   * @param {string} [options.value='#ffffff'] - Initial CSS value (color or gradient)
   * @param {Function} [options.onChange] - Called with the new CSS value on every change
   */
  constructor(containerId, options = {}) {
    this._containerId = containerId;
    this._container = document.getElementById(containerId);
    if ( ! this._container ) return;

    this._onChange = options.onChange || (() => {});
    this._value = options.value || '#ffffff';
    this._animationSpeed = options.animationSpeed ?? 0;
    this._animationType = options.animationType || 'pingpong';
    this._gradient = this._isGradient(this._value) ? GradientManager.fromCSS(this._value) : null;
    this._open = false;

    this._render();
    this._bind();
  }

  // ─── Public API ───────────────────────────────────────────

  /**
   * Update the selector from external state (e.g. when switching slides).
   * @param {string} cssValue - The current CSS background value
   * @param {number} [animationSpeed] - Optional gradient animation speed (0-10)
   * @param {string} [animationType] - Optional animation type ('pingpong' | 'cycle')
   */
  update(cssValue, animationSpeed, animationType) {
    this._value = cssValue || '#ffffff';
    this._gradient = this._isGradient(this._value) ? GradientManager.fromCSS(this._value) : null;
    if ( animationSpeed !== undefined ) this._animationSpeed = animationSpeed;
    if ( animationType !== undefined ) this._animationType = animationType;
    this._updatePreview();
    this._syncControls();
  }

  /**
   * Get the current CSS value.
   * @returns {string}
   */
  getValue() {
    return this._value;
  }

  // ─── Rendering ────────────────────────────────────────────

  /** Build the initial DOM. */
  _render() {
    const isGrad = !!this._gradient;
    const gType = this._gradient ? this._gradient.type : 'linear';
    const gAngle = this._gradient ? this._gradient.angle : 90;
    const isLinear = gType !== 'radial';

    this._container.innerHTML = `
      <div class="gradient-selector">
        <div class="gradient-selector-current">
          <div class="gradient-selector-preview" style="background: ${this._value}"></div>
          <span class="gradient-selector-label">${this._labelForValue(this._value)}</span>
          <span class="gradient-selector-chevron">&#9662;</span>
        </div>
        <div class="gradient-selector-dropdown"></div>
      </div>
      <div class="gradient-controls" ${!isGrad ? 'style="display:none"' : ''}>
        <div class="gradient-type-row">
          <label>Type</label>
          <div class="gradient-type-toggle">
            <button class="gradient-type-btn ${isLinear ? 'active' : ''}" data-type="linear">Linear</button>
            <button class="gradient-type-btn ${!isLinear ? 'active' : ''}" data-type="radial">Radial</button>
          </div>
        </div>
        <div class="gradient-angle-row" ${!isLinear ? 'style="display:none"' : ''}>
        </div>
        <div class="gradient-speed-row">
        </div>
        <div class="gradient-animation-type-row" ${(!isGrad || this._animationSpeed <= 0) ? 'style="display:none"' : ''}>
          <label>Anim</label>
          <select class="gradient-animation-type-select">
            <option value="pingpong" ${this._animationType === 'pingpong' ? 'selected' : ''}>Ping Pong</option>
            <option value="cycle" ${this._animationType === 'cycle' ? 'selected' : ''}>Cycle</option>
          </select>
        </div>
      </div>
    `;

    // Cache DOM references
    this._els = {
      selector:    this._container.querySelector('.gradient-selector'),
      current:     this._container.querySelector('.gradient-selector-current'),
      dropdown:    this._container.querySelector('.gradient-selector-dropdown'),
      preview:     this._container.querySelector('.gradient-selector-preview'),
      label:       this._container.querySelector('.gradient-selector-label'),
      controls:    this._container.querySelector('.gradient-controls'),
      angleRow:    this._container.querySelector('.gradient-angle-row'),
      speedRow:    this._container.querySelector('.gradient-speed-row'),
      typeBtns:    this._container.querySelectorAll('.gradient-type-btn'),
      animTypeRow: this._container.querySelector('.gradient-animation-type-row'),
      animTypeSelect: this._container.querySelector('.gradient-animation-type-select')
    };

    // Angle RangeInput — rendered inside the angleRow container
    const angleRowEl = this._els.angleRow;
    angleRowEl.id = this._containerId + '-angle-range';
    this._angleRange = new RangeInput(angleRowEl.id, {
      label: 'Angle',
      value: gAngle,
      min: 0,
      max: 360,
      step: 1,
      unit: '°',
      onChange: (val) => this._updateAngle(val)
    });

    // Speed RangeInput — rendered inside the speedRow container
    const speedRowEl = this._els.speedRow;
    speedRowEl.id = this._containerId + '-speed-range';
    this._speedRange = new RangeInput(speedRowEl.id, {
      label: 'Speed',
      value: this._animationSpeed,
      min: 0,
      max: 10,
      step: 1,
      onChange: (val) => this._updateSpeed(val)
    });
  }

  /** Bind all event listeners. */
  _bind() {
    const { current, selector, typeBtns } = this._els;

    // Toggle dropdown
    current.addEventListener('click', (e) => {
      e.stopPropagation();
      this._open = !this._open;
      if ( this._open ) {
        this._populateDropdown();
        selector.classList.add('open');
      } else {
        selector.classList.remove('open');
      }
    });

    // Close on outside click
    this._outsideClickHandler = (e) => {
      if ( this._open && ! selector.contains(e.target) ) {
        this._open = false;
        selector.classList.remove('open');
      }
    };
    document.addEventListener('click', this._outsideClickHandler);

    // Type toggle
    typeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if ( ! this._gradient ) return;
        typeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._gradient.type = btn.dataset.type;
        this._els.angleRow.style.display = btn.dataset.type === 'linear' ? '' : 'none';
        this._applyGradient();
      });
    });

    // Animation type select
    const { animTypeSelect } = this._els;
    if ( animTypeSelect ) {
      animTypeSelect.addEventListener('change', (e) => {
        this._animationType = e.target.value;
        this._onChange(this._value, this._animationSpeed, this._animationType);
      });
    }
  }

  // ─── Dropdown ─────────────────────────────────────────────

  /** Build dropdown items: solid color, saved gradients, custom option. */
  _populateDropdown() {
    const { dropdown } = this._els;
    const gradients = GradientManager.getAll();

    let html = '';

    // Solid color option
    html += `
      <div class="gradient-selector-item" data-action="solid">
        <div class="gradient-selector-item-preview" style="background: #ffffff"></div>
        <span class="gradient-selector-item-label">Solid Color</span>
        <input type="color" class="gradient-selector-solid-input" value="${this._value.startsWith('#') ? this._value : '#ffffff'}" style="position:absolute;opacity:0;pointer-events:none;">
      </div>
    `;

    // Saved gradients
    gradients.forEach(g => {
      const css = GradientManager.toCSS(g);
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
    this._bindDropdown();
  }

  /** Bind event listeners for dropdown items. */
  _bindDropdown() {
    const { dropdown } = this._els;

    // Solid color
    const solidItem = dropdown.querySelector('[data-action="solid"]');
    const solidInput = dropdown.querySelector('.gradient-selector-solid-input');
    solidItem.addEventListener('click', (e) => {
      e.stopPropagation();
      solidInput.style.pointerEvents = 'auto';
      solidInput.click();
    });
    solidInput.addEventListener('input', (e) => {
      this._value = e.target.value;
      this._gradient = null;
      this._animationSpeed = 0;
      this._updatePreview();
      this._syncControls();
      this._onChange(this._value, this._animationSpeed, this._animationType);
    });
    solidInput.addEventListener('change', () => {
      solidInput.style.pointerEvents = 'none';
    });

    // Gradient items
    dropdown.querySelectorAll('[data-gradient-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        if ( e.target.classList.contains('gradient-selector-item-delete') ) return;
        if ( e.target.classList.contains('gradient-selector-item-edit') ) return;
        if ( e.target.classList.contains('gradient-selector-item-dup') ) return;
        const gradient = GradientManager.getById(item.dataset.gradientId);
        if ( ! gradient ) return;
        this._gradient = JSON.parse(JSON.stringify(gradient));
        this._value = GradientManager.toCSS(this._gradient);
        this._updatePreview();
        this._syncControls();
        this._onChange(this._value, this._animationSpeed, this._animationType);
        this._close();
      });
    });

    // Duplicate buttons
    dropdown.querySelectorAll('.gradient-selector-item-dup').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const source = GradientManager.getById(btn.dataset.dupId);
        if ( ! source ) return;
        const copy = GradientManager.create(
          source.name + ' Copy',
          source.type,
          source.angle,
          source.stops.map(s => ({ ...s }))
        );
        this._close();
        this._openEditorDialog(copy);
      });
    });

    // Edit buttons
    dropdown.querySelectorAll('.gradient-selector-item-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gradient = GradientManager.getById(btn.dataset.editId);
        if ( ! gradient ) return;
        this._close();
        this._openEditorDialog(gradient);
      });
    });

    // Delete buttons
    dropdown.querySelectorAll('.gradient-selector-item-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        GradientManager.delete(btn.dataset.deleteId);
        this._populateDropdown();
      });
    });

    // Custom gradient
    dropdown.querySelector('[data-action="custom"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this._close();
      this._openEditorDialog();
    });
  }

  // ─── Gradient Editor Dialog ───────────────────────────────

  /**
   * Open a Dialog with the gradient color-stop editor.
   * @param {Object} [existingGradient] - Gradient to edit (omit to create new)
   */
  _openEditorDialog(existingGradient) {
    let gradient;
    if ( existingGradient ) {
      gradient = JSON.parse(JSON.stringify(existingGradient));
    } else {
      gradient = GradientManager.fromCSS(this._value);
      if ( ! gradient ) {
        gradient = GradientManager.create('Custom Gradient', 'linear', 90, [
          { color: this._value.startsWith('#') ? this._value : '#000000', position: 0 },
          { color: '#ffffff', position: 100 }
        ]);
      }
    }

    let editedGradient = JSON.parse(JSON.stringify(gradient));
    let editedCSS = GradientManager.toCSS(editedGradient);
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
        GradientManager.renderEditor('dialog-gradient-editor-container', {
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
        GradientManager.save(editedGradient);
      }

      this._gradient = JSON.parse(JSON.stringify(editedGradient));
      this._value = GradientManager.toCSS(this._gradient);
      this._updatePreview();
      this._syncControls();
      this._onChange(this._value, this._animationSpeed, this._animationType);
    });
  }

  // ─── Internal helpers ─────────────────────────────────────

  /** Recompute CSS from the current gradient object and fire onChange. */
  _applyGradient() {
    if ( ! this._gradient ) return;
    this._value = GradientManager.toCSS(this._gradient);
    this._updatePreview();
    this._onChange(this._value, this._animationSpeed, this._animationType);
  }

  /** Update angle from RangeInput. */
  _updateAngle(val) {
    if ( ! this._gradient ) return;
    this._gradient.angle = val;
    this._applyGradient();
  }

  /** Update animation speed from RangeInput. */
  _updateSpeed(val) {
    this._animationSpeed = val;
    this._syncAnimTypeVisibility();
    this._onChange(this._value, this._animationSpeed, this._animationType);
  }

  /** Update the preview strip and label. */
  _updatePreview() {
    const { preview, label } = this._els;
    if ( preview ) preview.style.background = this._value;
    if ( label ) label.textContent = this._labelForValue(this._value);
  }

  /** Sync type toggle, angle, speed, and animation type controls to match current gradient state. */
  _syncControls() {
    const { controls, typeBtns, angleRow, speedRow } = this._els;
    if ( ! controls ) return;

    if ( ! this._gradient ) {
      controls.style.display = 'none';
      return;
    }

    controls.style.display = '';
    const isLinear = this._gradient.type !== 'radial';

    typeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === this._gradient.type);
    });

    if ( angleRow ) angleRow.style.display = isLinear ? '' : 'none';
    if ( this._angleRange ) this._angleRange.update(this._gradient.angle);
    if ( speedRow ) speedRow.style.display = '';
    if ( this._speedRange ) this._speedRange.update(this._animationSpeed);

    // Animation type select
    if ( this._els.animTypeSelect ) {
      this._els.animTypeSelect.value = this._animationType;
    }
    this._syncAnimTypeVisibility();
  }

  /** Show/hide the animation type row based on speed. */
  _syncAnimTypeVisibility() {
    const { animTypeRow } = this._els;
    if ( ! animTypeRow ) return;
    animTypeRow.style.display = (this._gradient && this._animationSpeed > 0) ? '' : 'none';
  }

  /** Close the selector dropdown. */
  _close() {
    this._open = false;
    this._els.selector.classList.remove('open');
  }

  /**
   * Check if a CSS value is a gradient (vs solid color).
   * @param {string} value
   * @returns {boolean}
   */
  _isGradient(value) {
    if ( ! value ) return false;
    return value.startsWith('linear-gradient') || value.startsWith('radial-gradient');
  }

  /**
   * Derive a display label from a CSS value.
   * @param {string} value
   * @returns {string}
   */
  _labelForValue(value) {
    if ( ! value ) return 'None';
    if ( this._isGradient(value) ) {
      const all = GradientManager.getAll();
      for ( const g of all ) {
        if ( GradientManager.toCSS(g) === value ) return g.name;
      }
      return 'Custom Gradient';
    }
    return value;
  }

  /**
   * Remove event listeners and clear the container.
   * Call this if you need to destroy the selector cleanly.
   */
  destroy() {
    if ( this._outsideClickHandler ) {
      document.removeEventListener('click', this._outsideClickHandler);
    }
    if ( this._container ) {
      this._container.innerHTML = '';
    }
  }
}

window.GradientSelector = GradientSelector;
