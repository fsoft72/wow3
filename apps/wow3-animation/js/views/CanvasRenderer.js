import { appEvents, AppEvents } from '@wow/core/utils/events.js';
import { TextElement, ImageElement, VideoElement, AudioElement, ShapeElement } from '@wow/core/models';
import { ANIMATION_DEFINITIONS } from '@wow/core/animations';
import { KaraokeElement } from '../models/KaraokeElement.js';
import { parseSRT } from '../utils/srt-parser.js';
import { fetchMediaText } from '../utils/media.js';

const ELEMENT_CLASS_MAP = {
  text: TextElement,
  image: ImageElement,
  video: VideoElement,
  audio: AudioElement,
  shape: ShapeElement,
  karaoke: KaraokeElement
};

/**
 * Renders visual clips onto #slide-canvas at a given time.
 * Manages Element instance lifecycle as clips appear/disappear.
 */
export class CanvasRenderer {
  /**
   * @param {import('../controllers/TimelineController.js').TimelineController} timeline
   */
  constructor(timeline) {
    this.timeline = timeline;
    /** @type {Map<string, import('@wow/core/models/Element.js').Element>} clipId → Element */
    this._activeElements = new Map();
    /**
     * Clips whose out-animation is currently playing.
     * clipId → { element, dom, waapi: Animation }
     * @type {Map<string, {element: *, dom: HTMLElement, waapi: Animation|null}>}
     */
    this._exitingElements = new Map();
    /** @type {HTMLElement} */
    this._canvas = document.getElementById('slide-canvas');
    /** @type {Function|null} onElementCreated callback — set by ClipController */
    this.onElementCreated = null;
    /** @type {Function|null} onElementRemoved callback */
    this.onElementRemoved = null;
    /** @type {Map<string, Array>} srt src → parsed cues cache */
    this._srtCache = new Map();
    /** @type {Set<string>} SRT sources currently being loaded */
    this._srtPending = new Set();

    this._bindEvents();
  }

  /** @private */
  _bindEvents() {
    appEvents.on(AppEvents.PLAYHEAD_MOVED, () => this.renderAtCurrentTime());
    appEvents.on(AppEvents.SLIDE_UPDATED, () => this.renderAtCurrentTime());
  }

  /**
   * Render all visual clips active at the current playhead time.
   */
  renderAtCurrentTime() {
    const timeMs = this.timeline.currentTimeMs;
    const project = this.timeline.project;
    const activeClipIds = new Set();

    // Collect active visual clips and create any new elements
    for (let i = 0; i < project.tracks.length; i++) {
      const track = project.tracks[i];
      if (track.type !== 'visual' || !track.visible) continue;

      for (const clip of track.clips) {
        if (!clip.isActiveAt(timeMs)) continue;
        activeClipIds.add(clip.id);

        // If this clip was in the middle of an out-animation (e.g. seek back), cancel it
        if (this._exitingElements.has(clip.id)) {
          const exiting = this._exitingElements.get(clip.id);
          exiting.waapi?.cancel();
          exiting.dom.remove();
          this._exitingElements.delete(clip.id);
        }

        if (!this._activeElements.has(clip.id)) {
          const element = this._createElementFromClip(clip);
          this._activeElements.set(clip.id, element);
          const dom = element.render(this._getZIndex(project, track));
          this._canvas.appendChild(dom);

          if (this.onElementCreated) this.onElementCreated(clip, element, dom);

          // Play in-animation
          if (clip.inAnimation?.name) this._playInAnimation(dom, clip.inAnimation);
        }
      }
    }

    // Remove elements for clips no longer active
    for (const [clipId, element] of this._activeElements) {
      if (activeClipIds.has(clipId)) continue;
      const dom = document.getElementById(element.id);
      this._activeElements.delete(clipId);

      const clip = this._findClipById(clipId);
      if (dom && clip?.outAnimation?.name && !this._exitingElements.has(clipId)) {
        // Keep DOM alive for out-animation duration, then remove
        const waapi = this._playOutAnimation(dom, clip.outAnimation, () => {
          dom.remove();
          this._exitingElements.delete(clipId);
        });
        this._exitingElements.set(clipId, { element, dom, waapi });
      } else {
        if (dom) dom.remove();
      }
      if (this.onElementRemoved) this.onElementRemoved(clipId, element);
    }

    // Sync z-index for all active elements to reflect current track order
    for (let i = 0; i < project.tracks.length; i++) {
      const track = project.tracks[i];
      if (track.type !== 'visual') continue;
      for (const clip of track.clips) {
        const element = this._activeElements.get(clip.id);
        if (!element) continue;
        const dom = document.getElementById(element.id);
        if (dom) dom.style.zIndex = this._getZIndex(project, track);
      }
    }

    // Update karaoke elements at current time
    this._updateKaraokeElements(timeMs, project);
  }

