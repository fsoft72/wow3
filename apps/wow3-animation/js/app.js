import { appEvents, AppEvents } from '@wow/core/utils/events.js';

import { Project } from './models/Project.js';
import { TimelineController } from './controllers/TimelineController.js';
import { PlaybackEngine } from './controllers/PlaybackEngine.js';
import { ClipController } from './controllers/ClipController.js';
import { HistoryManager } from './controllers/HistoryManager.js';
import { TimelineView } from './views/TimelineView.js';
import { CanvasRenderer } from './views/CanvasRenderer.js';
import { PropertiesPanel } from './views/PropertiesPanel.js';
import { VisualClip } from './models/VisualClip.js';
import { AudioClip } from './models/AudioClip.js';

/**
 * WOW3AnimationApp — main application bootstrap.
 */
class WOW3AnimationApp {
  constructor() {
    /** @type {Project} */
    this.project = null;
    /** @type {TimelineController} */
    this.timeline = null;
    /** @type {PlaybackEngine} */
    this.playback = null;
    /** @type {ClipController} */
    this.clipController = null;
    /** @type {CanvasRenderer} */
    this.canvasRenderer = null;
    /** @type {TimelineView} */
    this.timelineView = null;
    /** @type {PropertiesPanel} */
    this.propertiesPanel = null;
    /** @type {HistoryManager} */
    this.historyManager = null;
  }

  async init() {
    this._initProject();
    this._initControllers();
    this._initCanvas();
    this._initUI();
    this._setupGlobals();
    this._bindKeyboard();
    console.log('WOW3 Animation Editor initialized');
  }

  /** @private */
  _initProject() {
    this.project = new Project({ title: 'Untitled Project', orientation: 'landscape' });
    this.project.addTrack('visual');
    this.project.addTrack('audio');
  }

  /** @private */
  _initControllers() {
    this.timeline = new TimelineController(this.project);
    this.playback = new PlaybackEngine(this.timeline);
    this.historyManager = new HistoryManager(this.timeline);

    // Record history on project changes (debounced)
    let historyTimeout;
    appEvents.on(AppEvents.SLIDE_UPDATED, () => {
      clearTimeout(historyTimeout);
      historyTimeout = setTimeout(() => {
        this.historyManager.recordHistory();
      }, 300);
    });
  }

  /** @private */
  _initCanvas() {
    this._scaleCanvas();

    this.canvasRenderer = new CanvasRenderer(this.timeline);
    this.clipController = new ClipController(this.timeline, this.canvasRenderer);
    this.clipController.init();
    this.clipController.onRecordHistory = () => this.historyManager.recordHistory();

    this.propertiesPanel = new PropertiesPanel(this.timeline, this.clipController);

    this.clipController.onSelectionChanged = (clipId, element) => {
      this.propertiesPanel.show(clipId, element);
      // Also highlight on timeline
      this.timelineView.render();
    };

    // Click on canvas background deselects
    const canvas = document.getElementById('slide-canvas');
    canvas.addEventListener('click', (e) => {
      if (e.target === canvas) {
        this.clipController.deselectAll();
      }
    });
  }

  /** @private */
  _initUI() {
    this.timelineView = new TimelineView(this.timeline);

    this.timelineView.onClipDropped = (type, trackId, timeMs) => {
      if (type === 'audio') {
        const clip = new AudioClip({
          name: 'Audio',
          startMs: timeMs,
          endMs: timeMs + 10000
        });
        this.timeline.addClipToTrack(clip, trackId);
      } else {
        const clip = VisualClip.createDefault(type, { startMs: timeMs, endMs: timeMs + 5000 });
        this.timeline.addClipToTrack(clip, trackId);
      }
      this.canvasRenderer.renderAtCurrentTime();
      this.timelineView.render();
      this._updateDurationDisplay();
    };

    this.timelineView.render();
    this._bindToolbar();
    this._updateTitleInput();
    this._updateDurationDisplay();

    appEvents.on(AppEvents.PLAYHEAD_MOVED, () => this._updateTimeDisplay());
  }

  /**
   * Set up window.app global for wow-core panel compatibility.
   * Panels call window.app.editor.elementController.updateElementProperty().
   * @private
   */
  _setupGlobals() {
    window.app = {
      editor: {
        elementController: this.clipController,
        recordHistory: () => {},
        getActiveSlide: () => this.clipController.editor.getActiveSlide(),
        uiManager: this.clipController.editor.uiManager,
        presentation: this.clipController.editor.presentation
      }
    };
  }

  /** @private */
  _scaleCanvas() {
    const canvas = document.getElementById('slide-canvas');
    const wrapper = document.getElementById('canvas-wrapper');
    const area = document.getElementById('canvas-area');
    const { width, height } = this.project;

    const areaW = area.clientWidth - 32;
    const areaH = area.clientHeight - 32;
    const scale = Math.min(areaW / width, areaH / height, 1);

    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    wrapper.style.width = (width * scale) + 'px';
    wrapper.style.height = (height * scale) + 'px';
    wrapper.style.transform = `scale(${scale})`;
    wrapper.style.transformOrigin = 'top left';
  }

