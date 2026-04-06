import { appEvents, AppEvents } from '@wow/core/utils/events.js';
import { TextPanel, ImagePanel, VideoPanel, AudioPanel } from '@wow/core/panels';
import { ANIMATION_DEFINITIONS, ANIMATION_CATEGORY, getDefinitionsForCategory } from '@wow/core/animations';
import { KaraokePanel } from '../panels/KaraokePanel.js';
import { formatTime, parseTime } from '../utils/time.js';
import { fetchMediaArrayBuffer } from '../utils/media.js';

const IN_EFFECTS  = [{ key: '', label: 'None' }, ...getDefinitionsForCategory(ANIMATION_CATEGORY.BUILD_IN)];
const OUT_EFFECTS = [{ key: '', label: 'None' }, ...getDefinitionsForCategory(ANIMATION_CATEGORY.BUILD_OUT)];
const EASING_OPTIONS = [
  'ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear',
  'ease-in-back', 'ease-out-back', 'ease-in-out-back'
];

/**
 * PropertiesPanel — right sidebar.
 * Shows timing controls (start/end/duration) + element-type panel from wow-core.
 */
export class PropertiesPanel {
  /**
   * @param {import('../controllers/TimelineController.js').TimelineController} timeline
   * @param {import('../controllers/ClipController.js').ClipController} clipController
   */
  constructor(timeline, clipController) {
    this.timeline = timeline;
    this.clipController = clipController;
    this._container = document.getElementById('properties-content');
    this._currentClipId = null;
  }

  /**
   * Show properties for a clip. Called when selection changes.
   * @param {string|null} clipId
   * @param {import('@wow/core/models/Element.js').Element|null} element
   */
  show(clipId, element) {
    if (!clipId) {
      this._currentClipId = null;
      this._container.innerHTML = '<p class="no-selection">Select a clip to edit properties.</p>';
      return;
    }

    this._currentClipId = clipId;
    const clip = this._findClip(clipId);
    if (!clip) return;

    let html = '';

    // ── Timing section ──
    html += `<div class="props-section">
      <div class="props-section-title">Timing</div>
      <div class="props-row">
        <label>Start</label>
        <input type="text" id="prop-start" class="props-input time-input" value="${formatTime(clip.startMs)}">
      </div>
      <div class="props-row">
        <label>End</label>
        <input type="text" id="prop-end" class="props-input time-input" value="${clip.endMs !== null ? formatTime(clip.endMs) : '∞'}">
      </div>
      <div class="props-row">
        <label>Duration</label>
        <input type="text" id="prop-duration" class="props-input time-input" value="${clip.endMs !== null ? formatTime(clip.endMs - clip.startMs) : '∞'}" readonly>
      </div>
      <div class="props-row">
        <label>Name</label>
        <input type="text" id="prop-name" class="props-input" value="${clip.name || ''}">
      </div>
    </div>`;

    // ── Type-specific panel ──
    if (clip.type === 'visual' && element) {
      html += `<div class="props-section">
        <div class="props-section-title">${clip.elementType}</div>
        <div id="type-panel-content"></div>
      </div>`;

      // Position section
      html += `<div class="props-section">
        <div class="props-section-title">Position</div>
        <div class="props-row">
          <label>X</label><input type="number" id="prop-x" class="props-input" value="${Math.round(clip.position.x)}">
          <label>Y</label><input type="number" id="prop-y" class="props-input" value="${Math.round(clip.position.y)}">
        </div>
        <div class="props-row">
          <label>W</label><input type="number" id="prop-w" class="props-input" value="${Math.round(clip.position.width)}">
          <label>H</label><input type="number" id="prop-h" class="props-input" value="${Math.round(clip.position.height)}">
        </div>
        ${clip.elementType === 'image' ? `
        <div class="props-row">
          <button id="btn-expand-canvas" class="props-btn">
            <i class="material-icons" style="font-size:14px;vertical-align:middle;margin-right:4px;">fullscreen</i>Expand to Canvas
          </button>
        </div>` : ''}
      </div>`;

      // ── FX section ──
      html += this._renderFxSection(clip);
    }

    if (clip.type === 'audio') {
      const hasMedia = !!(clip.mediaId || clip.src);
      html += `<div class="props-section">
        <div class="props-section-title">Audio</div>
        <div class="props-row">
          <label>Volume</label>
          <input type="range" id="prop-volume" min="0" max="1" step="0.01" value="${clip.volume}">
        </div>
        <div class="props-row">
          <label>Fade In (ms)</label>
          <input type="number" id="prop-fadein" class="props-input" value="${clip.fadeInMs}">
        </div>
        <div class="props-row">
          <label>Fade Out (ms)</label>
          <input type="number" id="prop-fadeout" class="props-input" value="${clip.fadeOutMs}">
        </div>
        ${hasMedia ? `<button id="btn-auto-width" class="props-btn">Auto Width</button>` : ''}
      </div>`;
    }

    this._container.innerHTML = html;

    // Render type-specific panel content from wow-core
    if (clip.type === 'visual' && element) {
      const panelContainer = document.getElementById('type-panel-content');
      if (panelContainer) {
        const Panel = this._getPanelForType(clip.elementType);
        if (Panel) {
          panelContainer.innerHTML = Panel.render(element, clip);
          // Defer binding so DOM is attached
          setTimeout(() => {
            if (Panel.bindEvents) Panel.bindEvents(element, clip);
          }, 0);
        }
      }
    }

    // Bind timing inputs
    this._bindTimingInputs(clip);
    this._bindPositionInputs(clip);
    this._bindAudioInputs(clip);
    this._bindFxInputs(clip);
  }

