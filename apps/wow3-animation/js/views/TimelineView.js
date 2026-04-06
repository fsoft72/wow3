import { appEvents, AppEvents } from '@wow/core/utils/events.js';

const TRACK_HEIGHT_VISUAL = 48;
const TRACK_HEIGHT_AUDIO  = 36;

/**
 * TimelineView - renders tracks, clips, time ruler, and playhead.
 * Reads state from TimelineController; emits user interactions via appEvents.
 */
export class TimelineView {
  /**
   * @param {import('../controllers/TimelineController.js').TimelineController} timeline
   */
  constructor(timeline) {
    this.timeline = timeline;

    this._trackLabels    = document.getElementById('track-labels-list');
    this._tracksContainer = document.getElementById('tracks-container');
    this._timeRuler      = document.getElementById('time-ruler');
    this._playhead       = document.getElementById('playhead');
    this._timelineBody   = document.getElementById('timeline-body');

    this._bindEvents();
  }

  /** @private */
  _bindEvents() {
    appEvents.on(AppEvents.PLAYHEAD_MOVED, () => this._updatePlayhead());
    appEvents.on(AppEvents.SLIDE_UPDATED, () => this.render());

    this._timelineBody.addEventListener('click', this._onBodyClick.bind(this));

    // Ruler click + scrub
    this._timeRuler.addEventListener('mousedown', (e) => {
      this._onRulerMouseDown(e);
    });
  }

  /**
   * Renders the full timeline (tracks + ruler).
   */
  render() {
    const { project } = this.timeline;
    const duration = project.getEffectiveDuration();
    const totalWidth = Math.max(800, Math.ceil(duration * this.timeline.pxPerMs));

    this._renderRuler(duration, totalWidth);
    this._renderTracks(project.tracks, totalWidth);
    this._updatePlayhead();
  }

  /** @private */
  _renderRuler(duration, totalWidth) {
    this._timeRuler.style.width = totalWidth + 'px';
    this._timeRuler.innerHTML = '';

    const tickIntervalMs = this._getTickInterval();
    for (let t = 0; t <= duration; t += tickIntervalMs) {
      const x = t * this.timeline.pxPerMs;
      const isMajor = (t % (tickIntervalMs * 5)) === 0;

      const tick = document.createElement('div');
      tick.className = 'ruler-tick ' + (isMajor ? 'major' : 'minor');
      tick.style.left = x + 'px';
      this._timeRuler.appendChild(tick);

      if (isMajor) {
        const label = document.createElement('div');
        label.className = 'ruler-label';
        label.style.left = (x + 2) + 'px';
        label.textContent = this._formatTime(t);
        this._timeRuler.appendChild(label);
      }
    }
  }

  /** @private */
  _renderTracks(tracks, totalWidth) {
    this._trackLabels.innerHTML = '';
    this._tracksContainer.innerHTML = '';
    this._tracksContainer.style.width = totalWidth + 'px';

    for (const track of tracks) {
      const h = track.type === 'audio' ? TRACK_HEIGHT_AUDIO : TRACK_HEIGHT_VISUAL;

      // Label
      const label = document.createElement('div');
      label.className = 'track-label' + (track.type === 'audio' ? ' audio-track' : '');
      label.innerHTML =
        `<i class="material-icons">${track.type === 'audio' ? 'music_note' : 'layers'}</i>` +
        `<span class="track-label-name">${track.name}</span>`;
      this._trackLabels.appendChild(label);

      // Row
      const row = document.createElement('div');
      row.className = 'track-row' + (track.type === 'audio' ? ' audio-track' : '');
      row.dataset.trackId = track.id;
      row.style.height = h + 'px';

      for (const clip of track.clips) {
        row.appendChild(this._createClipElement(clip));
      }

      this._tracksContainer.appendChild(row);
    }
  }

