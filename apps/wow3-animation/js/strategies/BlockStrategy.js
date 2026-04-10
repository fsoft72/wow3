import { DisplayStrategy } from './DisplayStrategy.js';

/**
 * Multi-line block display with highlighted current line.
 * Shows N visible lines; scrolls to keep active line centered.
 */
export class BlockStrategy extends DisplayStrategy {
  constructor() {
    super();
    this._lines = [];
    this._wrapper = null;
    this._lastActiveIdx = -2;
    this._lastWindowStart = -1;
  }

  /**
   * Build or update multi-line block display.
   * @param {Array} cues
   * @param {number} activeIdx
   * @param {number} relativeMs
   * @param {HTMLElement} container
   * @param {Object} props
   */
  render(cues, activeIdx, relativeMs, container, props) {
    this._container = container;
    const visibleLines = props.block?.visibleLines ?? 5;
    const highlightBg = props.block?.highlightBg ?? 'transparent';
    const colorPrev = props.colorPrev || '#888888';
    const colorCurrent = props.colorCurrent || '#ff9800';

    if (!cues || cues.length === 0) {
      this._clear();
      return;
    }

    // Calculate the window of cues to show
    const totalCues = cues.length;
    const count = Math.min(visibleLines, totalCues);
    let windowStart = 0;

    if (activeIdx >= 0) {
      // Center the active line in the visible window
      const halfWindow = Math.floor(count / 2);
      windowStart = Math.max(0, Math.min(activeIdx - halfWindow, totalCues - count));
    }

    // Rebuild DOM if line count changed or first call
    if (!this._wrapper || this._lines.length !== count) {
      this._buildDOM(container, count);
    }

    // Detect window change for fade transition
    const windowChanged = windowStart !== this._lastWindowStart;
    this._lastWindowStart = windowStart;
    this._lastActiveIdx = activeIdx;

    if (windowChanged) {
      // Fade transition on scroll
      this._wrapper.style.opacity = '0';
      setTimeout(() => {
        this._updateLines(cues, activeIdx, windowStart, count, colorPrev, colorCurrent, highlightBg, props);
        this._wrapper.style.opacity = '1';
      }, 150);
    } else {
      this._updateLines(cues, activeIdx, windowStart, count, colorPrev, colorCurrent, highlightBg, props);
    }
  }

  destroy() {
    this._lines = [];
    this._wrapper = null;
    this._lastActiveIdx = -2;
    this._lastWindowStart = -1;
    super.destroy();
  }

  /**
   * Build N line elements inside a wrapper.
   * @param {HTMLElement} container
   * @param {number} count
   */
  _buildDOM(container, count) {
    container.innerHTML = '';

    this._wrapper = document.createElement('div');
    this._wrapper.className = 'block-container';
    this._wrapper.style.cssText = 'display: flex; flex-direction: column; justify-content: center; height: 100%; transition: opacity 0.3s ease;';

    this._lines = [];
    for (let i = 0; i < count; i++) {
      const line = document.createElement('div');
      line.className = 'block-line';
      line.style.cssText = 'padding: 2px 8px; word-wrap: break-word; overflow-wrap: break-word; transition: background-color 0.2s ease, color 0.2s ease;';
      this._wrapper.appendChild(line);
      this._lines.push(line);
    }

    container.appendChild(this._wrapper);
  }

  /**
   * Update line text, colors, and highlight.
   * @param {Array} cues
   * @param {number} activeIdx
   * @param {number} windowStart
   * @param {number} count
   * @param {string} colorPrev
   * @param {string} colorCurrent
   * @param {string} highlightBg
   * @param {Object} props
   */
  _updateLines(cues, activeIdx, windowStart, count, colorPrev, colorCurrent, highlightBg, props) {
    for (let i = 0; i < count; i++) {
      const cueIdx = windowStart + i;
      const line = this._lines[i];
      if (!line) continue;

      this.applyFontStyles(line, props);

      if (cueIdx < cues.length) {
        line.textContent = cues[cueIdx].text;

        if (cueIdx === activeIdx) {
          line.style.color = colorCurrent;
          line.style.backgroundColor = highlightBg;
          line.style.opacity = '1';
        } else {
          line.style.color = colorPrev;
          line.style.backgroundColor = 'transparent';
          line.style.opacity = '0.6';
        }
      } else {
        line.textContent = '';
        line.style.backgroundColor = 'transparent';
      }
    }
  }

  /**
   * Clear all line content.
   */
  _clear() {
    if (this._wrapper) {
      for (const line of this._lines) {
        line.textContent = '';
      }
    }
  }
}
