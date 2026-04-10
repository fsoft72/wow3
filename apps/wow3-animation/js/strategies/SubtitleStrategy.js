import { DisplayStrategy } from './DisplayStrategy.js';

/**
 * Single-line cinematic subtitle display.
 * Uses A/B swap technique for cross-fade between cues.
 */
export class SubtitleStrategy extends DisplayStrategy {
  constructor() {
    super();
    this._lineA = null;
    this._lineB = null;
    /** @type {'a'|'b'} Which line is currently visible */
    this._activeSlot = 'a';
    this._lastActiveIdx = -2;
    this._lastText = '';
  }

  /**
   * Build or update single-line subtitle display.
   * @param {Array} cues
   * @param {number} activeIdx
   * @param {number} relativeMs
   * @param {HTMLElement} container
   * @param {Object} props
   */
  render(cues, activeIdx, relativeMs, container, props) {
    this._container = container;
    const fadeDuration = props.subtitle?.fadeDuration ?? 200;
    const position = props.subtitle?.position ?? 'bottom';
    const transitionCss = `opacity ${fadeDuration}ms ease`;

    // Build DOM on first call
    if (!this._lineA) {
      this._buildDOM(container);
    }

    // Apply position
    container.style.justifyContent = position === 'top' ? 'flex-start'
      : position === 'center' ? 'center' : 'flex-end';

    // Apply styles to both slots
    for (const line of [this._lineA, this._lineB]) {
      this.applyFontStyles(line, props);
      line.style.transition = transitionCss;
    }

    const colorCurrent = props.colorCurrent || '#ff9800';

    if (!cues || cues.length === 0) {
      this._hideAll();
      return;
    }

    // No change — just update styles
    if (activeIdx === this._lastActiveIdx) {
      const activeLine = this._activeSlot === 'a' ? this._lineA : this._lineB;
      activeLine.style.color = colorCurrent;
      return;
    }

    this._lastActiveIdx = activeIdx;

    if (activeIdx < 0) {
      // No active cue — fade out current
      this._hideAll();
      this._lastText = '';
      return;
    }

    const newText = cues[activeIdx].text;

    if (this._lastText === '') {
      // Fade in (from nothing)
      const activeLine = this._activeSlot === 'a' ? this._lineA : this._lineB;
      activeLine.textContent = newText;
      activeLine.style.color = colorCurrent;
      activeLine.style.opacity = '1';
    } else {
      // Cross-fade: hide old slot, show new slot
      const oldLine = this._activeSlot === 'a' ? this._lineA : this._lineB;
      const newLine = this._activeSlot === 'a' ? this._lineB : this._lineA;

      oldLine.style.opacity = '0';
      newLine.textContent = newText;
      newLine.style.color = colorCurrent;
      newLine.style.opacity = '1';

      this._activeSlot = this._activeSlot === 'a' ? 'b' : 'a';
    }

    this._lastText = newText;
  }

  destroy() {
    this._lineA = null;
    this._lineB = null;
    this._activeSlot = 'a';
    this._lastActiveIdx = -2;
    this._lastText = '';
    super.destroy();
  }

  /**
   * Build A/B subtitle lines (stacked via position: absolute).
   * @param {HTMLElement} container
   */
  _buildDOM(container) {
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'subtitle-wrapper';
    wrapper.style.cssText = 'position: relative; width: 100%;';

    this._lineA = document.createElement('div');
    this._lineA.className = 'subtitle-line subtitle-line-a';
    this._lineA.style.cssText = 'opacity: 0; position: absolute; width: 100%; left: 0;';

    this._lineB = document.createElement('div');
    this._lineB.className = 'subtitle-line subtitle-line-b';
    this._lineB.style.cssText = 'opacity: 0; position: absolute; width: 100%; left: 0;';

    wrapper.appendChild(this._lineA);
    wrapper.appendChild(this._lineB);
    container.appendChild(wrapper);
  }

  /**
   * Fade out both lines.
   */
  _hideAll() {
    if (this._lineA) this._lineA.style.opacity = '0';
    if (this._lineB) this._lineB.style.opacity = '0';
  }
}