  /**
   * Creates a clip DOM element.
   * @param {import('../models/Clip.js').Clip} clip
   * @returns {HTMLElement}
   */
  _createClipElement(clip) {
    const x = clip.startMs * this.timeline.pxPerMs;
    const w = clip.endMs !== null
      ? (clip.endMs - clip.startMs) * this.timeline.pxPerMs
      : 200;

    const el = document.createElement('div');
    el.className = 'timeline-clip ' + (clip.elementType ?? clip.type ?? '');
    el.dataset.clipId = clip.id;
    el.style.left = x + 'px';
    el.style.width = Math.max(8, w) + 'px';
    if (clip.id === this.timeline.selectedClipId) el.classList.add('selected');

    const label = document.createElement('span');
    label.className = 'clip-label';
    label.textContent = clip.name || clip.elementType || clip.type;
    el.appendChild(label);

    // Right resize handle
    const handleR = document.createElement('div');
    handleR.className = 'clip-handle clip-handle-right';
    el.appendChild(handleR);

    // Clip drag (horizontal move)
    this._initClipDrag(el, clip);

    // Right-edge resize
    this._initClipResize(handleR, clip);

    return el;
  }

  /** @private */
  _initClipDrag(clipEl, clip) {
    let startX, startMs;

    const onMouseMove = (e) => {
      const dx = e.clientX - startX;
      const dMs = dx / this.timeline.pxPerMs;
      let newStart = Math.max(0, startMs + dMs);

      // Snap to grid (1s intervals)
      const snapInterval = 1000;
      const snapped = Math.round(newStart / snapInterval) * snapInterval;
      if (Math.abs(newStart - snapped) * this.timeline.pxPerMs < 6) {
        newStart = snapped;
      }

      this.timeline.moveClip(clip.id, newStart);
      clipEl.style.left = (clip.startMs * this.timeline.pxPerMs) + 'px';
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      clipEl.classList.remove('dragging');
      this.render(); // Full re-render to update all visuals
    };

    clipEl.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('clip-handle')) return;
      e.stopPropagation();
      startX = e.clientX;
      startMs = clip.startMs;
      clipEl.classList.add('dragging');

      // Select the clip
      this.timeline.selectClip(clip.id);

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  /** @private */
  _initClipResize(handleEl, clip) {
    let startX, startEndMs;

    const onMouseMove = (e) => {
      const dx = e.clientX - startX;
      const dMs = dx / this.timeline.pxPerMs;
      let newEnd = Math.max(clip.startMs + 200, startEndMs + dMs);

      // Snap to grid
      const snapInterval = 1000;
      const snapped = Math.round(newEnd / snapInterval) * snapInterval;
      if (Math.abs(newEnd - snapped) * this.timeline.pxPerMs < 6) {
        newEnd = snapped;
      }

      this.timeline.resizeClipEnd(clip.id, newEnd);
      const clipEl = handleEl.parentElement;
      clipEl.style.width = Math.max(8, (clip.endMs - clip.startMs) * this.timeline.pxPerMs) + 'px';
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      this.render();
    };

    handleEl.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      startX = e.clientX;
      startEndMs = clip.endMs ?? (clip.startMs + 5000);
      if (clip.endMs === null) clip.endMs = startEndMs;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  /** @private */
  _updatePlayhead() {
    const x = this.timeline.currentTimeMs * this.timeline.pxPerMs;
    this._playhead.style.left = x + 'px';
  }

  /** @private */
  _onBodyClick(e) {
    const clipEl = e.target.closest('.timeline-clip');
    if (clipEl) {
      this.timeline.selectClip(clipEl.dataset.clipId);
      this.render();
      return;
    }
    this.timeline.selectClip(null);
    this.render();
  }

  /** @private */
  _onRulerMouseDown(e) {
    const rect = this._timelineBody.getBoundingClientRect();
    const scrollLeft = this._timelineBody.scrollLeft;

    const setTime = (clientX) => {
      const x = clientX - rect.left + scrollLeft;
      const timeMs = Math.max(0, x / this.timeline.pxPerMs);
      this.timeline.seekTo(timeMs);
    };

    setTime(e.clientX);

    const onMouseMove = (ev) => setTime(ev.clientX);
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Returns tick interval based on current zoom level.
   * @returns {number} ms between ticks
   */
  _getTickInterval() {
    const pxPerMs = this.timeline.pxPerMs;
    if (pxPerMs >= 1)   return 100;
    if (pxPerMs >= 0.1) return 1000;
    return 5000;
  }

  /**
   * Formats milliseconds as hh:mm:ss.
   * @param {number} ms
   * @returns {string}
   */
  _formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return [
      String(h).padStart(2, '0'),
      String(m % 60).padStart(2, '0'),
      String(s % 60).padStart(2, '0')
    ].join(':');
  }
}
