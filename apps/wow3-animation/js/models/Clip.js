import { generateId } from '@wow/core/utils/dom.js';

/**
 * Base class for all timeline clips.
 * A clip is a time-bounded object placed on a track.
 */
export class Clip {
  /**
   * @param {string} type - Clip type identifier ('visual' | 'audio')
   * @param {Object} props - Initial properties
   */
  constructor(type, props = {}) {
    this.id = props.id || generateId('clip');
    this.type = type;
    this.name = props.name || '';

    /** Start time in milliseconds */
    this.startMs = props.startMs ?? 0;

    /**
     * End time in milliseconds. null = until end of project.
     * @type {number|null}
     */
    this.endMs = props.endMs ?? null;

    /** Canvas position and size */
    this.position = {
      x: props.position?.x ?? 0,
      y: props.position?.y ?? 0,
      width: props.position?.width ?? 320,
      height: props.position?.height ?? 180,
      rotation: props.position?.rotation ?? 0
    };

    /** @type {{type: string, duration: number, direction?: string}|null} */
    this.inAnimation = props.inAnimation ?? null;

    /** @type {{type: string, duration: number, direction?: string}|null} */
    this.outAnimation = props.outAnimation ?? null;
  }

  /** Duration in ms. Returns Infinity if endMs is null. */
  get durationMs() {
    if (this.endMs === null) return Infinity;
    return this.endMs - this.startMs;
  }

  /**
   * Returns true if this clip is visible at the given time.
   * @param {number} timeMs
   * @returns {boolean}
   */
  isActiveAt(timeMs) {
    if (timeMs < this.startMs) return false;
    if (this.endMs !== null && timeMs >= this.endMs) return false;
    return true;
  }

  /**
   * Serialize to JSON.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      startMs: this.startMs,
      endMs: this.endMs,
      position: { ...this.position },
      inAnimation: this.inAnimation ? { ...this.inAnimation } : null,
      outAnimation: this.outAnimation ? { ...this.outAnimation } : null
    };
  }

  /**
   * Deserialize from JSON.
   * @param {Object} data
   * @returns {Clip}
   */
  static fromJSON(data) {
    return new Clip(data.type, data);
  }
}
