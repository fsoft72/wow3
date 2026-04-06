/**
 * RangeInput — Reusable synced range slider + number input component.
 *
 * Renders a slider-row with a range input and a number input that stay
 * in sync. Optionally includes a label and unit suffix. Reuses the
 * existing .slider-row / .number-box / .slider / .number-input CSS
 * classes from panels.css.
 *
 * Usage:
 *   const range = new RangeInput('my-container', {
 *     label: 'Angle',
 *     value: 90,
 *     min: 0,
 *     max: 360,
 *     step: 1,
 *     unit: '°',
 *     onChange: (val) => { ... }
 *   });
 *
 *   range.update(180);        // set value externally
 *   range.getValue();         // 180
 *   range.setVisible(false);  // hide the whole component
 */
class RangeInput {

  /**
   * @param {string} containerId - ID of the DOM element to render into
   * @param {Object} [options]
   * @param {string} [options.label] - Optional label text
   * @param {number} [options.value=0] - Initial value
   * @param {number} [options.min=0] - Minimum value
   * @param {number} [options.max=100] - Maximum value
   * @param {number} [options.step=1] - Step increment
   * @param {string} [options.unit=''] - Unit label (e.g. '°', 'px', '%')
   * @param {Function} [options.onChange] - Called with the new numeric value on every change
   */
  constructor(containerId, options = {}) {
    this._containerId = containerId;
    this._container = document.getElementById(containerId);
    if ( ! this._container ) return;

    this._min = options.min !== undefined ? options.min : 0;
    this._max = options.max !== undefined ? options.max : 100;
    this._step = options.step !== undefined ? options.step : 1;
    this._value = options.value !== undefined ? options.value : 0;
    this._unit = options.unit || '';
    this._label = options.label || '';
    this._onChange = options.onChange || (() => {});

    this._render();
    this._bind();
  }

  // ─── Public API ───────────────────────────────────────────

  /**
   * Update the value externally.
   * @param {number} value
   */
  update(value) {
    this._value = this._clamp(value);
    this._slider.value = this._value;
    this._input.value = this._value;
  }

  /**
   * Get the current value.
   * @returns {number}
   */
  getValue() {
    return this._value;
  }

  /**
   * Show or hide the entire component.
   * @param {boolean} visible
   */
  setVisible(visible) {
    this._container.style.display = visible ? '' : 'none';
  }

  // ─── Rendering ────────────────────────────────────────────

  /** Build the DOM. */
  _render() {
    const labelHtml = this._label
      ? `<label>${this._label}</label>`
      : '';
    const unitHtml = this._unit
      ? `<span class="unit-label">${this._unit}</span>`
      : '';

    this._container.innerHTML = `
      ${labelHtml}
      <div class="slider-row">
        <input type="range" class="slider" min="${this._min}" max="${this._max}" step="${this._step}" value="${this._value}">
        <div class="number-box">
          <input type="number" class="number-input" min="${this._min}" max="${this._max}" step="${this._step}" value="${this._value}">
          ${unitHtml}
        </div>
      </div>
    `;

    this._slider = this._container.querySelector('input[type="range"]');
    this._input = this._container.querySelector('input[type="number"]');
  }

  /** Bind event listeners to keep inputs in sync. */
  _bind() {
    this._slider.addEventListener('input', (e) => this._handleChange(e.target.value));
    this._input.addEventListener('change', (e) => this._handleChange(e.target.value));
  }

  // ─── Internal ─────────────────────────────────────────────

  /**
   * Handle value change from either input.
   * @param {string} raw - Raw input value
   */
  _handleChange(raw) {
    this._value = this._clamp(parseFloat(raw) || 0);
    this._slider.value = this._value;
    this._input.value = this._value;
    this._onChange(this._value);
  }

  /**
   * Clamp a value to the configured min/max range.
   * @param {number} val
   * @returns {number}
   */
  _clamp(val) {
    return Math.max(this._min, Math.min(this._max, val));
  }
}

window.RangeInput = RangeInput;
