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
  render(zIndex = null) {
    const el = super.render(zIndex);
    el.classList.add('countdown-timer-element');

    // Apply background and border styles
    el.style.background = this.properties.background;
    el.style.borderColor = this.properties.borderColor;
    el.style.borderWidth = `${this.properties.borderWidth}px`;
    el.style.borderStyle = 'solid';
    el.style.borderRadius = `${this.properties.borderRadius}px`;
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.overflow = 'hidden';

    if (this.properties.clear) {
      el.classList.add('clear-timer');

      // Red diagonal cross overlay
      const cross = document.createElement('div');
      cross.className = 'clear-cross';
      el.appendChild(cross);
    }

    // Timer display text
    const display = document.createElement('div');
    display.className = 'timer-display';
    display.style.fontFamily = this.properties.font.family;
    display.style.fontSize = `${this.properties.font.size}px`;
    display.style.color = this.properties.font.color;
    display.style.fontWeight = this.properties.font.weight;
    display.style.fontStyle = this.properties.font.style;
    display.style.textDecoration = this.properties.font.decoration;
    display.style.userSelect = 'none';
    display.textContent = CountdownTimerElement.formatTime(this.properties.duration);

    el.appendChild(display);

    return el;
  }
}

Element.registerClass('countdown_timer', CountdownTimerElement);

export default CountdownTimerElement;
