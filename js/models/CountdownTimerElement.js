/**
 * WOW3 Countdown Timer Element
 * Countdown timer element that persists across slides during playback.
 * Supports cross-slide inheritance, clear flag, and completion sounds.
 */

import { Element } from './Element.js';
import { ElementType } from '../utils/constants.js';

export class CountdownTimerElement extends Element {
  /**
   * Create a countdown timer element
   * @param {Object} properties - Element properties
   */
  constructor(properties = {}) {
    super(ElementType.COUNTDOWN_TIMER, properties);

    // Timer-specific properties
    this.properties.duration = properties.properties?.duration ?? 300;
    this.properties.soundId = properties.properties?.soundId || '';
    this.properties.clear = properties.properties?.clear || false;
    this.properties.background = properties.properties?.background || '#000000';
    this.properties.borderColor = properties.properties?.borderColor || '#333333';
    this.properties.borderWidth = properties.properties?.borderWidth ?? 2;
    this.properties.borderRadius = properties.properties?.borderRadius ?? 8;

    // Background gradient animation properties
    this.properties.backgroundAnimationSpeed = properties.properties?.backgroundAnimationSpeed ?? 0;
    this.properties.backgroundAnimationType = properties.properties?.backgroundAnimationType || 'pingpong';

    // Font defaults for countdown timer (larger white text)
    if (!properties.properties?.font?.size) {
      this.properties.font.size = 48;
    }
    if (!properties.properties?.font?.color) {
      this.properties.font.color = '#ffffff';
    }
  }

  /**
   * Format remaining seconds according to display rules
   * @param {number} seconds - Remaining seconds
   * @returns {string} Formatted time string
   */
  static formatTime(seconds) {
    if (seconds <= 0) return '00';
    if (seconds >= 120) return `${Math.ceil(seconds / 60)} m`;
    if (seconds >= 60) {
      const secs = seconds - 60;
      return `1:${String(secs).padStart(2, '0')}`;
    }
    return String(seconds).padStart(2, '0');
  }

  /**
   * Render countdown timer element to DOM
   * @param {number} zIndex - Z-index for stacking (optional)
   * @returns {HTMLElement} DOM element
   */
  /**
   * Build gradient animation CSS string
   * @param {number} speed - Animation speed (0-10, 0 = off)
   * @param {string} animationType - 'pingpong' or 'cycle'
   * @returns {string} CSS animation properties or empty string
   */
  static _gradientAnimCSS(speed, animationType) {
    if (!speed || speed <= 0) return '';
    const kf = animationType === 'cycle' ? 'wow3GradientCycleForward' : 'wow3GradientCycle';
    const ea = animationType === 'cycle' ? 'linear' : 'ease';
    return `background-size: 200% 200%; animation: ${kf} ${11 - speed}s ${ea} infinite;`;
  }

  render(zIndex = null) {
    const el = super.render(zIndex);
    el.classList.add('countdown-timer-element');

    // Build background CSS with optional gradient animation
    const bg = this.properties.background;
    const bgIsGradient = bg && bg.includes('gradient(');
    const bgAnimSpeed = this.properties.backgroundAnimationSpeed ?? 0;
    const bgAnimType = this.properties.backgroundAnimationType || 'pingpong';
    const bgAnimCSS = bgIsGradient ? CountdownTimerElement._gradientAnimCSS(bgAnimSpeed, bgAnimType) : '';

    // Build border CSS — use border-image for gradients, border-color for solids
    const bc = this.properties.borderColor;
    const bcIsGradient = bc && bc.includes('gradient(');
    const borderCSS = bcIsGradient
      ? `border-image: ${bc} 1; border-width: ${this.properties.borderWidth}px; border-style: solid;`
      : `border-color: ${bc}; border-width: ${this.properties.borderWidth}px; border-style: solid;`;

    // Apply background, border, and layout styles
    el.style.cssText += `
      background: ${bg};
      ${bgAnimCSS}
      ${borderCSS}
      border-radius: ${this.properties.borderRadius}px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    `;

    if (this.properties.clear) {
      el.classList.add('clear-timer');

      // Red diagonal cross overlay
      const cross = document.createElement('div');
      cross.className = 'clear-cross';
      el.appendChild(cross);
    }

    // Build font color CSS (gradient text or solid)
    const fontColor = this.properties.font.color;
    const fontIsGradient = fontColor && fontColor.includes('gradient(');
    const fontAnimSpeed = this.properties.font.colorAnimationSpeed ?? 0;
    const fontAnimType = this.properties.font.colorAnimationType || 'pingpong';
    const fontAnimCSS = fontIsGradient ? CountdownTimerElement._gradientAnimCSS(fontAnimSpeed, fontAnimType) : '';
    const colorCSS = fontIsGradient
      ? `background: ${fontColor}; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; ${fontAnimCSS}`
      : `color: ${fontColor};`;

    // Timer display text
    const display = document.createElement('div');
    display.className = 'timer-display';
    display.style.cssText = `
      font-family: ${this.properties.font.family};
      font-size: ${this.properties.font.size}px;
      ${colorCSS}
      font-weight: ${this.properties.font.weight};
      font-style: ${this.properties.font.style};
      text-decoration: ${this.properties.font.decoration};
      user-select: none;
    `;
    display.textContent = CountdownTimerElement.formatTime(this.properties.duration);

    el.appendChild(display);

    return el;
  }
}

Element.registerClass('countdown_timer', CountdownTimerElement);

export default CountdownTimerElement;
