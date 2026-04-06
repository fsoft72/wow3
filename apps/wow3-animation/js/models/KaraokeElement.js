import { Element } from '@wow/core/models';
import { findActiveCue } from '../utils/srt-parser.js';

/**
 * Karaoke subtitle element.
 * Displays 3 lines: previous, current (highlighted), next.
 * Synchronized to timeline playhead via updateAtTime().
 */
export class KaraokeElement extends Element {
  /**
   * @param {Object} properties
   */
  constructor(properties = {}) {
    super('karaoke', properties);

    this.properties.srtMediaId = properties.properties?.srtMediaId ?? null;
    this.properties.srtUrl = properties.properties?.srtUrl ?? '';
    this.properties.colorPrev = properties.properties?.colorPrev ?? '#888888';
    this.properties.colorCurrent = properties.properties?.colorCurrent ?? '#ff9800';
    this.properties.colorNext = properties.properties?.colorNext ?? '#888888';
  }

  /**
   * Render the karaoke element DOM.
   * @param {number} zIndex
   * @returns {HTMLElement}
   */
  render(zIndex = null) {
    const el = super.render(zIndex);
    el.classList.add('karaoke-element');

    const font = this.properties.font || {};
    const baseStyle = `
      font-family: ${font.family || 'Roboto'}, sans-serif;
      font-size: ${font.size || 36}px;
      font-weight: ${font.weight || 'bold'};
      text-align: ${font.alignment || 'center'};
      line-height: 1.4;
    `;

    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.justifyContent = 'center';
    el.style.overflow = 'hidden';

    const prevLine = document.createElement('div');
    prevLine.className = 'karaoke-line karaoke-prev';
    prevLine.style.cssText = baseStyle + `color: ${this.properties.colorPrev}; opacity: 0.6;`;

    const currentLine = document.createElement('div');
    currentLine.className = 'karaoke-line karaoke-current';
    currentLine.style.cssText = baseStyle + `color: ${this.properties.colorCurrent};`;

    const nextLine = document.createElement('div');
    nextLine.className = 'karaoke-line karaoke-next';
    nextLine.style.cssText = baseStyle + `color: ${this.properties.colorNext}; opacity: 0.6;`;

    el.appendChild(prevLine);
    el.appendChild(currentLine);
    el.appendChild(nextLine);

    // Show placeholder when no SRT loaded
    currentLine.textContent = 'Karaoke';

    return el;
  }

  /**
   * Update displayed lines based on the current relative time.
   * @param {number} relativeMs - Time relative to clip start
   * @param {Array<{startMs: number, endMs: number, text: string}>} cues - Parsed SRT cues
   */
  updateAtTime(relativeMs, cues) {
    const dom = document.getElementById(this.id);
    if (!dom) return;

    const prevLine = dom.querySelector('.karaoke-prev');
    const currentLine = dom.querySelector('.karaoke-current');
    const nextLine = dom.querySelector('.karaoke-next');
    if (!prevLine || !currentLine || !nextLine) return;

    // Apply current colors (may have been changed from panel)
    const colorPrev = this.properties.colorPrev || '#888888';
    const colorCurrent = this.properties.colorCurrent || '#ff9800';
    const animSpeed = this.properties.highlightAnimationSpeed || 0;
    const animType = this.properties.highlightAnimationType || 'pingpong';

    prevLine.style.color = colorPrev;
    nextLine.style.color = colorPrev;
    this._applyHighlightColor(currentLine, colorCurrent, animSpeed, animType);

    // Update font styles
    const font = this.properties.font || {};
    const baseStyle = `
      font-family: ${font.family || 'Roboto'}, sans-serif;
      font-size: ${font.size || 36}px;
      font-weight: ${font.weight || 'bold'};
      text-align: ${font.alignment || 'center'};
      line-height: 1.4;
    `;
    // Build shadow/stroke CSS
    const sh = font.shadow;
    const textShadow = sh?.enabled
      ? `${sh.offsetX ?? 2}px ${sh.offsetY ?? 2}px ${sh.blur ?? 4}px ${sh.color || '#000000'}`
      : 'none';
    const st = font.stroke;
    const textStroke = st?.enabled
      ? `${st.width ?? 1}px ${st.color || '#000000'}`
      : '';

    for (const line of [prevLine, currentLine, nextLine]) {
      line.style.fontFamily = `${font.family || 'Roboto'}, sans-serif`;
      line.style.fontSize = (font.size || 36) + 'px';
      line.style.fontWeight = font.weight || 'bold';
      line.style.fontStyle = font.style || 'normal';
      line.style.textAlign = font.alignment || 'center';
      line.style.textShadow = textShadow;
      line.style.webkitTextStroke = textStroke;
    }

    if (!cues || cues.length === 0) {
      prevLine.textContent = '';
      currentLine.textContent = 'Karaoke';
      nextLine.textContent = '';
      return;
    }

    const activeIdx = findActiveCue(cues, relativeMs);

    if (activeIdx >= 0) {
      prevLine.textContent = activeIdx > 0 ? cues[activeIdx - 1].text : '';
      currentLine.textContent = cues[activeIdx].text;
      nextLine.textContent = activeIdx < cues.length - 1 ? cues[activeIdx + 1].text : '';
    } else {
      let nextIdx = cues.findIndex(c => c.startMs > relativeMs);
      if (nextIdx === -1) {
        prevLine.textContent = cues[cues.length - 1].text;
        currentLine.textContent = '';
        nextLine.textContent = '';
      } else if (nextIdx === 0) {
        prevLine.textContent = '';
        currentLine.textContent = '';
        nextLine.textContent = cues[0].text;
      } else {
        prevLine.textContent = cues[nextIdx - 1].text;
        currentLine.textContent = '';
        nextLine.textContent = cues[nextIdx].text;
      }
    }
  }

  /**
   * Apply highlight color — supports solid colors, CSS gradients, and gradient animation.
   * @param {HTMLElement} el
   * @param {string} color - CSS color or gradient string
   * @param {number} animSpeed - Gradient animation speed (0 = disabled)
   * @param {string} animType - 'pingpong' or 'cycle'
   */
  _applyHighlightColor(el, color, animSpeed = 0, animType = 'pingpong') {
    if (color.includes('gradient')) {
      el.style.background = color;
      el.style.webkitBackgroundClip = 'text';
      el.style.webkitTextFillColor = 'transparent';
      el.style.backgroundClip = 'text';
      el.style.color = '';

      // Gradient animation
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
