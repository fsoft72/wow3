import { appEvents, AppEvents } from '@wow/core/utils/events.js';

import { Project } from './models/Project.js';
import { TimelineController } from './controllers/TimelineController.js';
import { PlaybackEngine } from './controllers/PlaybackEngine.js';
import { ClipController } from './controllers/ClipController.js';
import { HistoryManager } from './controllers/HistoryManager.js';
import { AudioPlaybackManager } from './controllers/AudioPlaybackManager.js';
import { PresentationExportController } from './controllers/PresentationExportController.js';
import { TimelineView } from './views/TimelineView.js';
import { CanvasRenderer } from './views/CanvasRenderer.js';
import { PropertiesPanel } from './views/PropertiesPanel.js';
import { JsonEditorModal } from './components/JsonEditorModal.js';
import { VisualClip } from './models/VisualClip.js';
import { AudioClip } from './models/AudioClip.js';
import { exportProject, importProject } from './utils/projectStorage.js';
import { formatTime } from './utils/time.js';

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
    /** @type {JsonEditorModal} */
    this._jsonEditorModal = null;
    /** @type {PresentationExportController|null} */
    this.exportController = null;
  }

  /**
   * Detect if running in player mode via URL parameter.
   * @returns {boolean}
   */
  static get isPlayerMode() {
    return new URLSearchParams(window.location.search).has('mode', 'player');
  }

  async init() {
    this._playerMode = WOW3AnimationApp.isPlayerMode;

    this._initProject();
    this._initControllers();
    this._initCanvas();

    if (!this._playerMode) {
      this._initUI();
      this._setupGlobals();
      this._bindKeyboard();
      this._initMediaManager();
      this._initJsonEditor();
      this._initImportExport();
      this._startAutoSave();
    } else {
      document.body.classList.add('player-mode');
      this._initMediaManager();
    }

    this.canvasRenderer.renderAtCurrentTime();

    if (this._playerMode) {
      this._exposePlayerAPI();
    }

    console.log(this._playerMode ? 'WOW3 Player mode initialized' : 'WOW3 Animation Editor initialized');
  }

  /** @private */
  _initProject() {
    const saved = this._loadProjectFromStorage();
    if (saved) {
      this.project = saved;
    } else {
      this.project = new Project({ title: 'Untitled Project', orientation: 'landscape' });
      this.project.addTrack('visual');
      this.project.addTrack('audio');
    }
  }

  /**
   * Attempts to restore a project from localStorage.
   * @returns {Project|null}
   * @private
   */
  _loadProjectFromStorage() {
    try {
      const raw = localStorage.getItem('wow3-animation-project');
      if (!raw) return null;
      const data = JSON.parse(raw);
      return Project.fromJSON(data);
    } catch (err) {
      console.warn('Could not restore project from localStorage:', err);
      return null;
    }
  }

  /**
   * Saves the current project to localStorage and updates the status indicator.
   * @param {boolean} [force=false] - Skip change detection and always save.
   * @private
   */
  _saveProject(force = false) {
    try {
      const json = JSON.stringify(this.project.toJSON());
      if (!force && json === this._lastSavedJson) return;
      localStorage.setItem('wow3-animation-project', json);
      this._lastSavedJson = json;
      console.log('Project auto-saved');
      this._showSaveStatus('Saved');
    } catch (err) {
      console.error('Failed to save project:', err);
      this._showSaveStatus('Save failed');
    }
  }

  /**
   * Starts the 10-second auto-save interval.
   * @private
   */
  _startAutoSave() {
    this._lastSavedJson = JSON.stringify(this.project.toJSON());
    setInterval(() => this._saveProject(), 5_000);
  }

  /**
   * Briefly shows a status message next to the save button.
   * @param {string} msg
   * @private
   */
  _showSaveStatus(msg) {
    const el = document.getElementById('save-status');
    if (!el) return;
    el.textContent = msg;
    clearTimeout(this._saveStatusTimeout);
    this._saveStatusTimeout = setTimeout(() => { el.textContent = ''; }, 2000);
  }

  /** @private */
  _initControllers() {
    this.timeline = new TimelineController(this.project);
    this.playback = new PlaybackEngine(this.timeline);
    this.historyManager = new HistoryManager(this.timeline);
    this.audioPlayback = new AudioPlaybackManager(this.timeline);

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
    this.exportController = new PresentationExportController({
      timeline: this.timeline,
      canvasRenderer: this.canvasRenderer,
      clipController: this.clipController,
      playback: this.playback,
    });

    this.clipController.onSelectionChanged = (clipId, element) => {
      this.propertiesPanel.show(clipId, element);
      // Update selection highlight without full DOM rebuild.
      // Full render() here caused the DOM to be replaced mid-mousedown,
      // making the click event fire on the body → spurious deselect.
      this.timelineView.updateSelection(clipId);
    };

    this.clipController.onPositionChanged = (element) => {
      this.propertiesPanel.updatePosition(element);
    };

    this.clipController.onKaraokeDblClick = (clipId) => {
      if (!clipId || typeof MediaManager === 'undefined') return;
      const clip = this._findClip(clipId);
      if (!clip) return;

      MediaManager.open(async (data) => {
        const mediaId = data.localUrl ? data.localUrl.replace('local://', '') : data.originalItem?.id;
        if (!mediaId) return;
        clip.properties.srtMediaId = mediaId;
        clip.name = data.alt || clip.name;
        this.timeline.project.touch();
        // Clear cached SRT so it reloads
        this.canvasRenderer.invalidateSrtCache(mediaId);
        this.canvasRenderer.renderAtCurrentTime();
        this.timelineView.render();
      });
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

    this.timelineView.onClipSelected = (clipId) => {
      if (clipId) {
        // Move playhead to clip start
        const clip = this._findClip(clipId);
        if (clip) {
          this.timeline.seekTo(clip.startMs);
        }

        // Select the corresponding canvas element
        const element = this.canvasRenderer.getElement(clipId);
        if (element) {
          this.clipController.selectElement(element);
        } else {
          // Clip not visible on canvas (e.g. audio) — show properties directly
          this.propertiesPanel.show(clipId, null);
        }
      } else {
        this.clipController.deselectAll();
      }
    };

    this.timelineView.onKaraokeClipDblClick = (clip) => {
      if (typeof MediaManager === 'undefined') return;
      MediaManager.open(async (data) => {
        const mediaId = data.localUrl ? data.localUrl.replace('local://', '') : data.originalItem?.id;
        if (!mediaId) return;
        clip.properties.srtMediaId = mediaId;
        clip.name = data.alt || clip.name;
        this.timeline.project.touch();
        this.canvasRenderer.invalidateSrtCache(mediaId);
        this.canvasRenderer.renderAtCurrentTime();
        this.timelineView.render();
      });
    };

    this.timelineView.onMediaClipDblClick = (clip) => {
      if (typeof MediaManager === 'undefined') return;
      const element = this.canvasRenderer.getElement(clip.id);
      if (element) {
        this.clipController.openMediaManagerFor(element);
      }
    };

    this.timelineView.onAudioClipDblClick = (clip) => {
      if (typeof MediaManager === 'undefined') return;
      MediaManager.open(async (data) => {
        const mediaId = data.localUrl ? data.localUrl.replace('local://', '') : data.originalItem?.id;
        if (!mediaId) return;
        clip.mediaId = mediaId;
        clip.name = data.alt || clip.name;
        this.timeline.project.touch();
        this.timelineView.render();
        this.propertiesPanel.show(clip.id, null);
      });
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
    const cc = this.clipController;
    window.app = {
      editor: {
        elementController: cc,
        // Explicit passthrough for wow-core panels that call these methods
        recordHistory: () => cc.editor.recordHistory(),
        getActiveSlide: () => cc.editor.getActiveSlide(),
        uiManager: cc.editor.uiManager,
        presentation: cc.editor.presentation
      }
    };
  }

  /** @private */
  _initJsonEditor() {
    this._jsonEditorModal = new JsonEditorModal(this.timeline, () => {
      // After a valid JSON is applied, rebuild all views
      this.clipController.deselectAll();
      this.canvasRenderer.clear();
      this.canvasRenderer.renderAtCurrentTime();
      this.timelineView.render();
      this._updateTitleInput();
      this._updateDurationDisplay();
    });

    document.getElementById('btn-json-editor')?.addEventListener('click', () => {
      this._jsonEditorModal.open();
    });
  }

  /** @private */
  _initImportExport() {
    document.getElementById('btn-project-export')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-project-export');
      btn.disabled = true;
      try {
        await exportProject(this.timeline.project);
      } catch (err) {
        console.error('Export failed:', err);
        alert(`Export failed: ${err.message}`);
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('btn-project-import')?.addEventListener('click', async () => {
      try {
        const jsonData = await importProject();
        const newProject = Project.fromJSON(jsonData);

        // Replace current project
        this.timeline.project = newProject;
        this.project = newProject;

        // Rebuild everything
        this.clipController.deselectAll();
        this.canvasRenderer.clear();
        this.timeline.seekTo(0);
        this.canvasRenderer.renderAtCurrentTime();
        this.timelineView.render();
        this._updateTitleInput();
        this._updateDurationDisplay();

        // Persist to localStorage
        this._saveProject(true);
        console.log(`✅ Project "${newProject.title}" imported successfully`);
      } catch (err) {
        if (err.message !== 'No file selected') {
          console.error('Import failed:', err);
          alert(`Import failed: ${err.message}`);
        }
      }
    });
  }

  /** @private */
  _initMediaManager() {
    if (typeof MediaDB !== 'undefined') {
      MediaDB.setDatabaseName('wow3-anim_media');
    }
    if (typeof MediaManager !== 'undefined') {
      MediaManager.init();
      document.getElementById('btn-media-manager')?.addEventListener('click', () => {
        MediaManager.open();
      });
    }
    if (typeof GradientManager !== 'undefined') {
      GradientManager.setStorageKey('wow3-anim_gradients');
      GradientManager.init();
    }
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

    btnPlay.addEventListener('click', () => {
      this.playback.toggle();
      this._updatePlaybackButton();
    });

    document.getElementById('btn-stop').addEventListener('click', () => {
      this.playback.stop();
      this._updatePlaybackButton();
    });

    document.getElementById('btn-rewind').addEventListener('click', () => {
      this.timeline.seekTo(0);
    });

    // Add clip buttons — each creates a new track + clip at current time
    const TRACK_NAMES = { text: 'Text Layer', image: 'Image Layer', video: 'Video Layer', shape: 'Shape Layer', karaoke: 'Karaoke Layer' };

    const addClip = (type) => {
      const track = this.timeline.addTrack('visual', TRACK_NAMES[type]);
      const clip = VisualClip.createDefault(type);
      this.timeline.addClipToTrack(clip, track.id);
      this.canvasRenderer.renderAtCurrentTime();
      this.timelineView.render();
      this._updateDurationDisplay();
    };

    document.getElementById('btn-add-text').addEventListener('click', () => addClip('text'));
    document.getElementById('btn-add-image').addEventListener('click', () => addClip('image'));
    document.getElementById('btn-add-video').addEventListener('click', () => addClip('video'));
    document.getElementById('btn-add-shape').addEventListener('click', () => addClip('shape'));
    document.getElementById('btn-add-karaoke').addEventListener('click', () => addClip('karaoke'));

    // Audio clip — creates a new audio track + clip
    document.getElementById('btn-add-audio').addEventListener('click', () => {
      const track = this.timeline.addTrack('audio', 'Audio Layer');
      const clip = new AudioClip({
        name: 'Audio',
        startMs: this.timeline.currentTimeMs,
        endMs: this.timeline.currentTimeMs + 10000
      });
      this.timeline.addClipToTrack(clip, track.id);
      this.timelineView.render();
      this._updateDurationDisplay();
    });

    // Undo/Redo buttons
    document.getElementById('btn-undo')?.addEventListener('click', () => this._applyUndo());
    document.getElementById('btn-redo')?.addEventListener('click', () => this._applyRedo());
    document.getElementById('btn-save')?.addEventListener('click', () => this._saveProject(true));
    document.getElementById('btn-export')?.addEventListener('click', async () => {
      if (!this.exportController || this.exportController.isExporting) return;

      const btn = document.getElementById('btn-export');
      const icon = btn.querySelector('i');
      const state = this._captureEditorState();

      btn.disabled = true;
      icon.textContent = 'hourglass_top';
      btn.title = 'Exporting video...';

      try {
        await this.exportController.export({
          onProgress: ({ progress }) => {
            this._showSaveStatus(`Export ${Math.round(progress * 100)}%`);
          },
        });
      } catch (err) {
        console.error('Presentation export failed:', err);
      } finally {
        await this._restoreEditorState(state);
        btn.disabled = false;
        icon.textContent = 'movie';
        btn.title = 'Export MP4 / WebM';
        this._showSaveStatus('');
      }
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
    makeDraggable('btn-add-karaoke', 'karaoke');
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
    document.getElementById('playback-duration').textContent = '/ ' + formatTime(dur);
  }

  /**
   * Capture enough editor state to restore the UI after export.
   * @returns {{timeMs: number, selectedClipId: string|null}}
   * @private
   */
  _captureEditorState() {
    return {
      timeMs: this.timeline.currentTimeMs,
      selectedClipId: this.timeline.selectedClipId,
    };
  }

  /**
   * Restore playhead + selection after export.
   * @param {{timeMs: number, selectedClipId: string|null}} state
   * @returns {Promise<void>}
   * @private
   */
  async _restoreEditorState(state) {
    this.playback.pause();
    this._updatePlaybackButton();
    this.timeline.seekTo(state.timeMs);
    this.canvasRenderer.clear();
    this.canvasRenderer.renderAtCurrentTime();
    this.timelineView.render();

    if (!state.selectedClipId) {
      this.clipController.deselectAll();
      this.timelineView.updateSelection(null);
      return;
    }

    const clip = this._findClip(state.selectedClipId);
    if (!clip) {
      this.clipController.deselectAll();
      this.timelineView.updateSelection(null);
      return;
    }

    const element = this.canvasRenderer.getElement(state.selectedClipId);
    if (element) {
      this.clipController.selectElement(element);
      return;
    }

    const { track } = this.project.findClip(state.selectedClipId);
    this.timeline.selectedClipId = state.selectedClipId;
    this.timeline.selectedTrackId = track?.id ?? null;
    this.propertiesPanel.show(state.selectedClipId, null);
    this.timelineView.updateSelection(state.selectedClipId);
  }

  /** @private */
  _updateTimeDisplay() {
    document.getElementById('playback-time').textContent =
      formatTime(this.timeline.currentTimeMs);
  }

  /** @private */
  _updatePlaybackButton() {
    const icon = document.getElementById('btn-play')?.querySelector('i');
    if (icon) {
      icon.textContent = this.playback.isPlaying ? 'pause' : 'play_arrow';
    }
  }

  /** @private */
  _bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' ||
          e.target.contentEditable === 'true') return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.playback.toggle();
        this._updatePlaybackButton();
      }

      // Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this._saveProject(true);
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this._applyUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        this._applyRedo();
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

  /** @private */
  _applyUndo() {
    this.historyManager.undo();
    this.clipController.deselectAll();
    this.canvasRenderer.clear();
    this.canvasRenderer.renderAtCurrentTime();
    this.timelineView.render();
  }

  /** @private */
  _applyRedo() {
    this.historyManager.redo();
    this.clipController.deselectAll();
    this.canvasRenderer.clear();
    this.canvasRenderer.renderAtCurrentTime();
    this.timelineView.render();
  }

  /**
   * Find a clip by id across all tracks.
   * @param {string} clipId
   * @returns {import('./models/Clip.js').Clip|null}
   */
  _findClip(clipId) {
    return this.project.findClip(clipId).clip;
  }

  /**
   * Expose a control API on window.__wow3 for external automation (headless renderer).
   * @private
   */
  _exposePlayerAPI() {
    const self = this;
    let endResolve = null;

    // Listen for playback end
    appEvents.on(AppEvents.PLAYBACK_STOPPED, () => {
      if (endResolve && self.timeline.currentTimeMs >= self.project.getEffectiveDuration()) {
        endResolve();
        endResolve = null;
      }
    });

    window.__wow3 = {
      /** @returns {boolean} */
      get ready() { return true; },

      /** @returns {number} Total project duration in ms */
      get duration() { return self.project.getEffectiveDuration(); },

      /** @returns {number} Current playback position in ms */
      get currentTime() { return self.timeline.currentTimeMs; },

      /** @returns {{width: number, height: number}} Project resolution */
      get resolution() { return { width: self.project.width, height: self.project.height }; },

      /**
       * Load a .wow3a file from a URL.
       * @param {string} url
       * @returns {Promise<void>}
       */
      async loadFile(url) {
        const resp = await fetch(url);
        const blob = await resp.blob();
        const file = new File([blob], 'input.wow3a', { type: 'application/zip' });

        const { importProjectZip } = await import('./utils/projectStorage.js');
        const jsonData = await importProjectZip(file);
        const newProject = Project.fromJSON(jsonData);

        self.timeline.project = newProject;
        self.project = newProject;

        // Set canvas to exact project dimensions
        const canvas = document.getElementById('slide-canvas');
        canvas.style.width = newProject.width + 'px';
        canvas.style.height = newProject.height + 'px';

        self.canvasRenderer.clear();
        self.timeline.seekTo(0);
        self.canvasRenderer.renderAtCurrentTime();
      },

      /**
       * Start playback from the beginning. Returns a Promise that resolves when playback ends.
       * @returns {Promise<void>}
       */
      play() {
        self.timeline.seekTo(0);
        return new Promise((resolve) => {
          endResolve = resolve;
          self.playback.play();
        });
      }
    };
  }
}

const app = new WOW3AnimationApp();
document.addEventListener('DOMContentLoaded', () => app.init());