  /** @private */
  _bindToolbar() {
    const btnPlay = document.getElementById('btn-play');
    const playIcon = btnPlay.querySelector('i');

    btnPlay.addEventListener('click', () => {
      this.playback.toggle();
      playIcon.textContent = this.playback.isPlaying ? 'pause' : 'play_arrow';
    });

    document.getElementById('btn-stop').addEventListener('click', () => {
      this.playback.stop();
      playIcon.textContent = 'play_arrow';
    });

    document.getElementById('btn-rewind').addEventListener('click', () => {
      this.timeline.seekTo(0);
    });

    // Add clip buttons
    const addClip = (type) => {
      const clip = VisualClip.createDefault(type);
      this.timeline.addClipToTrack(clip);
      this.canvasRenderer.renderAtCurrentTime();
      this.timelineView.render();
      this._updateDurationDisplay();
    };

    document.getElementById('btn-add-text').addEventListener('click', () => addClip('text'));
    document.getElementById('btn-add-image').addEventListener('click', () => addClip('image'));
    document.getElementById('btn-add-video').addEventListener('click', () => addClip('video'));
    document.getElementById('btn-add-shape').addEventListener('click', () => addClip('shape'));

    // Audio clip
    document.getElementById('btn-add-audio').addEventListener('click', () => {
      const clip = new AudioClip({
        name: 'Audio',
        startMs: this.timeline.currentTimeMs,
        endMs: this.timeline.currentTimeMs + 10000
      });
      this.timeline.addClipToTrack(clip);
      this.timelineView.render();
      this._updateDurationDisplay();
    });

    // Undo/Redo buttons
    document.getElementById('btn-undo')?.addEventListener('click', () => {
      this.historyManager.undo();
      this.clipController.deselectAll();
      this.canvasRenderer.clear();
      this.canvasRenderer.renderAtCurrentTime();
      this.timelineView.render();
    });
    document.getElementById('btn-redo')?.addEventListener('click', () => {
      this.historyManager.redo();
      this.clipController.deselectAll();
      this.canvasRenderer.clear();
      this.canvasRenderer.renderAtCurrentTime();
      this.timelineView.render();
    });

    // Make toolbar buttons draggable
    const makeDraggable = (btnId, type) => {
      const btn = document.getElementById(btnId);
      btn.draggable = true;
      btn.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/wow-clip-type', type);
        e.dataTransfer.effectAllowed = 'copy';
      });
    };
    makeDraggable('btn-add-text', 'text');
    makeDraggable('btn-add-image', 'image');
    makeDraggable('btn-add-video', 'video');
    makeDraggable('btn-add-shape', 'shape');
    makeDraggable('btn-add-audio', 'audio');
  }

  /** @private */
  _updateTitleInput() {
    const input = document.getElementById('project-title-input');
    input.value = this.project.title;
    input.addEventListener('change', () => {
      this.project.title = input.value;
      this.project.touch();
    });
  }

  /** @private */
  _updateDurationDisplay() {
    const dur = this.project.getEffectiveDuration();
    document.getElementById('playback-duration').textContent = '/ ' + this._formatTime(dur);
  }

  /** @private */
  _updateTimeDisplay() {
    document.getElementById('playback-time').textContent =
      this._formatTime(this.timeline.currentTimeMs);
  }

  /** @private */
  _bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.playback.toggle();
        document.getElementById('btn-play').querySelector('i').textContent =
          this.playback.isPlaying ? 'pause' : 'play_arrow';
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.historyManager.undo();
        this.clipController.deselectAll();
        this.canvasRenderer.clear();
        this.canvasRenderer.renderAtCurrentTime();
        this.timelineView.render();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        this.historyManager.redo();
        this.clipController.deselectAll();
        this.canvasRenderer.clear();
        this.canvasRenderer.renderAtCurrentTime();
        this.timelineView.render();
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const clipId = this.timeline.selectedClipId;
        if (clipId) {
          this.timeline.removeClip(clipId);
          this.clipController.deselectAll();
          this.canvasRenderer.renderAtCurrentTime();
          this.timelineView.render();
        }
      }
    });
  }

  /**
   * @param {number} ms
   * @returns {string} hh:mm:ss.fff
   */
  _formatTime(ms) {
    const totalS = Math.floor(ms / 1000);
    const h = Math.floor(totalS / 3600);
    const m = Math.floor((totalS % 3600) / 60);
    const s = totalS % 60;
    const frac = String(Math.floor(ms % 1000)).padStart(3, '0');
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${frac}`;
  }
}

const app = new WOW3AnimationApp();
document.addEventListener('DOMContentLoaded', () => app.init());
