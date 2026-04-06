import { appEvents, AppEvents } from '@wow/core/utils/events.js';

/**
 * PlaybackEngine - drives time-based playback using requestAnimationFrame.
 * Emits PLAYHEAD_MOVED events on each tick.
 */
export class PlaybackEngine {
  /**
   * @param {import('./TimelineController.js').TimelineController} timeline
   */
  constructor(timeline) {
    this.timeline = timeline;
    this._rafId = null;
    this._lastTimestamp = null;
    this.isPlaying = false;
  }

  /**
   * Start playback from current position.
   */
  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this._lastTimestamp = null;
    this._rafId = requestAnimationFrame(this._tick.bind(this));
    appEvents.emit(AppEvents.PLAYBACK_STARTED);
  }

  /**
   * Pause playback at current position.
   */
  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
    appEvents.emit(AppEvents.PLAYBACK_STOPPED);
  }

  /**
   * Stop playback and rewind to start.
   */
  stop() {
    this.pause();
    this.timeline.seekTo(0);
  }

  /**
   * Toggle play/pause.
   */
  toggle() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  /**
   * rAF callback — advance playhead by delta time.
   * @param {number} timestamp
   */
  _tick(timestamp) {
    if (!this._lastTimestamp) this._lastTimestamp = timestamp;
    const deltaMs = timestamp - this._lastTimestamp;
    this._lastTimestamp = timestamp;

    const duration = this.timeline.project.getEffectiveDuration();
    const newTime = this.timeline.currentTimeMs + deltaMs;

    if (newTime >= duration) {
      this.timeline.seekTo(duration);
      this.pause();
      return;
    }

    this.timeline.seekTo(newTime);
    this._rafId = requestAnimationFrame(this._tick.bind(this));
  }
}
