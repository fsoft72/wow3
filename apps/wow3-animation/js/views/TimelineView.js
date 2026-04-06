import { appEvents, AppEvents } from '@wow/core/utils/events.js';
import { WaveformRenderer } from './WaveformRenderer.js';

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
    this._waveformRenderer = new WaveformRenderer();
    /** @type {boolean} Suppresses re-render during clip drag/resize */
    this._isDragging = false;

    /**
     * Callback for when a clip is dropped on the timeline.
     * Set by app.js.
     * @type {Function|null}
     */
    this.onClipDropped = null;

    /**
     * Callback for when a clip is selected on the timeline.
     * Set by app.js.
     * @type {Function|null}
     */
    this.onClipSelected = null;

    /**
     * Callback for double-click on an audio clip.
     * Set by app.js.
     * @type {Function|null}
     */
    this.onAudioClipDblClick = null;

    this._bindEvents();
  }

  /** @private */
  _bindEvents() {
    appEvents.on(AppEvents.PLAYHEAD_MOVED, ({ timeMs }) => {
      this._updatePlayhead();
      this._autoScrollToPlayhead(timeMs);
    });
    appEvents.on(AppEvents.SLIDE_UPDATED, () => this.render());

    this._timelineBody.addEventListener('click', this._onBodyClick.bind(this));

    // Ruler click + scrub
    this._timeRuler.addEventListener('mousedown', (e) => {
      this._onRulerMouseDown(e);
    });

    // Wheel zoom on timeline body
    this._timelineBody.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      if (e.deltaY < 0) this.timeline.zoomIn();
      else this.timeline.zoomOut();
      this.render();
    }, { passive: false });

    // Add track buttons
    document.getElementById('btn-add-visual-track')?.addEventListener('click', () => {
      this.timeline.addTrack('visual');
      this.render();
    });
    document.getElementById('btn-add-audio-track')?.addEventListener('click', () => {
      this.timeline.addTrack('audio');
      this.render();
    });

    // Zoom buttons
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      this.timeline.zoomIn();
      this.render();
    });
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      this.timeline.zoomOut();
      this.render();
    });
  }

  /**
   * Renders the full timeline (tracks + ruler).
   * Skipped while a clip is being dragged/resized to preserve DOM references.
   */
  render() {
    if (this._isDragging) return;
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

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const h = track.type === 'audio' ? TRACK_HEIGHT_AUDIO : TRACK_HEIGHT_VISUAL;

      // ── Track label ──
      const label = document.createElement('div');
      label.className = 'track-label' + (track.type === 'audio' ? ' audio-track' : '');
      label.draggable = true;
      label.dataset.trackId = track.id;
      label.dataset.trackIndex = i;

      const icon = document.createElement('i');
      icon.className = 'material-icons';
      icon.textContent = track.type === 'audio' ? 'music_note' : 'layers';
      label.appendChild(icon);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'track-label-name';
      nameSpan.textContent = track.name;
      label.appendChild(nameSpan);

      const delBtn = document.createElement('i');
      delBtn.className = 'material-icons track-delete-btn';
      delBtn.textContent = 'close';
      delBtn.title = 'Delete track';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.timeline.removeTrack(track.id);
        this.render();
      });
      label.appendChild(delBtn);

      // Double-click to rename
      nameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.className = 'track-rename-input';
        input.value = track.name;
        nameSpan.replaceWith(input);
        input.focus();
        input.select();
        const finish = () => {
          this.timeline.renameTrack(track.id, input.value || track.name);
          this.render();
        };
        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') input.blur();
          if (ev.key === 'Escape') { input.value = track.name; input.blur(); }
        });
      });

      // Drag reorder
      label.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', track.id);
        label.classList.add('dragging');
      });
      label.addEventListener('dragend', () => label.classList.remove('dragging'));
      label.addEventListener('dragover', (e) => {
        e.preventDefault();
        label.classList.add('drag-over');
      });
      label.addEventListener('dragleave', () => label.classList.remove('drag-over'));
      label.addEventListener('drop', (e) => {
        e.preventDefault();
        label.classList.remove('drag-over');
        const draggedId = e.dataTransfer.getData('text/plain');
        this.timeline.reorderTrack(draggedId, i);
        this.render();
      });

      this._trackLabels.appendChild(label);

      // ── Track row ──
      const row = document.createElement('div');
      row.className = 'track-row' + (track.type === 'audio' ? ' audio-track' : '');
      row.dataset.trackId = track.id;
      row.style.height = h + 'px';

      // Drop from toolbar
      row.addEventListener('dragover', (e) => {
        if (!e.dataTransfer.types.includes('application/wow-clip-type')) return;
        e.preventDefault();
        row.classList.add('drag-over');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', (e) => {
        row.classList.remove('drag-over');
        const type = e.dataTransfer.getData('application/wow-clip-type');
        if (!type) return;
        e.preventDefault();

        // Calculate drop time from x position
        const rect = this._tracksContainer.getBoundingClientRect();
        const scrollLeft = this._timelineBody.scrollLeft;
        const x = e.clientX - rect.left + scrollLeft;
        const timeMs = Math.max(0, x / this.timeline.pxPerMs);

        if (this.onClipDropped) this.onClipDropped(type, track.id, timeMs);
      });

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

    // Double-click audio clip to pick media
    if (clip.type === 'audio') {
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (this.onAudioClipDblClick) this.onAudioClipDblClick(clip);
      });
    }

    // Render waveform for audio clips (async, non-blocking)
    if (clip.type === 'audio' && (clip.mediaId || clip.src)) {
      requestAnimationFrame(() => {
        this._waveformRenderer.render(el, clip, this.timeline.pxPerMs);
      });
    }

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
      this._isDragging = false;
      this.render();
    };

    clipEl.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('clip-handle')) return;
      e.stopPropagation();
      startX = e.clientX;
      startMs = clip.startMs;
      clipEl.classList.add('dragging');
      this._isDragging = true;

      // Select the clip
      this.timeline.selectClip(clip.id);
      if (this.onClipSelected) this.onClipSelected(clip.id);

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
      this._isDragging = false;
      this.render();
    };

    handleEl.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this._isDragging = true;
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
      const clipId = clipEl.dataset.clipId;
      this.timeline.selectClip(clipId);
      if (this.onClipSelected) this.onClipSelected(clipId);
      this.render();
      return;
    }
    this.timeline.selectClip(null);
    if (this.onClipSelected) this.onClipSelected(null);
    this.render();
  }

  /** @private */
  _autoScrollToPlayhead(timeMs) {
    const playheadX = timeMs * this.timeline.pxPerMs;
    const scrollLeft = this._timelineBody.scrollLeft;
    const visibleWidth = this._timelineBody.clientWidth;

    // If playhead is past 80% of visible area, scroll to keep it in view
    const rightEdge = scrollLeft + visibleWidth * 0.8;
    const leftEdge = scrollLeft + visibleWidth * 0.1;

    if (playheadX > rightEdge) {
      this._timelineBody.scrollLeft = playheadX - visibleWidth * 0.3;
    } else if (playheadX < leftEdge && scrollLeft > 0) {
      this._timelineBody.scrollLeft = Math.max(0, playheadX - visibleWidth * 0.3);
    }
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
