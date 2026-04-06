/**
 * Decodes audio files and draws waveforms inside timeline clip elements.
 * Uses Web Audio API's decodeAudioData + canvas drawing.
 */
export class WaveformRenderer {
  constructor() {
    /** @type {Map<string, Float32Array>} mediaId/src → cached peaks */
    this._cache = new Map();
    this._audioCtx = null;
  }

  /**
   * Renders a waveform into a clip element.
   * @param {HTMLElement} clipEl - The .timeline-clip DOM element
   * @param {import('../models/AudioClip.js').AudioClip} clip
   * @param {number} pxPerMs - Current zoom level
   */
  async render(clipEl, clip, pxPerMs) {
    const src = clip.mediaId || clip.src;
    if (!src) return;

    const width = Math.max(1, Math.round((clip.endMs - clip.startMs) * pxPerMs));
    const height = clipEl.offsetHeight - 8; // leave padding
    if (width < 2 || height < 2) return;

    let peaks;
    if (this._cache.has(src)) {
      peaks = this._cache.get(src);
    } else {
      peaks = await this._decodePeaks(src);
      if (!peaks) return;
      this._cache.set(src, peaks);
    }

    // Draw waveform on a canvas element
    let canvas = clipEl.querySelector('.waveform-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'waveform-canvas';
      clipEl.appendChild(canvas);
    }

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
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
      const idx = Math.floor(i * peaks.length / width);
      const val = peaks[idx] || 0;
      const barH = val * mid;
      ctx.fillRect(i, mid - barH, 1, barH * 2);
    }
  }

  /**
   * Decode audio and extract peaks.
   * @param {string} src - media ID or URL
   * @returns {Promise<Float32Array|null>}
   */
  async _decodePeaks(src) {
    try {
      if (!this._audioCtx) {
        this._audioCtx = new AudioContext();
      }

      let arrayBuffer;

      // Try MediaDB first (for media_xxx IDs)
      if (src.startsWith('media_') && typeof MediaDB !== 'undefined') {
        const item = await MediaDB.getMediaItem(src);
        if (item?.blob) {
          arrayBuffer = await item.blob.arrayBuffer();
        }
      }

      if (!arrayBuffer) {
        // Try as URL
        const resp = await fetch(src);
        arrayBuffer = await resp.arrayBuffer();
      }

      const audioBuffer = await this._audioCtx.decodeAudioData(arrayBuffer);
      const channel = audioBuffer.getChannelData(0);

      // Downsample to ~2000 peaks
      const numPeaks = 2000;
      const peaks = new Float32Array(numPeaks);
      const blockSize = Math.floor(channel.length / numPeaks);

      for (let i = 0; i < numPeaks; i++) {
        let max = 0;
        const offset = i * blockSize;
        for (let j = 0; j < blockSize; j++) {
          const val = Math.abs(channel[offset + j] || 0);
          if (val > max) max = val;
        }
        peaks[i] = max;
      }

      return peaks;
    } catch (err) {
      console.warn('Failed to decode audio for waveform:', err);
      return null;
    }
  }
}
