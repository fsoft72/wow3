import { Clip } from './Clip.js';

/**
 * Clip for audio tracks. No visual position — only timeline placement.
 */
export class AudioClip extends Clip {
  /**
   * @param {Object} props
   */
  constructor(props = {}) {
    super('audio', props);

    /** Media URL or IndexedDB mediaId */
    this.src = props.src ?? '';
    this.mediaId = props.mediaId ?? null;

    /** Fade in/out durations in ms */
    this.fadeInMs = props.fadeInMs ?? 0;
    this.fadeOutMs = props.fadeOutMs ?? 0;

    /** Volume 0–1 */
    this.volume = props.volume ?? 1;
  }

  /**
   * Serialize to JSON.
   * @returns {Object}
   */
  toJSON() {
    return {
      ...super.toJSON(),
      src: this.src,
      mediaId: this.mediaId,
      fadeInMs: this.fadeInMs,
      fadeOutMs: this.fadeOutMs,
      volume: this.volume
    };
  }

  /**
   * Deserialize from JSON.
   * @param {Object} data
   * @returns {AudioClip}
   */
  static fromJSON(data) {
    return new AudioClip(data);
  }
}
