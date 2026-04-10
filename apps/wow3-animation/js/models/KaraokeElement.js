import { Element } from '@wow/core/models';
import { findActiveCue } from '../utils/srt-parser.js';
import { createStrategy } from '../strategies/index.js';

/**
 * Karaoke subtitle element.
 * Delegates display rendering to a DisplayStrategy based on displayMode.
 * Synchronized to timeline playhead via updateAtTime().
 */
export class KaraokeElement extends Element {
  /**
   * @param {Object} properties
   */
  constructor(properties = {}) {
    super('karaoke', properties);

    this.properties.colorPrev = properties.properties?.colorPrev ?? '#888888';
    this.properties.colorCurrent = properties.properties?.colorCurrent ?? '#ff9800';
    this.properties.colorNext = properties.properties?.colorNext ?? '#888888';
    this.properties.displayMode = properties.properties?.displayMode ?? 'karaoke';

    /** @type {import('../strategies/DisplayStrategy.js').DisplayStrategy} */
    this._strategy = createStrategy(this.properties.displayMode);
    /** @type {string} Tracks current mode to detect changes */
    this._currentMode = this.properties.displayMode;
  }

  /**
   * Render the karaoke element DOM.
   * @param {number} zIndex
   * @returns {HTMLElement}
   */
  render(zIndex = null) {
    const el = super.render(zIndex);
    el.classList.add('karaoke-element');

    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.justifyContent = 'center';
    el.style.overflow = 'hidden';

    // Initial render with empty cues (shows placeholder)
    this._strategy.render([], -1, 0, el, this.properties);

    return el;
  }

  /**
   * Update displayed content based on the current relative time.
   * Handles strategy swap when displayMode changes.
   * @param {number} relativeMs - Time relative to clip start
   * @param {Array<{startMs: number, endMs: number, text: string}>} cues - Parsed SRT cues
   */
  updateAtTime(relativeMs, cues) {
    const dom = document.getElementById(this.id);
    if (!dom) return;

    // Swap strategy if mode changed
    const mode = this.properties.displayMode || 'karaoke';
    if (mode !== this._currentMode) {
      this._strategy.destroy();
      this._strategy = createStrategy(mode);
      this._currentMode = mode;
    }

    const activeIdx = findActiveCue(cues, relativeMs);
    this._strategy.render(cues, activeIdx, relativeMs, dom, this.properties);
  }
}