  /**
   * Update all active karaoke elements with the current playhead time.
   * @param {number} timeMs
   * @param {import('../models/Project.js').Project} project
   */
  _updateKaraokeElements(timeMs, project) {
    for (const track of project.tracks) {
      if (track.type !== 'visual') continue;
      for (const clip of track.clips) {
        if (clip.elementType !== 'karaoke') continue;
        if (!clip.isActiveAt(timeMs)) continue;
        const element = this._activeElements.get(clip.id);
        if (element) this.syncKaraokeCues(element, clip, timeMs);
      }
    }
  }

  /**
   * Sync karaoke element with SRT cues at the given time.
   * Loads SRT from cache or fetches asynchronously.
   * @param {import('../models/KaraokeElement.js').KaraokeElement} element
   * @param {import('../models/VisualClip.js').VisualClip} clip
   * @param {number} timeMs - Global playhead time
   */
  syncKaraokeCues(element, clip, timeMs) {
    if (typeof element.updateAtTime !== 'function') return;

    const relativeMs = timeMs - clip.startMs;
    const src = clip.properties.srtMediaId || clip.properties.srtUrl;

    if (!src) {
      element.updateAtTime(relativeMs, []);
      return;
    }

    const cues = this._srtCache.get(src);
    if (cues) {
      element.updateAtTime(relativeMs, cues);
    } else if (!this._srtPending.has(src)) {
      // Load once, avoid duplicate fetches per frame
      this._srtPending.add(src);
      this._loadSRT(src).then(parsed => {
        this._srtPending.delete(src);
        if (parsed) {
          this._srtCache.set(src, parsed);
          element.updateAtTime(relativeMs, parsed);
        }
      });
    }
  }

  /**
   * Invalidate cached SRT cues for a source.
   * @param {string} src - mediaId or URL
   */
  invalidateSrtCache(src) {
    this._srtCache.delete(src);
    this._srtPending.delete(src);
  }

  /**
   * Get cached SRT cues for a source, or null.
   * @param {string} src
   * @returns {Array|null}
   */
  getSrtCues(src) {
    return this._srtCache.get(src) ?? null;
  }

  /**
   * Get all currently active Element instances.
   * @returns {Array<import('@wow/core/models/Element.js').Element>}
   */
  getActiveElements() {
    return [...this._activeElements.values()];
  }

  /** @private */
  async _loadSRT(src) {
    const text = await fetchMediaText(src);
    return text ? parseSRT(text) : null;
  }

  /**
   * Force re-render a single clip's element (after property change).
   * @param {string} clipId
   */
  rerenderClip(clipId) {
    const clip = this._findClip(clipId);
    if (!clip) return;

    const oldElement = this._activeElements.get(clipId);
    if (!oldElement) return;

    const oldDom = document.getElementById(oldElement.id);
    const nextSibling = oldDom?.nextSibling;

    // Remove old
    if (oldDom) oldDom.remove();

    // Create new
    const element = this._createElementFromClip(clip);
    this._activeElements.set(clipId, element);
    const { track } = this.timeline.project.findClip(clipId);
    const zIndex = track ? this._getZIndex(this.timeline.project, track) : 0;
    const dom = element.render(zIndex);

    if (nextSibling && nextSibling.parentNode === this._canvas) {
      this._canvas.insertBefore(dom, nextSibling);
    } else {
      this._canvas.appendChild(dom);
    }

    if (this.onElementCreated) {
      this.onElementCreated(clip, element, dom);
    }

    // Immediately sync karaoke cues so the element doesn't show placeholder
    if (clip.elementType === 'karaoke') {
      this.syncKaraokeCues(element, clip, this.timeline.currentTimeMs);
    }

    return { element, dom };
  }

