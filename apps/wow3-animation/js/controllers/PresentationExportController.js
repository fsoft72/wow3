import html2canvas from 'html2canvas';
import { ANIMATION_DEFINITIONS } from '@wow/core/animations';
import { toast } from '@wow/core/utils/toasts.js';
import { fetchMediaArrayBuffer } from '../utils/media.js';

const EXPORT_FPS = 25;
const RECORDER_TIMESLICE_MS = 1000;
const EXPORT_START_DELAY_MS = 80;
const VIDEO_BITS_PER_SECOND = 8_000_000;

export class PresentationExportController {
  /**
   * @param {Object} deps
   * @param {import('./TimelineController.js').TimelineController} deps.timeline
   * @param {import('../views/CanvasRenderer.js').CanvasRenderer} deps.canvasRenderer
   * @param {import('./ClipController.js').ClipController} deps.clipController
   * @param {import('./PlaybackEngine.js').PlaybackEngine} deps.playback
   */
  constructor({ timeline, canvasRenderer, clipController, playback }) {
    this.timeline = timeline;
    this.canvasRenderer = canvasRenderer;
    this.clipController = clipController;
    this.playback = playback;
    this.isExporting = false;

    /** @type {Map<string, AudioBuffer>} */
    this._audioBufferCache = new Map();
  }

  /**
   * Export the whole project as a browser-recorded video file.
   * Prefers MP4 when MediaRecorder supports it, otherwise falls back to WebM.
   *
   * @param {Object} [opts]
   * @param {(payload: {progress: number, timeMs: number, durationMs: number}) => void} [opts.onProgress]
   * @returns {Promise<{blob: Blob, filename: string, mimeType: string}>}
   */
  async export(opts = {}) {
    if (this.isExporting) {
      throw new Error('An export is already in progress');
    }
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('This browser does not support MediaRecorder export');
    }

    const { onProgress } = opts;
    const slideCanvas = document.getElementById('slide-canvas');
    if (!slideCanvas) {
      throw new Error('Slide canvas not found');
    }

    this.isExporting = true;
    const project = this.timeline.project;
    const durationMs = this._getExportDurationMs(project);
    const mimeType = this._getSupportedMimeType();
    const filename = this._buildFilename(project.title, mimeType);

    /** @type {Blob[]} */
    const chunks = [];
    /** @type {MediaStream|null} */
    let exportStream = null;
    /** @type {MediaRecorder|null} */
    let mediaRecorder = null;
    /** @type {HTMLCanvasElement|null} */
    let exportCanvas = null;
    /** @type {AudioContext|null} */
    let mixAudioCtx = null;
    /** @type {MediaStreamAudioDestinationNode|null} */
    let audioDestination = null;
    /** @type {Array<{source: AudioBufferSourceNode, gain: GainNode}>} */
    const audioNodes = [];

