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
    // Matches wow-core Element model defaults (DEFAULT_SIZE + DEFAULTS constants)
    const defaults = {
      text: {
        position: { x: 100, y: 100, width: 300, height: 100, rotation: 0 },
        properties: {
          text: 'Enter text here',
          editable: true,
          backgroundImage: { url: '', direction: 'none', speed: 0 },
          font: {
            family: 'Roboto', size: 48, color: '#ffffff',
            style: 'normal', weight: 'normal', decoration: 'none',
            alignment: 'left', verticalAlign: 'top',
            shadow: { enabled: false, color: '#000000', offsetX: 2, offsetY: 2, blur: 4 },
            stroke: { enabled: false, color: '#000000', width: 1 }
          }
        }
      },
      image: {
        position: { x: 100, y: 100, width: 400, height: 300, rotation: 0 },
        properties: {
          url: '', objectFit: 'cover', aspectRatio: null,
          crop: null, clipShape: 'none',
          shapeBorderWidth: 0, shapeBorderColor: '#000000', shapeScale: 100
        }
      },
      video: {
        position: { x: 100, y: 100, width: 640, height: 360, rotation: 0 },
        properties: {
          url: '', autoplay: false, loop: false, muted: false, controls: true,
          aspectRatio: 16 / 9, crop: null, clipShape: 'none',
          shapeBorderWidth: 0, shapeBorderColor: '#000000', shapeScale: 100
        }
      },
      shape: {
        position: { x: 100, y: 100, width: 200, height: 200, rotation: 0 },
        properties: { shapeType: 'rectangle', fillColor: '#2196F3', strokeColor: '#000000', strokeWidth: 2 }
      },
      karaoke: {
        position: { x: 100, y: 600, width: 800, height: 200, rotation: 0 },
        properties: {
          srtMediaId: null, srtUrl: '',
          colorPrev: '#888888', colorCurrent: '#ff9800', colorNext: '#888888',
          font: { family: 'Roboto', size: 36, weight: 'bold', alignment: 'center' }
        }
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
