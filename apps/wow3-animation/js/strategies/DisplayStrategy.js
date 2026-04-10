/**
 * Abstract base class for karaoke display strategies.
 * Subclasses implement render() and destroy() to manage DOM.
 */
export class DisplayStrategy {
  constructor() {
    /** @type {HTMLElement|null} */
    this._container = null;
  }

  /**
   * Render/update the display at the current time.
   * @param {Array<{index: number, startMs: number, endMs: number, text: string}>} cues
   * @param {number} activeIdx - Index of active cue, or -1
   * @param {number} relativeMs - Time relative to clip start
   * @param {HTMLElement} container - Parent element to render into
   * @param {Object} props - element.properties
   */
  render(cues, activeIdx, relativeMs, container, props) {
    throw new Error('DisplayStrategy.render() must be overridden');
  }

  /**
   * Tear down DOM and clean up event listeners/animations.
   */
  destroy() {
    if (this._container) {
      this._container.innerHTML = '';
    }
  }

  /**
   * Apply shared font, shadow, and stroke styles to an element.
   * @param {HTMLElement} el
   * @param {Object} props - element.properties (contains font, shadow, stroke)
   */
  applyFontStyles(el, props) {
    const font = props.font || {};
    el.style.fontFamily = `${font.family || 'Roboto'}, sans-serif`;
    el.style.fontSize = (font.size || 36) + 'px';
    el.style.fontWeight = font.weight || 'bold';
    el.style.fontStyle = font.style || 'normal';
    el.style.textAlign = font.alignment || 'center';
    el.style.lineHeight = '1.4';

    const sh = font.shadow;
    el.style.textShadow = sh?.enabled
      ? `${sh.offsetX ?? 2}px ${sh.offsetY ?? 2}px ${sh.blur ?? 4}px ${sh.color || '#000000'}`
      : 'none';

    const st = font.stroke;
    el.style.webkitTextStroke = st?.enabled
      ? `${st.width ?? 1}px ${st.color || '#000000'}`
      : '';
  }

  /**
   * Apply highlight color — supports solid colors, CSS gradients, and gradient animation.
   * @param {HTMLElement} el
   * @param {string} color - CSS color or gradient string
   * @param {number} animSpeed - Gradient animation speed (0 = disabled)
   * @param {string} animType - 'pingpong' or 'cycle'
   */
  applyHighlightColor(el, color, animSpeed = 0, animType = 'pingpong') {
    if (color.includes('gradient')) {
      el.style.background = color;
      el.style.webkitBackgroundClip = 'text';
      el.style.webkitTextFillColor = 'transparent';
      el.style.backgroundClip = 'text';
      el.style.color = '';
      if (animSpeed > 0) {
        const duration = Math.max(0.5, 11 - animSpeed);
        const animName = animType === 'cycle' ? 'wow3GradientCycleForward' : 'wow3GradientCycle';
        el.style.backgroundSize = '200% 200%';
        el.style.animation = `${animName} ${duration}s ease infinite`;
      } else {
        el.style.backgroundSize = '';
        el.style.animation = '';
      }
    } else {
      el.style.background = '';
      el.style.webkitBackgroundClip = '';
      el.style.webkitTextFillColor = '';
      el.style.backgroundClip = '';
      el.style.backgroundSize = '';
      el.style.animation = '';
      el.style.color = color;
    }
  }
}