  /**
   * Clear all rendered elements from canvas.
   */
  clear() {
    for (const [, element] of this._activeElements) {
      const dom = document.getElementById(element.id);
      if (dom) dom.remove();
    }
    this._activeElements.clear();

    for (const [, { dom, waapi }] of this._exitingElements) {
      waapi?.cancel();
      dom.remove();
    }
    this._exitingElements.clear();
  }

  /**
   * Get the Element instance for a clip.
   * @param {string} clipId
   * @returns {import('@wow/core/models/Element.js').Element|null}
   */
  getElement(clipId) {
    return this._activeElements.get(clipId) ?? null;
  }

  /**
   * Get the clip ID for a rendered Element.
   * @param {string} elementId
   * @returns {string|null}
   */
  getClipIdForElement(elementId) {
    for (const [clipId, element] of this._activeElements) {
      if (element.id === elementId) return clipId;
    }
    return null;
  }

  /**
   * Sync element position back to its clip model.
   * @param {string} clipId
   */
  syncElementToClip(clipId) {
    const element = this._activeElements.get(clipId);
    const clip = this._findClip(clipId);
    if (!element || !clip) return;

    clip.position.x = element.position.x;
    clip.position.y = element.position.y;
    clip.position.width = element.position.width;
    clip.position.height = element.position.height;
    clip.position.rotation = element.position.rotation;
  }

  /** @private */
  _createElementFromClip(clip) {
    const Cls = ELEMENT_CLASS_MAP[clip.elementType];
    if (!Cls) {
      // Fallback to a shape
      return new ShapeElement({
        id: `ce_${clip.id}`,
        position: { ...clip.position },
        name: clip.name || clip.elementType
      });
    }
    return new Cls({
      id: `ce_${clip.id}`,
      position: { ...clip.position },
      properties: structuredClone(clip.properties),
      name: clip.name || clip.elementType
    });
  }

  /**
   * Play in-animation on a DOM element using WAAPI.
   * @param {HTMLElement} dom
   * @param {{name: string, duration: number, easing: string}} cfg
   * @private
   */
  _playInAnimation(dom, cfg) {
    const def = ANIMATION_DEFINITIONS[cfg.name];
    if (!def) return;
    dom.animate(def.keyframes, {
      duration: cfg.duration ?? def.options.duration,
      easing: cfg.easing ?? def.options.easing,
      fill: 'backwards'
    });
  }

  /**
   * Play out-animation on a DOM element and call onDone when finished.
   * @param {HTMLElement} dom
   * @param {{name: string, duration: number, easing: string}} cfg
   * @param {Function} onDone
   * @returns {Animation}
   * @private
   */
  _playOutAnimation(dom, cfg, onDone) {
    const def = ANIMATION_DEFINITIONS[cfg.name];
    if (!def) { onDone(); return null; }
    const anim = dom.animate(def.keyframes, {
      duration: cfg.duration ?? def.options.duration,
      easing: cfg.easing ?? def.options.easing,
      fill: 'forwards'
    });
    anim.onfinish = onDone;
    return anim;
  }

  /** @private */
  _findClipById(clipId) {
    return this.timeline.project.findClip(clipId).clip;
  }

  /** @private */
  _findClip(clipId) {
    return this._findClipById(clipId);
  }

  /** @private */
  _getZIndex(project, track) {
    const trackIdx = project.tracks.indexOf(track);
    // Track 0 is at the top of the timeline UI and should be frontmost.
    return (project.tracks.length - trackIdx) * 100;
  }

  /** @private */
  _findClip(clipId) {
    return this.timeline.project.findClip(clipId).clip;
  }
}
