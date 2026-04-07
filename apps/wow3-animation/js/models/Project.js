import { generateId } from '@wow/core/utils/dom.js';
import { Track } from './Track.js';

/**
 * Top-level data model for a wow3-animation project.
 * Contains tracks (visual + audio) and project metadata.
 */
export class Project {
  /**
   * @param {Object} props
   */
  constructor(props = {}) {
    this.id = props.id || generateId('project');
    this.title = props.title || 'Untitled Project';

    /**
     * Canvas orientation.
     * @type {'landscape'|'portrait'}
     */
    this.orientation = props.orientation ?? 'landscape';

    /** Canvas width in px (1920 for landscape, 1080 for portrait) */
    this.width = this.orientation === 'portrait' ? 1080 : 1920;
    /** Canvas height in px (1080 for landscape, 1920 for portrait) */
    this.height = this.orientation === 'portrait' ? 1920 : 1080;

    /**
     * Total project duration in ms. 0 = auto (max clip end time).
     * @type {number}
     */
    this.durationMs = props.durationMs ?? 0;

    this.metadata = {
      created: props.metadata?.created ?? new Date().toISOString(),
      modified: props.metadata?.modified ?? new Date().toISOString(),
      author: props.metadata?.author ?? '',
      version: props.metadata?.version ?? '1.0.0',
      mediaFolderId: props.metadata?.mediaFolderId ?? null
    };

    /** @type {Track[]} */
    this.tracks = (props.tracks ?? []).map(t => Track.fromJSON(t));
  }

  /**
   * Effective duration: explicit durationMs or max clip end time.
   * @returns {number} ms
   */
  getEffectiveDuration() {
    if (this.durationMs > 0) return this.durationMs;
    let max = 0;
    for (const track of this.tracks) {
      for (const clip of track.clips) {
        if (clip.endMs !== null && clip.endMs > max) max = clip.endMs;
      }
    }
    return max || 30000; // default 30s if empty
  }

  /**
   * Finds a clip and its parent track by clip id.
   * @param {string} clipId
   * @returns {{track: Track|null, clip: import('./Clip.js').Clip|null}}
   */
  findClip(clipId) {
    for (const track of this.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) return { track, clip };
    }
    return { track: null, clip: null };
  }

  /**
   * Adds a new track to the project.
   * @param {'visual'|'audio'} type
   * @param {Object} [opts]
   * @param {'top'|'bottom'} [opts.position='bottom'] - Where to insert the track.
   * @returns {Track}
   */
  addTrack(type, opts = {}) {
    const track = new Track(type, { name: opts.name });
    if (opts.position === 'top') {
      this.tracks.unshift(track);
    } else {
      this.tracks.push(track);
    }
    return track;
  }

  /**
   * Removes a track by id.
   * @param {string} trackId
   */
  removeTrack(trackId) {
    this.tracks = this.tracks.filter(t => t.id !== trackId);
  }

  /**
   * Updates the modified timestamp.
   */
  touch() {
    this.metadata.modified = new Date().toISOString();
  }

  /**
   * Serialize to JSON.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      orientation: this.orientation,
      width: this.width,
      height: this.height,
      durationMs: this.durationMs,
      metadata: { ...this.metadata },
      tracks: this.tracks.map(t => t.toJSON())
    };
  }

  /**
   * Deserialize from JSON.
   * @param {Object} data
   * @returns {Project}
   */
  static fromJSON(data) {
    return new Project(data);
  }
}
