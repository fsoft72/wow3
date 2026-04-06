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
   * Creates a VisualClip with sensible defaults for the given element type.
   * @param {string} elementType - 'text'|'image'|'video'|'shape'
   * @param {Object} [overrides]
   * @returns {VisualClip}
   */
  static createDefault(elementType, overrides = {}) {
    const defaults = {
      text: {
        position: { x: 100, y: 100, width: 600, height: 200, rotation: 0 },
        properties: {
          text: 'New Text',
          font: {
            family: 'Roboto', size: 48, color: '#ffffff',
            style: 'normal', weight: '400', decoration: 'none',
            alignment: 'center', verticalAlign: 'middle',
            shadow: { enabled: false, color: '#000000', offsetX: 2, offsetY: 2, blur: 4 },
            stroke: { enabled: false, color: '#000000', width: 1 }
          }
        }
      },
      image: {
        position: { x: 200, y: 100, width: 400, height: 300, rotation: 0 },
        properties: { url: '', objectFit: 'cover', aspectRatio: null }
      },
      video: {
        position: { x: 200, y: 100, width: 640, height: 360, rotation: 0 },
        properties: { url: '', autoplay: true, loop: false, muted: true, controls: false, aspectRatio: 16 / 9 }
      },
      shape: {
        position: { x: 300, y: 200, width: 300, height: 300, rotation: 0 },
        properties: { shapeType: 'rectangle', fillColor: '#2196F3', strokeColor: '#000000', strokeWidth: 0 }
      }
    };

    const d = defaults[elementType] || defaults.shape;
    return new VisualClip(elementType, {
      name: elementType.charAt(0).toUpperCase() + elementType.slice(1),
      position: { ...d.position },
      properties: structuredClone(d.properties),
      ...overrides
    });
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