    try {
      toast.info('Export started');

      if (this.playback.isPlaying) {
        this.playback.pause();
      }
      this.clipController.deselectAll();
      this.canvasRenderer.clear();
      this.canvasRenderer.setExportMode(true);

      exportCanvas = document.createElement('canvas');
      exportCanvas.width = project.width;
      exportCanvas.height = project.height;
      const exportCtx = exportCanvas.getContext('2d', { alpha: false });
      if (!exportCtx) {
        throw new Error('Could not create export canvas context');
      }

      exportStream = exportCanvas.captureStream(EXPORT_FPS);

      const audioMix = await this._createAudioMix(project, durationMs, EXPORT_START_DELAY_MS / 1000);
      mixAudioCtx = audioMix.ctx;
      audioDestination = audioMix.destination;
      audioNodes.push(...audioMix.nodes);
      for (const track of audioDestination.stream.getAudioTracks()) {
        exportStream.addTrack(track);
      }

      mediaRecorder = new MediaRecorder(exportStream, {
        mimeType,
        videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
      });

      const recorderStopped = new Promise((resolve, reject) => {
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) chunks.push(event.data);
        };
        mediaRecorder.onerror = (event) => reject(event.error ?? new Error('MediaRecorder error'));
        mediaRecorder.onstop = resolve;
      });

      await this._renderAtTime(0);
      await this._waitForRenderableMedia(slideCanvas, 1000);
      await this._drawSlideFrame(slideCanvas, exportCtx, project.width, project.height);

      mediaRecorder.start(RECORDER_TIMESLICE_MS);

      const startAt = performance.now() + EXPORT_START_DELAY_MS;
      let nextFrameAt = startAt;
      let previousActiveIds = this._getActiveVisualClipIds(0);

      while (true) {
        const elapsedMs = Math.max(0, performance.now() - startAt);
        if (elapsedMs >= durationMs) break;

        await this._renderAtTime(elapsedMs);

        const activeIds = this._getActiveVisualClipIds(elapsedMs);
        if (!this._sameSet(activeIds, previousActiveIds)) {
          await this._waitForRenderableMedia(slideCanvas, 250);
          previousActiveIds = activeIds;
        }

        await this._drawSlideFrame(slideCanvas, exportCtx, project.width, project.height);
        if (onProgress) {
          onProgress({
            progress: durationMs > 0 ? Math.min(1, elapsedMs / durationMs) : 1,
            timeMs: elapsedMs,
            durationMs,
          });
        }

        nextFrameAt += 1000 / EXPORT_FPS;
        const waitMs = nextFrameAt - performance.now();
        if (waitMs > 0) {
          await this._sleep(waitMs);
        }
      }

      await this._renderAtTime(durationMs);
      await this._drawSlideFrame(slideCanvas, exportCtx, project.width, project.height);
      if (onProgress) {
        onProgress({ progress: 1, timeMs: durationMs, durationMs });
      }

      await this._sleep(150);
      mediaRecorder.stop();
      await recorderStopped;

      if (chunks.length === 0) {
        throw new Error('No video data was captured');
      }

      const blob = new Blob(chunks, { type: mimeType });
      this._downloadBlob(blob, filename);
      toast.success(`Export finished (${filename})`);
      return { blob, filename, mimeType };
    } catch (err) {
      toast.error(`Export failed: ${err.message}`);
      throw err;
    } finally {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try { mediaRecorder.stop(); } catch {}
      }

      for (const { source, gain } of audioNodes) {
        try { source.stop(); } catch {}
        try { source.disconnect(); } catch {}
        try { gain.disconnect(); } catch {}
      }

      if (audioDestination) {
        for (const track of audioDestination.stream.getTracks()) {
          track.stop();
        }
      }

      if (mixAudioCtx && mixAudioCtx.state !== 'closed') {
        try { await mixAudioCtx.close(); } catch {}
      }

      if (exportStream) {
        for (const track of exportStream.getTracks()) {
          track.stop();
        }
      }

      this.canvasRenderer.setExportMode(false);
      this.isExporting = false;
    }
  }

  /**
   * @param {import('../models/Project.js').Project} project
   * @param {number} durationMs
   * @param {number} baseDelayS
   * @returns {Promise<{ctx: AudioContext, destination: MediaStreamAudioDestinationNode, nodes: Array<{source: AudioBufferSourceNode, gain: GainNode}>}>}
   * @private
   */
  async _createAudioMix(project, durationMs, baseDelayS) {
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const destination = ctx.createMediaStreamDestination();
    const nodes = [];
    const baseTime = ctx.currentTime + baseDelayS;

    for (const track of project.tracks) {
      if (track.type !== 'audio' || track.visible === false) continue;

      for (const clip of track.clips) {
        const src = clip.mediaId || clip.src;
        if (!src) continue;

        const buffer = await this._getAudioBuffer(ctx, src);
        if (!buffer) continue;

        const clipEndMs = Math.min(
          durationMs,
          clip.endMs ?? (clip.startMs + buffer.duration * 1000)
        );
        const clipDurationS = Math.max(
          0,
          Math.min((clipEndMs - clip.startMs) / 1000, buffer.duration)
        );
        if (clipDurationS <= 0) continue;

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gain = ctx.createGain();
        const volume = clip.volume ?? 1;
        const clipStartTime = baseTime + (clip.startMs / 1000);
        const clipEndTime = clipStartTime + clipDurationS;
        const fadeInS = Math.max(0, (clip.fadeInMs ?? 0) / 1000);
        const fadeOutS = Math.max(0, (clip.fadeOutMs ?? 0) / 1000);

        gain.gain.setValueAtTime(volume, clipStartTime);
        if (fadeInS > 0) {
          gain.gain.setValueAtTime(0, clipStartTime);
          gain.gain.linearRampToValueAtTime(volume, clipStartTime + Math.min(fadeInS, clipDurationS));
        }
        if (fadeOutS > 0 && clipDurationS > fadeOutS) {
          gain.gain.setValueAtTime(volume, clipEndTime - fadeOutS);
          gain.gain.linearRampToValueAtTime(0, clipEndTime);
        }

        source.connect(gain);
        gain.connect(destination);
        source.start(clipStartTime, 0, clipDurationS);
        nodes.push({ source, gain });
      }
    }

    return { ctx, destination, nodes };
  }

  /**
   * @param {AudioContext} ctx
   * @param {string} src
   * @returns {Promise<AudioBuffer|null>}
   * @private
   */
  async _getAudioBuffer(ctx, src) {
    const cached = this._audioBufferCache.get(src);
    if (cached) return cached;

    try {
      const arrayBuffer = await fetchMediaArrayBuffer(src);
      if (!arrayBuffer) return null;
      const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      this._audioBufferCache.set(src, buffer);
      return buffer;
    } catch (err) {
      console.warn('PresentationExportController: failed to decode audio', err);
      return null;
    }
  }

  /**
   * @param {HTMLElement} slideCanvas
   * @param {CanvasRenderingContext2D} exportCtx
   * @param {number} width
   * @param {number} height
   * @returns {Promise<void>}
   * @private
   */
  async _drawSlideFrame(slideCanvas, exportCtx, width, height) {
    const captured = await html2canvas(slideCanvas, {
      scale: 1,
      width,
      height,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      windowWidth: width,
      windowHeight: height,
      useCORS: true,
      logging: false,
      foreignObjectRendering: true,
      backgroundColor: getComputedStyle(slideCanvas).backgroundColor || '#000000',
      onclone: (clonedDoc) => {
        const clonedSlide = clonedDoc.getElementById(slideCanvas.id);
        if (!clonedSlide) return;
        clonedDoc.documentElement.style.margin = '0';
        clonedDoc.documentElement.style.padding = '0';
        clonedDoc.body.innerHTML = '';
        clonedDoc.body.style.margin = '0';
        clonedDoc.body.style.padding = '0';
        clonedDoc.body.style.width = `${width}px`;
        clonedDoc.body.style.height = `${height}px`;
        clonedDoc.body.style.overflow = 'hidden';
        clonedDoc.body.style.background = 'transparent';

        clonedDoc.body.appendChild(clonedSlide);
        clonedSlide.style.position = 'absolute';
        clonedSlide.style.left = '0';
        clonedSlide.style.top = '0';
        clonedSlide.style.width = `${width}px`;
        clonedSlide.style.height = `${height}px`;
        clonedSlide.style.margin = '0';
        clonedSlide.style.transform = 'none';
        clonedSlide.querySelectorAll(
          '.resize-handle, .rotate-handle, .crop-handle, .crop-corner'
        ).forEach((handle) => { handle.style.display = 'none'; });
        clonedSlide.querySelectorAll('.element.selected').forEach((el) => {
          el.classList.remove('selected');
          el.style.outline = 'none';
        });
      }
    });

    exportCtx.clearRect(0, 0, width, height);
    exportCtx.drawImage(captured, 0, 0, width, height);
  }

  /**
   * Wait briefly for active img/video nodes to become renderable.
   * @param {HTMLElement} slideCanvas
   * @param {number} timeoutMs
   * @returns {Promise<void>}
   * @private
   */
  async _waitForRenderableMedia(slideCanvas, timeoutMs) {
    const mediaEls = [...slideCanvas.querySelectorAll('img, video')];
    if (mediaEls.length === 0) return;

    const pending = mediaEls.filter((el) => {
      if (el.tagName === 'IMG') return !el.complete;
      return el.readyState < 2;
    });
    if (pending.length === 0) return;

    await Promise.race([
      Promise.allSettled(pending.map((el) => new Promise((resolve) => {
        const done = () => resolve();
        el.addEventListener('load', done, { once: true });
        el.addEventListener('loadeddata', done, { once: true });
        el.addEventListener('error', done, { once: true });
      }))),
      this._sleep(timeoutMs),
    ]);
  }

  /**
   * @param {number} timeMs
   * @returns {Set<string>}
   * @private
   */
  _getActiveVisualClipIds(timeMs) {
    const ids = new Set();
    for (const track of this.timeline.project.tracks) {
      if (track.type !== 'visual' || track.visible === false) continue;
      for (const clip of track.clips) {
        const outDuration = this._getAnimationDurationMs(clip.outAnimation);
        const inOutTail = clip.endMs !== null && timeMs >= clip.endMs && timeMs < clip.endMs + outDuration;
        if (clip.isActiveAt(timeMs) || inOutTail) ids.add(clip.id);
      }
    }
    return ids;
  }

  /**
   * @param {Set<string>} a
   * @param {Set<string>} b
   * @returns {boolean}
   * @private
   */
  _sameSet(a, b) {
    if (a.size !== b.size) return false;
    for (const value of a) {
      if (!b.has(value)) return false;
    }
    return true;
  }

  /**
   * @returns {string}
   * @private
   */
  _getSupportedMimeType() {
    const candidates = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=h264,aac',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];

    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }

    return 'video/webm';
  }

  /**
   * @param {import('../models/Project.js').Project} project
   * @returns {number}
   * @private
   */
  _getExportDurationMs(project) {
    let durationMs = project.getEffectiveDuration();

    for (const track of project.tracks) {
      if (track.type !== 'visual' || track.visible === false) continue;
      for (const clip of track.clips) {
        if (clip.endMs === null || !clip.outAnimation?.name) continue;
        durationMs = Math.max(durationMs, clip.endMs + this._getAnimationDurationMs(clip.outAnimation));
      }
    }

    return durationMs;
  }

  /**
   * @param {{name?: string, duration?: number}|null|undefined} cfg
   * @returns {number}
   * @private
   */
  _getAnimationDurationMs(cfg) {
    if (!cfg?.name) return 0;
    const def = ANIMATION_DEFINITIONS[cfg.name];
    return cfg.duration ?? def?.options?.duration ?? 600;
  }

  /**
   * @param {string} title
   * @param {string} mimeType
   * @returns {string}
   * @private
   */
  _buildFilename(title, mimeType) {
    const safeTitle = (title || 'presentation').replace(/[^a-z0-9_-]/gi, '_');
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    return `${safeTitle}.${ext}`;
  }

  /**
   * @param {Blob} blob
   * @param {string} filename
   * @private
   */
  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * @param {number} ms
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Render the slide DOM at an exact timeline time without seek clamping.
   * @param {number} timeMs
   * @returns {Promise<void>}
   * @private
   */
  async _renderAtTime(timeMs) {
    this.timeline.currentTimeMs = Math.max(0, timeMs);
    this.canvasRenderer.renderAtCurrentTime();
    await this._nextPaint();
  }

  /**
   * @returns {Promise<void>}
   * @private
   */
  _nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
}
