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
   * Render font family options
   */
  fontFamilyOptions(current) {
    const fonts = [
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
    ];

    const isSelected = (val) => current && current.replace(/['"]/g, '') === val.replace(/['"]/g, '');

    return fonts
      .map(f => `<option value="${f.value}" ${isSelected(f.value) ? 'selected' : ''}>${f.label}</option>`)
      .join('');
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

    if (!colorInput || !textInput) return;

    colorInput.addEventListener('change', (e) => {
      textInput.value = e.target.value;
      if (onChange) onChange(e.target.value);
    });

    textInput.addEventListener('change', (e) => {
      const value = e.target.value;
      if (value.startsWith('#') || value.startsWith('rgb')) {
        if (value.startsWith('#')) {
          colorInput.value = value;
        }
        if (onChange) onChange(value);
      }
    });
  }
};
