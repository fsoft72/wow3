import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import JSZip from 'jszip';

const execFileAsync = promisify(execFile);

/**
 * Extract audio clips from a .wow3a file and return their metadata + temp file paths.
 *
 * @param {string} wow3aPath - Path to the .wow3a file
 * @returns {Promise<{tmpDir: string, clips: Array<{path: string, startMs: number, endMs: number, volume: number, fadeInMs: number, fadeOutMs: number}>} | null>}
 *   null if no audio clips found
 */
export async function extractAudio(wow3aPath) {
  const data = await readFile(wow3aPath);
  const zip = await JSZip.loadAsync(data);

  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error('Invalid .wow3a: missing project.json');

  const project = JSON.parse(await projectFile.async('string'));
  const duration = _getEffectiveDuration(project);

  // Collect audio clips with their asset references
  const audioClips = [];
  for (const track of project.tracks ?? []) {
    if (track.type !== 'audio') continue;
    for (const clip of track.clips ?? []) {
      const assetPath = clip.mediaId || clip.src;
      if (!assetPath) continue;
      audioClips.push({
        assetPath,
        startMs: clip.startMs ?? 0,
        endMs: clip.endMs ?? duration,
        volume: clip.volume ?? 1,
        fadeInMs: clip.fadeInMs ?? 0,
        fadeOutMs: clip.fadeOutMs ?? 0,
      });
    }
  }

  if (audioClips.length === 0) return null;

  // Extract audio files to a temp directory
  const tmpDir = await mkdtemp(join(tmpdir(), 'wow3-audio-'));
  const clips = [];

  for (let i = 0; i < audioClips.length; i++) {
    const ac = audioClips[i];
    let buffer;
    let ext;

    if (_isUrl(ac.assetPath)) {
      // Download external audio asset
      console.log(`Downloading external audio: ${ac.assetPath}`);
      try {
        buffer = await _downloadAsBuffer(ac.assetPath);
        ext = _extFromUrl(ac.assetPath) || 'mp3';
      } catch (err) {
        console.warn(`Failed to download audio: ${ac.assetPath} — ${err.message}`);
        continue;
      }
    } else {
      // Look for asset inside the ZIP
      const zipEntry = zip.file(ac.assetPath);
      if (!zipEntry) {
        console.warn(`Audio asset not found in ZIP: ${ac.assetPath}`);
        continue;
      }
      ext = ac.assetPath.split('.').pop() || 'mp3';
      buffer = await zipEntry.async('nodebuffer');
    }

    const tmpFile = join(tmpDir, `audio_${i}.${ext}`);
    await writeFile(tmpFile, buffer);

    clips.push({
      path: tmpFile,
      startMs: ac.startMs,
      endMs: ac.endMs,
      volume: ac.volume,
      fadeInMs: ac.fadeInMs,
      fadeOutMs: ac.fadeOutMs,
    });
  }

  if (clips.length === 0) {
    await rm(tmpDir, { recursive: true, force: true });
    return null;
  }

  return { tmpDir, clips };
}

/**
 * Merge a video file with audio clips using FFmpeg.
 *
 * @param {Object} opts
 * @param {string} opts.videoPath - Path to the video-only file
 * @param {Array<{path: string, startMs: number, endMs: number, volume: number, fadeInMs: number, fadeOutMs: number}>} opts.clips - Audio clips
 * @param {string} opts.outputPath - Final output .mp4 path
 * @returns {Promise<void>}
 */
export async function mergeAudioVideo({ videoPath, clips, outputPath, signal }) {
  // Build FFmpeg command with filter_complex
  const inputs = ['-i', videoPath];
  const filterParts = [];

  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    inputs.push('-i', c.path);

    const inputIdx = i + 1; // 0 is video
    const delayMs = c.startMs;
    const durationMs = c.endMs - c.startMs;
    const durationS = durationMs / 1000;

    // Build filter chain for this clip
    let filter = `[${inputIdx}:a]`;

    // Trim to clip duration
    filter += `atrim=0:${durationS},asetpts=PTS-STARTPTS,`;

    // Apply volume
    filter += `volume=${c.volume},`;

    // Apply fade in
    if (c.fadeInMs > 0) {
      filter += `afade=t=in:st=0:d=${c.fadeInMs / 1000},`;
    }

    // Apply fade out
    if (c.fadeOutMs > 0) {
      const fadeOutStart = (durationMs - c.fadeOutMs) / 1000;
      filter += `afade=t=out:st=${fadeOutStart}:d=${c.fadeOutMs / 1000},`;
    }

    // Apply delay (offset in the mix)
    filter += `adelay=${delayMs}|${delayMs}`;

    filter += `[a${i}]`;
    filterParts.push(filter);
  }

  // Mix all audio streams together
  const mixInputs = clips.map((_, i) => `[a${i}]`).join('');
  filterParts.push(`${mixInputs}amix=inputs=${clips.length}:normalize=0[aout]`);

  const filterComplex = filterParts.join(';');

  const args = [
    ...inputs,
    '-filter_complex', filterComplex,
    '-map', '0:v',
    '-map', '[aout]',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    '-y',
    outputPath,
  ];

  await execFileAsync('ffmpeg', args, { signal });
}

/**
 * Copy the video file as-is when there's no audio to mix.
 *
 * @param {string} videoPath
 * @param {string} outputPath
 * @param {AbortSignal} [signal] - Optional abort signal to kill ffmpeg early.
 * @returns {Promise<void>}
 */
export async function copyVideoOnly(videoPath, outputPath, signal) {
  await execFileAsync('ffmpeg', [
    '-i', videoPath,
    '-c', 'copy',
    '-y',
    outputPath,
  ], { signal });
}

/**
 * Check if a string is an HTTP(S) URL.
 * @param {string} str
 * @returns {boolean}
 */
function _isUrl(str) {
  return /^https?:\/\//i.test(str);
}

/**
 * Extract file extension from a URL path, ignoring query string.
 * @param {string} url
 * @returns {string}
 */
function _extFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const dot = pathname.lastIndexOf('.');
    if (dot !== -1) return pathname.slice(dot + 1).toLowerCase();
  } catch {}
  return '';
}

/**
 * Download a URL and return its contents as a Node.js Buffer.
 * Follows redirects automatically (native fetch).
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
async function _downloadAsBuffer(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
  const ab = await resp.arrayBuffer();
  return Buffer.from(ab);
}

/**
 * Compute effective duration from project JSON (mirrors Project.getEffectiveDuration).
 *
 * @param {Object} project
 * @returns {number} ms
 */
function _getEffectiveDuration(project) {
  if (project.durationMs > 0) return project.durationMs;
  let max = 0;
  for (const track of project.tracks ?? []) {
    for (const clip of track.clips ?? []) {
      if (clip.endMs != null && clip.endMs > max) max = clip.endMs;
    }
  }
  return max || 30000;
}
