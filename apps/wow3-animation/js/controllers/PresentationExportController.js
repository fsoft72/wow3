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
   * Uses a two-phase approach for accurate frame rate and audio sync:
   *   Phase 1 – Capture every frame offline (slow but frame-accurate)
   *   Phase 2 – Play captured frames back in real-time with audio
   *
   * @param {Object} [opts]
   * @param {(payload: {progress: number}) => void} [opts.onProgress]
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
    const frameDurationMs = 1000 / EXPORT_FPS;
    const totalFrames = Math.ceil(durationMs / frameDurationMs) + 1;
    const mimeType = this._getSupportedMimeType();
    const filename = this._buildFilename(project.title, mimeType);

    /** @type {Blob[]} */
    const capturedFrames = [];
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
      toast.info('Preloading assets…');
      if (this.playback.isPlaying) this.playback.pause();
      this.clipController.deselectAll();
      await this._preloadAssets(project);

      // ── Phase 1: capture every frame offline ──
      toast.info('Capturing frames…');
      this.canvasRenderer.clear();
      this.canvasRenderer.setExportMode(true);

      let previousActiveIds = new Set();
      const { width, height } = project;

      for (let i = 0; i < totalFrames; i++) {
        const timeMs = Math.min(durationMs, i * frameDurationMs);
        await this._renderAtTime(timeMs);

        const activeIds = this._getActiveVisualClipIds(timeMs);
        if (!this._sameSet(activeIds, previousActiveIds)) {
          await this._waitForRenderableMedia(slideCanvas, 500);
          previousActiveIds = activeIds;
        }

        const canvas = await this._captureFrame(slideCanvas, width, height);
        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
        capturedFrames.push(blob);

        if (onProgress) {
          onProgress({ progress: (i / totalFrames) * 0.7 });
        }
      }

      this.canvasRenderer.setExportMode(false);

      // ── Phase 2: real-time playback + recording ──
      toast.info('Recording video…');
      exportCanvas = document.createElement('canvas');
      exportCanvas.width = width;
      exportCanvas.height = height;
      const exportCtx = exportCanvas.getContext('2d', { alpha: false });
      if (!exportCtx) throw new Error('Could not create export canvas context');

      exportStream = exportCanvas.captureStream(EXPORT_FPS);

      // Create audio mix right before recording so timing aligns
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
        mediaRecorder.ondataavailable = (e) => {
          if (e.data?.size > 0) chunks.push(e.data);
        };
        mediaRecorder.onerror = (e) => reject(e.error ?? new Error('MediaRecorder error'));
        mediaRecorder.onstop = resolve;
      });

      // Draw the first frame before starting the recorder
      const firstBmp = await createImageBitmap(capturedFrames[0]);
      exportCtx.drawImage(firstBmp, 0, 0, width, height);
      firstBmp.close();

      mediaRecorder.start(RECORDER_TIMESLICE_MS);

      // Real-time playback loop – audio and frames are both real-time, so they stay in sync
      await new Promise((resolve) => {
        const playbackStart = performance.now() + EXPORT_START_DELAY_MS;
        let lastDrawn = 0;
        let decoding = false;

        const tick = () => {
          const elapsed = performance.now() - playbackStart;

          if (elapsed >= durationMs) {
            // Draw the very last frame and finish
            createImageBitmap(capturedFrames[capturedFrames.length - 1]).then(bmp => {
              exportCtx.drawImage(bmp, 0, 0, width, height);
              bmp.close();
              resolve();
            });
            return;
          }

          const targetFrame = Math.min(
            capturedFrames.length - 1,
            Math.floor(elapsed / frameDurationMs)
          );

          if (targetFrame > lastDrawn && !decoding) {
            decoding = true;
            createImageBitmap(capturedFrames[targetFrame]).then(bmp => {
              exportCtx.drawImage(bmp, 0, 0, width, height);
              bmp.close();
              lastDrawn = targetFrame;
              decoding = false;
            });
          }

          if (onProgress) {
            onProgress({ progress: 0.7 + (elapsed / durationMs) * 0.3 });
          }

          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      });

      if (onProgress) onProgress({ progress: 1 });

      await this._sleep(200);
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

      capturedFrames.length = 0;
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
   * Capture a single frame from the slide DOM using html2canvas.
   * @param {HTMLElement} slideCanvas
   * @param {number} width
   * @param {number} height
   * @returns {Promise<HTMLCanvasElement>}
   * @private
   */
  async _captureFrame(slideCanvas, width, height) {
    return html2canvas(slideCanvas, {
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
   * Preload all media assets (images, video, audio) used in the project
   * so they are warm in the browser cache before frame capture starts.
   * @param {import('../models/Project.js').Project} project
   * @returns {Promise<void>}
   * @private
   */
  async _preloadAssets(project) {
    const imageUrls = new Set();
    const audioSrcs = new Set();

    for (const track of project.tracks) {
      if (track.visible === false) continue;

      for (const clip of track.clips) {
        if (track.type === 'visual') {
          const url = clip.properties?.url;
          if (url && url.startsWith('media_')) {
            imageUrls.add(url);
          }
          // Text element background images
          const bgUrl = clip.properties?.backgroundImage?.url;
          if (bgUrl && bgUrl.startsWith('media_')) {
            imageUrls.add(bgUrl);
          }
        }

        if (track.type === 'audio') {
          const src = clip.mediaId || clip.src || clip.properties?.url;
          if (src) audioSrcs.add(src);
        }
      }
    }

    const promises = [];

    // Preload images: resolve data URL from MediaDB, then decode into browser cache
    if (window.MediaDB) {
      for (const mediaId of imageUrls) {
        promises.push(
          window.MediaDB.getMediaDataURL(mediaId)
            .then((dataURL) => {
              if (!dataURL) return;
              return new Promise((resolve) => {
                const img = new Image();
                img.onload = resolve;
                img.onerror = resolve;
                img.src = dataURL;
              });
            })
            .catch(() => {})
        );
      }
    }

    // Preload audio buffers (need a temporary AudioContext for decoding)
    if (audioSrcs.size > 0) {
      const tmpCtx = new AudioContext();
      for (const src of audioSrcs) {
        promises.push(this._getAudioBuffer(tmpCtx, src).catch(() => {}));
      }
      // Close the temp context after all decodes finish (buffers stay in our cache)
      promises.push(
        Promise.allSettled(promises.slice()).then(() => tmpCtx.close()).catch(() => {})
      );
    }

    await Promise.allSettled(promises);
  }

  /**
   * @returns {Promise<void>}
   * @private
   */
  _nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
}
