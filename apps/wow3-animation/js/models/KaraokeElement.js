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

    if (!cues || cues.length === 0) {
      prevLine.textContent = '';
      currentLine.textContent = 'Karaoke';
      nextLine.textContent = '';
      return;
    }

    const activeIdx = findActiveCue(cues, relativeMs);

    if (activeIdx >= 0) {
      // Active cue found
      prevLine.textContent = activeIdx > 0 ? cues[activeIdx - 1].text : '';
      currentLine.textContent = cues[activeIdx].text;
      nextLine.textContent = activeIdx < cues.length - 1 ? cues[activeIdx + 1].text : '';
    } else {
      // Between cues — find the next upcoming cue
      let nextIdx = cues.findIndex(c => c.startMs > relativeMs);
      if (nextIdx === -1) {
        // Past all cues
        prevLine.textContent = cues[cues.length - 1].text;
        currentLine.textContent = '';
        nextLine.textContent = '';
      } else if (nextIdx === 0) {
        // Before first cue
        prevLine.textContent = '';
        currentLine.textContent = '';
        nextLine.textContent = cues[0].text;
      } else {
        // Between two cues
        prevLine.textContent = cues[nextIdx - 1].text;
        currentLine.textContent = '';
        nextLine.textContent = cues[nextIdx].text;
      }
    }
  }
}
