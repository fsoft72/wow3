import { appEvents, AppEvents } from '@wow/core/utils/events.js';
import { fetchMediaArrayBuffer } from '../utils/media.js';

/**
 * Manages Web Audio playback of AudioClip instances in sync with the timeline.
 * Creates AudioBufferSourceNodes for active audio clips during playback.
 */
export class AudioPlaybackManager {
  /**
   * @param {import('./TimelineController.js').TimelineController} timeline
   */
  constructor(timeline) {
    this.timeline = timeline;
    /** @type {AudioContext|null} */
    this._ctx = null;
    /** @type {Map<string, AudioBuffer>} mediaId/src → decoded buffer */
    this._bufferCache = new Map();
    /** @type {Map<string, {source: AudioBufferSourceNode, gain: GainNode}>} clipId → active nodes */
    this._activeSources = new Map();

    this._bindEvents();
  }

  /** @private */
  _bindEvents() {
    appEvents.on(AppEvents.PLAYBACK_STARTED, () => this._onPlay());
    appEvents.on(AppEvents.PLAYBACK_STOPPED, () => this._onStop());
  }

  /** @private */
  async _onPlay() {
    if (!this._ctx) {
      this._ctx = new AudioContext();
    }
    if (this._ctx.state === 'suspended') {
      await this._ctx.resume();
    }

    const timeMs = this.timeline.currentTimeMs;

    for (const track of this.timeline.project.tracks) {
      if (track.type !== 'audio') continue;

      for (const clip of track.clips) {
        const src = clip.mediaId || clip.src;
        if (!src) continue;
        if (!clip.isActiveAt(timeMs)) continue;

        await this._startClip(clip, timeMs);
      }
    }
  }

  /** @private */
  _onStop() {
    for (const [clipId, { source, gain }] of this._activeSources) {
      try { source.stop(); } catch (_) {}
      source.disconnect();
      gain.disconnect();
    }
    this._activeSources.clear();
  }

  /**
   * Start playing an audio clip from the correct offset.
   * @param {import('../models/AudioClip.js').AudioClip} clip
   * @param {number} currentTimeMs - Current playhead position
   */
  async _startClip(clip, currentTimeMs) {
    if (this._activeSources.has(clip.id)) return;

    const src = clip.mediaId || clip.src;
    let buffer = this._bufferCache.get(src);

    if (!buffer) {
      buffer = await this._decodeAudio(src);
      if (!buffer) return;
      this._bufferCache.set(src, buffer);
    }

    const source = this._ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this._ctx.createGain();
    gain.gain.value = clip.volume;

    // Apply fade in/out
    const clipDurationS = (clip.endMs - clip.startMs) / 1000;
    if (clip.fadeInMs > 0) {
      const fadeInS = clip.fadeInMs / 1000;
      gain.gain.setValueAtTime(0, this._ctx.currentTime);
      gain.gain.linearRampToValueAtTime(clip.volume, this._ctx.currentTime + fadeInS);
    }
    if (clip.fadeOutMs > 0) {
      const fadeOutS = clip.fadeOutMs / 1000;
      const offsetInClip = (currentTimeMs - clip.startMs) / 1000;
      const remainingS = clipDurationS - offsetInClip;
      if (remainingS > fadeOutS) {
        gain.gain.setValueAtTime(clip.volume, this._ctx.currentTime + remainingS - fadeOutS);
        gain.gain.linearRampToValueAtTime(0, this._ctx.currentTime + remainingS);
      }
    }

    source.connect(gain);
    gain.connect(this._ctx.destination);

    // Calculate offset into the audio buffer
    const offsetInClipS = Math.max(0, (currentTimeMs - clip.startMs) / 1000);
    const durationS = Math.max(0, (clip.endMs - currentTimeMs) / 1000);

    source.start(0, offsetInClipS, durationS);
    this._activeSources.set(clip.id, { source, gain });

    source.onended = () => {
      this._activeSources.delete(clip.id);
    };
  }

  /**
   * Decode audio from MediaDB or URL.
   * @param {string} src
   * @returns {Promise<AudioBuffer|null>}
   */
  async _decodeAudio(src) {
    try {
      const arrayBuffer = await fetchMediaArrayBuffer(src);
      if (!arrayBuffer) return null;
      return await this._ctx.decodeAudioData(arrayBuffer);
    } catch (err) {
      console.warn('AudioPlaybackManager: failed to decode audio:', err);
      return null;
    }
  }
}
