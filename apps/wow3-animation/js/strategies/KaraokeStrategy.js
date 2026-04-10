import { DisplayStrategy } from './DisplayStrategy.js';

/**
 * Classic 3-line karaoke display: previous (dimmed), current (highlighted), next (dimmed).
 * Supports fade transitions on line change.
 */
export class KaraokeStrategy extends DisplayStrategy {
  constructor() {
    super();
    this._prevLine = null;
    this._currentLine = null;
    this._nextLine = null;
    this._lastActiveIdx = -2; // force first render
  }

  /**
   * Build or update 3-line karaoke display.
   * @param {Array} cues
   * @param {number} activeIdx
   * @param {number} relativeMs
   * @param {HTMLElement} container
   * @param {Object} props
   */
  render(cues, activeIdx, relativeMs, container, props) {
    this._container = container;

    // Build DOM on first call
    if (!this._prevLine) {
      this._buildDOM(container);
    }

    // Apply styles every frame (properties may change from panel)
    const colorPrev = props.colorPrev || '#888888';
    const colorCurrent = props.colorCurrent || '#ff9800';
    const animSpeed = props.highlightAnimationSpeed || 0;
    const animType = props.highlightAnimationType || 'pingpong';

    this._prevLine.style.color = colorPrev;
    this._nextLine.style.color = colorPrev;
    this.applyHighlightColor(this._currentLine, colorCurrent, animSpeed, animType);

    for (const line of [this._prevLine, this._currentLine, this._nextLine]) {
      this.applyFontStyles(line, props);
    }

    // Update text content
    if (!cues || cues.length === 0) {
      this._setText('', 'Karaoke', '');
      return;
    }

    // Detect line change for fade transition
    const changed = activeIdx !== this._lastActiveIdx;
    this._lastActiveIdx = activeIdx;

    let prevText = '';
    let currentText = '';
    let nextText = '';

    if (activeIdx >= 0) {
      prevText = activeIdx > 0 ? cues[activeIdx - 1].text : '';
      currentText = cues[activeIdx].text;
      nextText = activeIdx < cues.length - 1 ? cues[activeIdx + 1].text : '';
    } else {
      const nextIdx = cues.findIndex(c => c.startMs > relativeMs);
      if (nextIdx === -1) {
        prevText = cues[cues.length - 1].text;
      } else if (nextIdx === 0) {
        nextText = cues[0].text;
      } else {
        prevText = cues[nextIdx - 1].text;
        nextText = cues[nextIdx].text;
      }
    }

    if (changed) {
      this._fadeTransition(prevText, currentText, nextText);
    } else {
      this._setText(prevText, currentText, nextText);
    }
  }

  destroy() {
    this._prevLine = null;
    this._currentLine = null;
    this._nextLine = null;
    this._lastActiveIdx = -2;
    super.destroy();
  }

  /**
   * Build the 3-line DOM structure.
   * @param {HTMLElement} container
   */
  _buildDOM(container) {
    container.innerHTML = '';

    this._prevLine = document.createElement('div');
    this._prevLine.className = 'karaoke-line karaoke-prev';
    this._prevLine.style.opacity = '0.6';
    this._prevLine.style.transition = 'opacity 0.3s ease';

    this._currentLine = document.createElement('div');
    this._currentLine.className = 'karaoke-line karaoke-current';
    this._currentLine.style.transition = 'opacity 0.3s ease';

    this._nextLine = document.createElement('div');
    this._nextLine.className = 'karaoke-line karaoke-next';
    this._nextLine.style.opacity = '0.6';
    this._nextLine.style.transition = 'opacity 0.3s ease';

    container.appendChild(this._prevLine);
    container.appendChild(this._currentLine);
    container.appendChild(this._nextLine);

    this._currentLine.textContent = 'Karaoke';
  }

  /**
   * Set text without transition.
   * @param {string} prev
   * @param {string} current
   * @param {string} next
   */
  _setText(prev, current, next) {
    this._prevLine.textContent = prev;
    this._currentLine.textContent = current;
    this._nextLine.textContent = next;
  }

  /**
   * Fade out all lines, update text, fade back in.
   * @param {string} prev
   * @param {string} current
   * @param {string} next
   */
  _fadeTransition(prev, current, next) {
    const lines = [this._prevLine, this._currentLine, this._nextLine];
    const targetOpacities = ['0.6', '1', '0.6'];

    // Fade out
    for (const line of lines) {
      line.style.opacity = '0';
    }

    // After fade-out, update text and fade in
    setTimeout(() => {
      this._setText(prev, current, next);
      lines.forEach((line, i) => {
        line.style.opacity = targetOpacities[i];
      });
    }, 150);
  }
}
