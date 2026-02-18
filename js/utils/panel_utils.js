/**
 * Panel Utilities for WOW3
 * Helper functions for rendering property panels
 */

window.PanelUtils = {
  /**
   * Parse CSS value into number and unit
   * @param {string} str - CSS value (e.g., "16px", "1.5em")
   * @returns {Object} - {val: number, unit: string}
   */
  parseValue(str) {
    if (!str || str === 'none' || str === 'normal' || str === 'auto') {
      return { val: 0, unit: 'px' };
    }
    const match = String(str).match(/^([\d\.]+)(.*)$/);
    if (match) {
      return { val: parseFloat(match[1]), unit: match[2].toLowerCase() || 'px' };
    }
    return { val: 0, unit: 'px' };
  },

  /**
   * Render unit selector options
   */
  unitOptions(selected) {
    return ['px', '%', 'em', 'rem', 'vh', 'vw']
      .map(u => `<option value="${u}" ${selected === u ? 'selected' : ''}>${u}</option>`)
      .join('');
  },

  /**
   * Font list used by font pickers
   */
  FONT_LIST: [
    { label: 'Roboto', value: 'Roboto' },
    { label: 'Arial', value: 'Arial' },
    { label: 'Helvetica', value: 'Helvetica' },
    { label: 'Times New Roman', value: '"Times New Roman"' },
    { label: 'Georgia', value: 'Georgia' },
    { label: 'Courier New', value: '"Courier New"' },
    { label: 'Verdana', value: 'Verdana' },
    { label: 'Open Sans', value: '"Open Sans"' },
    { label: 'Lato', value: 'Lato' },
    { label: 'Montserrat', value: 'Montserrat' }
  ],

  /**
   * Render font family options (legacy <select> version)
   */
  fontFamilyOptions(current) {
    const isSelected = (val) => current && current.replace(/['"]/g, '') === val.replace(/['"]/g, '');

    return this.FONT_LIST
      .map(f => `<option value="${f.value}" style="font-family:${f.value}" ${isSelected(f.value) ? 'selected' : ''}>${f.label}</option>`)
      .join('');
  },

  /**
   * Render a custom font family picker with font previews
   * @param {string} id - Unique ID for the picker
   * @param {string} current - Current font family value
   * @returns {string} HTML string
   */
  renderFontFamilyPicker(id, current) {
    const currentLabel = this.FONT_LIST.find(f =>
      f.value.replace(/['"]/g, '') === (current || '').replace(/['"]/g, '')
    )?.label || current || 'Roboto';

    const cssFamily = this.FONT_LIST.find(f => f.label === currentLabel)?.value || currentLabel;

    const options = this.FONT_LIST.map(f => {
      const selected = f.label === currentLabel ? ' font-picker-option--selected' : '';
      return `<div class="font-picker-option${selected}" data-value="${f.value}" data-label="${f.label}" style="font-family:${f.value}">${f.label}</div>`;
    }).join('');

    return `
      <div class="font-picker" id="${id}">
        <div class="font-picker-trigger" style="font-family:${cssFamily}">
          <span class="font-picker-label">${currentLabel}</span>
          <i class="material-icons font-picker-arrow">expand_more</i>
        </div>
        <div class="font-picker-dropdown">
          ${options}
        </div>
      </div>
    `;
  },

  /**
   * Bind a font family picker's interactive behavior
   * @param {string} id - Container element ID
   * @param {Function} onChange - Callback with new font value
   */
  bindFontFamilyPicker(id, onChange) {
    const picker = document.getElementById(id);
    if (!picker) return;

    const trigger = picker.querySelector('.font-picker-trigger');
    const dropdown = picker.querySelector('.font-picker-dropdown');
    const label = picker.querySelector('.font-picker-label');

    /** Toggle dropdown open/closed */
    const toggle = () => {
      const isOpen = picker.classList.toggle('font-picker--open');
      if (isOpen) {
        // Scroll selected option into view
        const selected = dropdown.querySelector('.font-picker-option--selected');
        if (selected) selected.scrollIntoView({ block: 'nearest' });
      }
    };

    trigger.addEventListener('click', toggle);

    // Select an option
    dropdown.addEventListener('click', (e) => {
      const opt = e.target.closest('.font-picker-option');
      if (!opt) return;

      const value = opt.dataset.value;
      const fontLabel = opt.dataset.label;

      // Update trigger display
      label.textContent = fontLabel;
      trigger.style.fontFamily = value;

      // Update selected state
      dropdown.querySelectorAll('.font-picker-option').forEach(o => o.classList.remove('font-picker-option--selected'));
      opt.classList.add('font-picker-option--selected');

      picker.classList.remove('font-picker--open');

      if (onChange) onChange(value);
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!picker.contains(e.target)) {
        picker.classList.remove('font-picker--open');
      }
    });
  },

  /**
   * Render slider control with number input
   */
  renderSlider(label, id, value, min = 0, max = 100, step = 1, unit = '') {
    const val = value?.val !== undefined ? value.val : value || 0;
    const unitSel = unit ? `<span class="unit-label">${unit}</span>` : '';

    return `
      <div class="control-group">
        <label>${label}</label>
        <div class="slider-row">
          <input type="range" id="slider-${id}" class="slider" min="${min}" max="${max}" step="${step}" value="${val}">
          <div class="number-box">
            <input type="number" id="input-${id}" class="number-input" min="${min}" max="${max}" step="${step}" value="${val}">
            ${unitSel}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render color picker
   */
  renderColorPicker(label, id, value) {
    return `
      <div class="control-group">
        <label>${label}</label>
        <div class="color-picker-wrapper">
          <div class="color-preview" style="background: ${value}">
            <input type="color" id="${id}" value="${this.rgbToHex(value)}">
          </div>
          <input type="text" id="${id}-text" class="color-text-input" value="${value}">
        </div>
      </div>
    `;
  },

  /**
   * Convert RGB/RGBA to HEX
   */
  rgbToHex(color) {
    if (!color) return '#000000';
    if (color.startsWith('#')) return color;

    const match = color.match(/\d+/g);
    if (!match || match.length < 3) return '#000000';

    const r = parseInt(match[0]).toString(16).padStart(2, '0');
    const g = parseInt(match[1]).toString(16).padStart(2, '0');
    const b = parseInt(match[2]).toString(16).padStart(2, '0');

    return `#${r}${g}${b}`;
  },

  /**
   * Bind slider and number input sync
   */
  bindSlider(id, onChange) {
    const slider = document.getElementById(`slider-${id}`);
    const input = document.getElementById(`input-${id}`);

    if (!slider || !input) return;

    const update = (value) => {
      slider.value = value;
      input.value = value;
      if (onChange) onChange(parseFloat(value));
    };

    slider.addEventListener('input', (e) => update(e.target.value));
    input.addEventListener('change', (e) => update(e.target.value));
  },

  /**
   * Bind color picker and text input sync
   */
  bindColorPicker(id, onChange) {
    const colorInput = document.getElementById(id);
    const textInput = document.getElementById(`${id}-text`);
    const preview = colorInput?.parentElement;

    if (!colorInput || !textInput) return;

    colorInput.addEventListener('change', (e) => {
      textInput.value = e.target.value;
      if (preview) preview.style.background = e.target.value;
      if (onChange) onChange(e.target.value);
    });

    textInput.addEventListener('change', (e) => {
      const value = e.target.value;
      if (value.startsWith('#') || value.startsWith('rgb')) {
        if (value.startsWith('#')) {
          colorInput.value = value;
        }
        if (preview) preview.style.background = value;
        if (onChange) onChange(value);
      }
    });
  },

  /**
   * Render a gradient picker control (uses GradientSelector).
   * @param {string} label - Display label
   * @param {string} id - Unique ID for the container
   * @param {string} value - Current CSS value (color or gradient)
   * @returns {string} HTML string
   */
  renderGradientPicker(label, id, value) {
    return `
      <div class="control-group">
        <label>${label}</label>
        <div id="${id}"></div>
      </div>
    `;
  },

  /**
   * Bind a gradient picker (creates a GradientSelector instance).
   * @param {string} id - Container element ID
   * @param {string} currentValue - Current CSS background value
   * @param {Function} onChange - Callback with new CSS value (receives cssValue, animationSpeed, animationType)
   * @param {number} [animationSpeed=0] - Optional gradient animation speed (0-10)
   * @param {string} [animationType='pingpong'] - Optional animation type ('pingpong' | 'cycle')
   * @returns {GradientSelector|null} The selector instance, or null
   */
  bindGradientPicker(id, currentValue, onChange, animationSpeed, animationType) {
    if ( ! window.GradientSelector ) return null;

    return new GradientSelector(id, {
      value: currentValue || '#ffffff',
      animationSpeed: animationSpeed ?? 0,
      animationType: animationType || 'pingpong',
      onChange: onChange
    });
  }
};
