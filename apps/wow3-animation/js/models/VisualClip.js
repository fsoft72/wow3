import { Clip } from './Clip.js';

/**
 * Clip for visual objects: text, image, video, shape, karaoke.
 * Extends Clip with element-type-specific properties.
 */
export class VisualClip extends Clip {
  /**
   * @param {string} elementType - 'text' | 'image' | 'video' | 'shape' | 'karaoke'
   * @param {Object} props
   */
  constructor(elementType, props = {}) {
    super('visual', props);
    this.elementType = elementType;

    /**
     * Element-specific properties (font, color, src, etc.)
     * @type {Object}
     */
    this.properties = props.properties ?? {};

    /**
     * For image clips: Ken Burns effect config.
     * @type {{zoom?: {from: number, to: number}, pan?: {fromX: number, fromY: number, toX: number, toY: number}, bokeh?: {from: number, to: number}}|null}
     */
    this.kenBurns = props.kenBurns ?? null;

    /**
     * For video clips: trim points in seconds.
     * @type {{start: number, end: number|null}|null}
     */
    this.trim = props.trim ?? null;
  }

  /**
   * Serialize to JSON.
   * @returns {Object}
   */
  toJSON() {
    return {
      ...super.toJSON(),
      elementType: this.elementType,
      properties: structuredClone(this.properties),
      kenBurns: this.kenBurns ? { ...this.kenBurns } : null,
      trim: this.trim ? { ...this.trim } : null
    };
  }

  /**
   * Deserialize from JSON.
   * @param {Object} data
   * @returns {VisualClip}
   */
  static fromJSON(data) {
    return new VisualClip(data.elementType, data);
  }
}
