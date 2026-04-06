import { Project } from './models/Project.js';
import { TimelineController } from './controllers/TimelineController.js';
import { PlaybackEngine } from './controllers/PlaybackEngine.js';
import { TimelineView } from './views/TimelineView.js';

/**
 * WOW3AnimationApp - main application bootstrap.
 */
class WOW3AnimationApp {
  constructor() {
    /** @type {Project} */
    this.project = null;
    /** @type {TimelineController} */
    this.timeline = null;
    /** @type {PlaybackEngine} */
    this.playback = null;
    /** @type {TimelineView} */
    this.timelineView = null;
  }

  /**
   * Initialize the app.
   */
  async init() {
    this._initProject();
    this._initControllers();
    this._initUI();
    this._bindKeyboard();
    console.log('WOW3 Animation Editor initialized');
  }

  /** @private */
  _initProject() {
    // TODO: load from IndexedDB if available
    this.project = new Project({ title: 'Untitled Project', orientation: 'landscape' });
    // Add default tracks
    this.project.addTrack('visual');
    this.project.addTrack('audio');
  }

  /** @private */
  _initControllers() {
    this.timeline = new TimelineController(this.project);
    this.playback = new PlaybackEngine(this.timeline);
  }

  /** @private */
  _initUI() {
    this._scaleCanvas();
    this.timelineView = new TimelineView(this.timeline);
    this.timelineView.render();
    this._bindToolbar();
    this._updateTitleInput();
    this._updateDurationDisplay();
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

    canvas.style.width  = width  + 'px';
    canvas.style.height = height + 'px';
    wrapper.style.transform = `scale(${scale})`;
    wrapper.style.transformOrigin = 'center center';
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
    const el = document.getElementById('playback-duration');
    el.textContent = '/ ' + this._formatTime(dur);
  }

  /** @private */
  _bindKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.playback.toggle();
        const icon = document.getElementById('btn-play').querySelector('i');
        icon.textContent = this.playback.isPlaying ? 'pause' : 'play_arrow';
      }
    });
  }

  /**
   * Formats ms as hh:mm:ss.fff
   * @param {number} ms
   * @returns {string}
   */
  _formatTime(ms) {
    const totalS = Math.floor(ms / 1000);
    const h = Math.floor(totalS / 3600);
    const m = Math.floor((totalS % 3600) / 60);
    const s = totalS % 60;
    const frac = String(ms % 1000).padStart(3, '0');
    return [
      String(h).padStart(2, '0'),
      String(m).padStart(2, '0'),
      String(s).padStart(2, '0')
    ].join(':') + '.' + frac;
  }
}

const app = new WOW3AnimationApp();
document.addEventListener('DOMContentLoaded', () => app.init());
