import { appEvents, AppEvents } from '@wow/core/utils/events.js';
import { Project } from '../models/Project.js';

/**
 * Manages undo/redo via JSON snapshots of the Project state.
 */
export class HistoryManager {
  /**
   * @param {import('./TimelineController.js').TimelineController} timeline
   */
  constructor(timeline) {
    this.timeline = timeline;
    /** @type {string[]} JSON serialized states */
    this._stack = [];
    this._index = -1;
    this._maxSize = 100;

    // Record initial state
    this.recordHistory();
  }

  /**
   * Take a snapshot of the current project state.
   */
  recordHistory() {
    this._stack.splice(this._index + 1);

    const json = JSON.stringify(this.timeline.project.toJSON());
    this._stack.push(json);
    this._index = this._stack.length - 1;

    if (this._stack.length > this._maxSize) {
      this._stack.shift();
      this._index--;
    }
  }

  /**
   * Undo: restore the previous state.
   * @returns {boolean} true if undo was performed
   */
  undo() {
    if (this._index <= 0) return false;
    this._index--;
    this._restore();
    return true;
  }

  /**
   * Redo: restore the next state.
   * @returns {boolean} true if redo was performed
   */
  redo() {
    if (this._index >= this._stack.length - 1) return false;
    this._index++;
    this._restore();
    return true;
  }

  /** @returns {boolean} */
  get canUndo() { return this._index > 0; }

  /** @returns {boolean} */
  get canRedo() { return this._index < this._stack.length - 1; }

  /** @private */
  _restore() {
    const data = JSON.parse(this._stack[this._index]);
    const restored = Project.fromJSON(data);
    const p = this.timeline.project;

    p.title = restored.title;
    p.orientation = restored.orientation;
    p.width = restored.width;
    p.height = restored.height;
    p.durationMs = restored.durationMs;
    p.metadata = restored.metadata;
    p.tracks = restored.tracks;

    this.timeline.selectedClipId = null;
    this.timeline.selectedTrackId = null;

    appEvents.emit(AppEvents.SLIDE_UPDATED);
  }
}
