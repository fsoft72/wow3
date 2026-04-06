import { appEvents, AppEvents } from '@wow/core/utils/events.js';
import { Project } from '../models/Project.js';

/**
 * TimelineController - manages project state, playhead position, and clip selection.
 * Coordinates between PlaybackEngine and TimelineView.
 */
export class TimelineController {
  /**
   * @param {Project} project
   */
  constructor(project) {
    this.project = project;

    /** Current playhead position in ms */
    this.currentTimeMs = 0;

    /** Pixels per millisecond (zoom level) */
    this.pxPerMs = 0.1;

    /** @type {string|null} Selected clip id */
    this.selectedClipId = null;

    /** @type {string|null} Selected track id */
    this.selectedTrackId = null;
  }

  /**
   * Seeks the playhead to the given time.
   * @param {number} timeMs
   */
  seekTo(timeMs) {
    const duration = this.project.getEffectiveDuration();
    this.currentTimeMs = Math.max(0, Math.min(timeMs, duration));
    appEvents.emit(AppEvents.PLAYHEAD_MOVED, { timeMs: this.currentTimeMs });
  }

  /**
   * Selects a clip by id.
   * @param {string|null} clipId
   */
  selectClip(clipId) {
    this.selectedClipId = clipId;
    this.selectedTrackId = null;

    if (clipId) {
      const { track, clip } = this._findClip(clipId);
      if (track) this.selectedTrackId = track.id;
      appEvents.emit(AppEvents.ELEMENT_SELECTED, { clip, track });
    } else {
      appEvents.emit(AppEvents.ELEMENT_DESELECTED);
    }
  }

  /**
   * Moves a clip to a new start time (preserving duration if endMs set).
   * @param {string} clipId
   * @param {number} newStartMs
   */
  moveClip(clipId, newStartMs) {
    const { clip } = this._findClip(clipId);
    if (!clip) return;

    const dur = clip.endMs !== null ? clip.endMs - clip.startMs : null;
    clip.startMs = Math.max(0, newStartMs);
    if (dur !== null) clip.endMs = clip.startMs + dur;
    this.project.touch();
    appEvents.emit(AppEvents.SLIDE_UPDATED);
  }

  /**
   * Resizes a clip by changing its end time.
   * @param {string} clipId
   * @param {number} newEndMs
   */
  resizeClipEnd(clipId, newEndMs) {
    const { clip } = this._findClip(clipId);
    if (!clip) return;

    clip.endMs = Math.max(clip.startMs + 100, newEndMs);
    this.project.touch();
    appEvents.emit(AppEvents.SLIDE_UPDATED);
  }

  /**
   * Finds a clip and its parent track by clip id.
   * @param {string} clipId
   * @returns {{track: import('../models/Track.js').Track|null, clip: import('../models/Clip.js').Clip|null}}
   */
  _findClip(clipId) {
    for (const track of this.project.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) return { track, clip };
    }
    return { track: null, clip: null };
  }
}
