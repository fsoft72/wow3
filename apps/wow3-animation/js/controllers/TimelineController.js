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
   * Adds a clip at the playhead position on the first matching track.
   * @param {import('../models/VisualClip.js').VisualClip|import('../models/AudioClip.js').AudioClip} clip
   * @param {string} [trackId] - Specific track. If omitted, uses first matching type.
   * @returns {string|null} The track ID the clip was added to, or null.
   */
  addClipToTrack(clip, trackId) {
    let track;
    if (trackId) {
      track = this.project.tracks.find(t => t.id === trackId);
    } else {
      const wantType = clip.type === 'audio' ? 'audio' : 'visual';
      track = this.project.tracks.find(t => t.type === wantType);
    }
    if (!track) return null;

    // Place at playhead, default 5s duration
    clip.startMs = this.currentTimeMs;
    if (clip.endMs === null) {
      clip.endMs = clip.startMs + 5000;
    }

    track.addClip(clip);
    this.project.touch();
    this.selectClip(clip.id);
    appEvents.emit(AppEvents.SLIDE_UPDATED);
    return track.id;
  }

  /**
   * Removes a clip by id from its track.
   * @param {string} clipId
   */
  removeClip(clipId) {
    for (const track of this.project.tracks) {
      const idx = track.clips.findIndex(c => c.id === clipId);
      if (idx !== -1) {
        track.clips.splice(idx, 1);
        if (this.selectedClipId === clipId) {
          this.selectedClipId = null;
          this.selectedTrackId = null;
        }
        this.project.touch();
        appEvents.emit(AppEvents.SLIDE_UPDATED);
        return;
      }
    }
  }

  /** Zoom levels: px per ms */
  static ZOOM_MIN = 0.01;
  static ZOOM_MAX = 2.0;
  static ZOOM_STEP = 1.3;

  /**
   * Zoom in by one step.
   */
  zoomIn() {
    this.pxPerMs = Math.min(this.pxPerMs * TimelineController.ZOOM_STEP, TimelineController.ZOOM_MAX);
    appEvents.emit(AppEvents.UI_ZOOM_CHANGED, { pxPerMs: this.pxPerMs });
  }

  /**
   * Zoom out by one step.
   */
  zoomOut() {
    this.pxPerMs = Math.max(this.pxPerMs / TimelineController.ZOOM_STEP, TimelineController.ZOOM_MIN);
    appEvents.emit(AppEvents.UI_ZOOM_CHANGED, { pxPerMs: this.pxPerMs });
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