  /**
   * Lightweight update of position inputs only (no full re-render).
   * Called during canvas drag to avoid panel flickering.
   * @param {import('@wow/core/models/Element.js').Element} element
   */
  updatePosition(element) {
    if (!element) return;
    const pos = element.position;
    const x = document.getElementById('prop-x');
    const y = document.getElementById('prop-y');
    const w = document.getElementById('prop-w');
    const h = document.getElementById('prop-h');
    if (x) x.value = Math.round(pos.x);
    if (y) y.value = Math.round(pos.y);
    if (w) w.value = Math.round(pos.width);
    if (h) h.value = Math.round(pos.height);
  }

  /** @private */
  _bindTimingInputs(clip) {
    const startInput = document.getElementById('prop-start');
    const endInput = document.getElementById('prop-end');
    const nameInput = document.getElementById('prop-name');

    startInput?.addEventListener('change', () => {
      const ms = parseTime(startInput.value);
      if (ms !== null) {
        const dur = clip.endMs !== null ? clip.endMs - clip.startMs : null;
        clip.startMs = ms;
        if (dur !== null) clip.endMs = ms + dur;
        this.timeline.project.touch();
        appEvents.emit(AppEvents.SLIDE_UPDATED);
      }
    });

    endInput?.addEventListener('change', () => {
      const ms = parseTime(endInput.value);
      if (ms !== null) {
        clip.endMs = Math.max(clip.startMs + 100, ms);
        this.timeline.project.touch();
        appEvents.emit(AppEvents.SLIDE_UPDATED);
      }
    });

    nameInput?.addEventListener('change', () => {
      clip.name = nameInput.value;
      this.timeline.project.touch();
      appEvents.emit(AppEvents.SLIDE_UPDATED);
    });
  }

  /** @private */
  _bindPositionInputs(clip) {
    const bind = (id, prop) => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('change', () => {
        clip.position[prop] = parseFloat(input.value) || 0;
        this.timeline.project.touch();
        // Re-render canvas element
        this.clipController.canvasRenderer.rerenderClip(clip.id);
        appEvents.emit(AppEvents.SLIDE_UPDATED);
      });
    };
    bind('prop-x', 'x');
    bind('prop-y', 'y');
    bind('prop-w', 'width');
    bind('prop-h', 'height');

