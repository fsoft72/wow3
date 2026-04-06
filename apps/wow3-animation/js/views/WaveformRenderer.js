import { fetchMediaArrayBuffer } from '../utils/media.js';

/**
 * Decodes audio files and draws waveforms inside timeline clip elements.
 * Only draws the portion of the waveform visible within the clip's time window.
 */
export class WaveformRenderer {
  constructor() {
    /** @type {Map<string, {peaks: Float32Array, durationMs: number}>} src → cached data */
    this._cache = new Map();
    this._audioCtx = null;
  }

  /**
   * Renders a waveform into a clip element.
   * Only the portion of the audio within [clip.startMs .. clip.endMs] is drawn.
   * @param {HTMLElement} clipEl - The .timeline-clip DOM element
   * @param {import('../models/AudioClip.js').AudioClip} clip
   * @param {number} pxPerMs - Current zoom level
   */
  async render(clipEl, clip, pxPerMs) {
    const src = clip.mediaId || clip.src;
    if (!src) return;

    const clipDurationMs = clip.endMs - clip.startMs;
    const width = Math.max(1, Math.round(clipDurationMs * pxPerMs));
    const height = clipEl.offsetHeight - 8;
    if (width < 2 || height < 2) return;

    let data = this._cache.get(src);
    if (!data) {
      data = await this._decodeAudio(src);
      if (!data) return;
      this._cache.set(src, data);
    }

    const { peaks, durationMs } = data;

    // Calculate which portion of the peaks array corresponds to the clip window.
    // The clip covers [0 .. clipDurationMs] of the audio (from the start of the file).
    // If the clip is shorter than the audio, we only show that initial portion.
    const startFraction = 0; // clips always start from beginning of audio file
    const endFraction = Math.min(1, clipDurationMs / durationMs);
    const startIdx = Math.floor(startFraction * peaks.length);
    const endIdx = Math.floor(endFraction * peaks.length);
    const visiblePeaks = endIdx - startIdx;

    // Draw
    let canvas = clipEl.querySelector('.waveform-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'waveform-canvas';
      clipEl.appendChild(canvas);
    }

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.style.position = 'absolute';
    canvas.style.top = '4px';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.opacity = '0.5';

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';

    const mid = height / 2;

    for (let i = 0; i < width; i++) {
      const idx = startIdx + Math.floor(i * visiblePeaks / width);
      const val = peaks[idx] || 0;
      const barH = val * mid;
      ctx.fillRect(i, mid - barH, 1, barH * 2);
    }
  }

  /**
   * Decode audio and extract peaks + duration.
   * @param {string} src - media ID or URL
   * @returns {Promise<{peaks: Float32Array, durationMs: number}|null>}
   */
  async _decodeAudio(src) {
    try {
      if (!this._audioCtx) {
        this._audioCtx = new AudioContext();
      }

      const arrayBuffer = await fetchMediaArrayBuffer(src);
      if (!arrayBuffer) return null;

      const audioBuffer = await this._audioCtx.decodeAudioData(arrayBuffer);
      const channel = audioBuffer.getChannelData(0);
      const durationMs = Math.round(audioBuffer.duration * 1000);

      // Downsample to ~4000 peaks for good resolution even on long files
      const numPeaks = 4000;
      const peaks = new Float32Array(numPeaks);
      const blockSize = Math.max(1, Math.floor(channel.length / numPeaks));

      for (let i = 0; i < numPeaks; i++) {
        let max = 0;
        const offset = i * blockSize;
        for (let j = 0; j < blockSize; j++) {
          const val = Math.abs(channel[offset + j] || 0);
          if (val > max) max = val;
        }
        peaks[i] = max;
      }

      return { peaks, durationMs };
    } catch (err) {
      console.warn('Failed to decode audio for waveform:', err);
      return null;
    }
  }
}
