import { appEvents, AppEvents } from '@wow/core/utils/events.js';
import { TextPanel, ImagePanel, VideoPanel, AudioPanel } from '@wow/core/panels';

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
        <input type="text" id="prop-start" class="props-input time-input" value="${this._formatTime(clip.startMs)}">
      </div>
      <div class="props-row">
        <label>End</label>
        <input type="text" id="prop-end" class="props-input time-input" value="${clip.endMs !== null ? this._formatTime(clip.endMs) : '∞'}">
      </div>
      <div class="props-row">
        <label>Duration</label>
        <input type="text" id="prop-duration" class="props-input time-input" value="${clip.endMs !== null ? this._formatTime(clip.endMs - clip.startMs) : '∞'}" readonly>
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
      </div>`;
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
          panelContainer.innerHTML = Panel.render(element);
          // Defer binding so DOM is attached
          setTimeout(() => {
            if (Panel.bindEvents) Panel.bindEvents(element);
          }, 0);
        }
      }
    }

    // Bind timing inputs
    this._bindTimingInputs(clip);
    this._bindPositionInputs(clip);
    this._bindAudioInputs(clip);
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
      const ms = this._parseTime(startInput.value);
      if (ms !== null) {
        const dur = clip.endMs !== null ? clip.endMs - clip.startMs : null;
        clip.startMs = ms;
        if (dur !== null) clip.endMs = ms + dur;
        this.timeline.project.touch();
        appEvents.emit(AppEvents.SLIDE_UPDATED);
      }
    });

    endInput?.addEventListener('change', () => {
      const ms = this._parseTime(endInput.value);
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
      let arrayBuffer;

      if (src.startsWith('media_') && typeof MediaDB !== 'undefined') {
        const item = await MediaDB.getMediaItem(src);
        if (item?.blob) arrayBuffer = await item.blob.arrayBuffer();
      }

      if (!arrayBuffer) {
        const resp = await fetch(src);
        arrayBuffer = await resp.arrayBuffer();
      }

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

  /** @private */
  _getPanelForType(elementType) {
    switch (elementType) {
      case 'text': return TextPanel;
      case 'karaoke': return TextPanel;
      case 'image': return ImagePanel;
      case 'video': return VideoPanel;
      case 'audio': return AudioPanel;
      default: return null;
    }
  }

  /** @private */
  _findClip(clipId) {
    for (const track of this.timeline.project.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) return clip;
    }
    return null;
  }

  /**
   * Parse "hh:mm:ss.fff" or "ss.fff" or "ss" to ms.
   * @param {string} str
   * @returns {number|null}
   */
  _parseTime(str) {
    const parts = str.split(':');
    let totalS = 0;
    if (parts.length === 3) {
      totalS = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      totalS = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    } else {
      totalS = parseFloat(parts[0]);
    }
    if (isNaN(totalS)) return null;
    return Math.round(totalS * 1000);
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
