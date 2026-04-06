import { generateId } from '@wow/core/utils/dom.js';
import { VisualClip } from './VisualClip.js';
import { AudioClip } from './AudioClip.js';

/** @typedef {'visual'|'audio'} TrackType */

/**
 * A horizontal lane on the timeline containing non-overlapping clips.
 * Visual tracks render on the canvas; audio tracks are timeline-only.
 */
export class Track {
  /**
   * @param {TrackType} type
   * @param {Object} props
   */
  constructor(type, props = {}) {
    this.id = props.id || generateId('track');
    this.type = type;
    this.name = props.name || (type === 'audio' ? 'Audio' : 'Layer');
    this.visible = props.visible ?? true;
    this.locked = props.locked ?? false;

    /** @type {(VisualClip|AudioClip)[]} */
    this.clips = (props.clips ?? []).map(c => Track._deserializeClip(c));
  }

  /**
   * Adds a clip to the track.
   * @param {VisualClip|AudioClip} clip
   */
  addClip(clip) {
    this.clips.push(clip);
  }

  /**
   * Removes a clip by id.
   * @param {string} clipId
   */
  removeClip(clipId) {
    this.clips = this.clips.filter(c => c.id !== clipId);
  }

  /**
   * Returns the clip active at the given time, or null.
   * @param {number} timeMs
   * @returns {VisualClip|AudioClip|null}
   */
  getClipAt(timeMs) {
    return this.clips.find(c => c.isActiveAt(timeMs)) ?? null;
  }

  /**
   * Returns all clips active at the given time.
   * @param {number} timeMs
   * @returns {(VisualClip|AudioClip)[]}
   */
  getActiveClips(timeMs) {
    return this.clips.filter(c => c.isActiveAt(timeMs));
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
      visible: this.visible,
      locked: this.locked,
      clips: this.clips.map(c => c.toJSON())
    };
  }

  /**
   * Deserialize from JSON.
   * @param {Object} data
   * @returns {Track}
   */
  static fromJSON(data) {
    return new Track(data.type, data);
  }

  /**
   * @param {Object} data
   * @returns {VisualClip|AudioClip}
   */
  static _deserializeClip(data) {
    if (data.type === 'audio') return AudioClip.fromJSON(data);
    return VisualClip.fromJSON(data);
  }
}