    document.getElementById('btn-expand-canvas')?.addEventListener('click', () => {
      const { width, height } = this.timeline.project;
      clip.position.x = 0;
      clip.position.y = 0;
      clip.position.width = width;
      clip.position.height = height;
      this.timeline.project.touch();
      this.clipController.canvasRenderer.rerenderClip(clip.id);
      appEvents.emit(AppEvents.SLIDE_UPDATED);
      // Refresh panel so position inputs reflect the new values
      const element = this.clipController.canvasRenderer.getElement(clip.id);
      this.show(clip.id, element);
    });
  }

  /** @private */
  _bindAudioInputs(clip) {
    const vol = document.getElementById('prop-volume');
    vol?.addEventListener('input', () => { clip.volume = parseFloat(vol.value); });
    const fi = document.getElementById('prop-fadein');
    fi?.addEventListener('change', () => { clip.fadeInMs = parseInt(fi.value) || 0; });
    const fo = document.getElementById('prop-fadeout');
    fo?.addEventListener('change', () => { clip.fadeOutMs = parseInt(fo.value) || 0; });

    document.getElementById('btn-auto-width')?.addEventListener('click', () => {
      this._autoWidthAudioClip(clip);
    });
  }

  /**
   * Set audio clip duration to match its audio file duration.
   * @param {import('../models/AudioClip.js').AudioClip} clip
   */
  async _autoWidthAudioClip(clip) {
    const src = clip.mediaId || clip.src;
    if (!src) return;

    try {
      const arrayBuffer = await fetchMediaArrayBuffer(src);
      if (!arrayBuffer) return;

      const audioCtx = new AudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const durationMs = Math.round(audioBuffer.duration * 1000);
      audioCtx.close();

      clip.endMs = clip.startMs + durationMs;
      this.timeline.project.touch();
      appEvents.emit(AppEvents.SLIDE_UPDATED);

      // Refresh panel to show updated duration
      this.show(clip.id, null);
    } catch (err) {
      console.error('Failed to get audio duration:', err);
    }
  }

  /**
   * Render the FX section HTML for a visual clip.
   * @param {import('../models/VisualClip.js').VisualClip} clip
   * @returns {string}
   * @private
   */
  _renderFxSection(clip) {
    const inName  = clip.inAnimation?.name  ?? '';
    const inDur   = clip.inAnimation?.duration  ?? 600;
    const inEase  = clip.inAnimation?.easing  ?? 'ease-out';
    const outName = clip.outAnimation?.name ?? '';
    const outDur  = clip.outAnimation?.duration ?? 600;
    const outEase = clip.outAnimation?.easing ?? 'ease-in';

    const inOptions  = IN_EFFECTS.map(e =>
      `<option value="${e.key}" ${e.key === inName  ? 'selected' : ''}>${e.label}</option>`).join('');
    const outOptions = OUT_EFFECTS.map(e =>
      `<option value="${e.key}" ${e.key === outName ? 'selected' : ''}>${e.label}</option>`).join('');
    const easingOpts = (selected) => EASING_OPTIONS.map(e =>
      `<option value="${e}" ${e === selected ? 'selected' : ''}>${e}</option>`).join('');

    return `<div class="props-section">
      <div class="props-section-title">FX</div>
      <div class="props-row"><label class="fx-label">In</label>
        <select id="fx-in-name" class="props-select fx-select">${inOptions}</select>
      </div>
      <div id="fx-in-opts" class="${inName ? '' : 'fx-hidden'} fx-subopts">
        <div class="props-row">
          <label>Duration</label>
          <input type="number" id="fx-in-dur" class="props-input" value="${inDur}" min="100" max="5000" step="100">
          <span class="fx-unit">ms</span>
        </div>
        <div class="props-row">
          <label>Easing</label>
          <select id="fx-in-ease" class="props-select">${easingOpts(inEase)}</select>
        </div>
      </div>
      <div class="props-row"><label class="fx-label">Out</label>
        <select id="fx-out-name" class="props-select fx-select">${outOptions}</select>
      </div>
      <div id="fx-out-opts" class="${outName ? '' : 'fx-hidden'} fx-subopts">
        <div class="props-row">
          <label>Duration</label>
          <input type="number" id="fx-out-dur" class="props-input" value="${outDur}" min="100" max="5000" step="100">
          <span class="fx-unit">ms</span>
        </div>
        <div class="props-row">
          <label>Easing</label>
          <select id="fx-out-ease" class="props-select">${easingOpts(outEase)}</select>
        </div>
      </div>
    </div>`;
  }

  /** @private */
  _bindFxInputs(clip) {
    if (clip.type !== 'visual') return;

    const inName  = document.getElementById('fx-in-name');
    const inDur   = document.getElementById('fx-in-dur');
    const inEase  = document.getElementById('fx-in-ease');
    const outName = document.getElementById('fx-out-name');
    const outDur  = document.getElementById('fx-out-dur');
    const outEase = document.getElementById('fx-out-ease');
    const inOpts  = document.getElementById('fx-in-opts');
    const outOpts = document.getElementById('fx-out-opts');

    const updateIn = () => {
      const name = inName.value;
      clip.inAnimation = name ? {
        name,
        duration: parseInt(inDur?.value) || 600,
        easing: inEase?.value || 'ease-out'
      } : null;
      inOpts.classList.toggle('fx-hidden', !name);
      this.timeline.project.touch();
    };

    const updateOut = () => {
      const name = outName.value;
      clip.outAnimation = name ? {
        name,
        duration: parseInt(outDur?.value) || 600,
        easing: outEase?.value || 'ease-in'
      } : null;
      outOpts.classList.toggle('fx-hidden', !name);
      this.timeline.project.touch();
    };

    inName?.addEventListener('change', updateIn);
    inDur?.addEventListener('change', updateIn);
    inEase?.addEventListener('change', updateIn);
    outName?.addEventListener('change', updateOut);
    outDur?.addEventListener('change', updateOut);
    outEase?.addEventListener('change', updateOut);
  }

  /** @private */
  _getPanelForType(elementType) {
    switch (elementType) {
      case 'text': return TextPanel;
      case 'karaoke': return KaraokePanel;
      case 'image': return ImagePanel;
      case 'video': return VideoPanel;
      case 'audio': return AudioPanel;
      default: return null;
    }
  }

  /** @private */
  _findClip(clipId) {
    return this.timeline.project.findClip(clipId).clip;
  }
}
