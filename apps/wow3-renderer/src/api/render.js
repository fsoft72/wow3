import { readFile, rm, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import JSZip from 'jszip';
import { startServer } from '../server.js';
import { record } from '../recorder.js';
import { extractAudio, mergeAudioVideo, copyVideoOnly } from '../audio.js';

/**
 * Read project dimensions and duration from a .wow3a file.
 * @param {string} inputPath
 * @returns {Promise<{ width: number, height: number, durationMs: number }>}
 */
async function _readProjectInfo(inputPath) {
  const data = await readFile(inputPath);
  const zip = await JSZip.loadAsync(data);
  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error('Invalid .wow3a: missing project.json');

  const project = JSON.parse(await projectFile.async('string'));
  const width = project.width || 1920;
  const height = project.height || 1080;

  let durationMs = project.durationMs || 0;
  if (durationMs <= 0) {
    let max = 0;
    for (const track of project.tracks ?? []) {
      for (const clip of track.clips ?? []) {
        if (clip.endMs != null && clip.endMs > max) max = clip.endMs;
      }
    }
    durationMs = max || 30000;
  }

  return { width, height, durationMs };
}

/**
 * Render a .wow3a file to an MP4.
 *
 * @param {Object} opts
 * @param {string} opts.inputPath  - Absolute path to the .wow3a file
 * @param {string} opts.outputPath - Absolute path for the output .mp4
 * @param {(msg: string) => void} [opts.onProgress] - Progress callback (receives log strings)
 * @returns {Promise<void>}
 */
export async function renderJob({ inputPath, outputPath, onProgress = () => {} }) {
  const tmpVideoPath = join(tmpdir(), `wow3-video-${Date.now()}.mp4`);
  let server;

  await mkdir(dirname(outputPath), { recursive: true });

  try {
    const { width, height } = await _readProjectInfo(inputPath);

    server = await startServer(inputPath);

    await record({ port: server.port, width, height, outputPath: tmpVideoPath, onProgress });

    const audioData = await extractAudio(inputPath);
    if (audioData) {
      try {
        await mergeAudioVideo({ videoPath: tmpVideoPath, clips: audioData.clips, outputPath });
      } finally {
        await rm(audioData.tmpDir, { recursive: true, force: true });
      }
    } else {
      await copyVideoOnly(tmpVideoPath, outputPath);
    }
  } finally {
    if (server) await server.close();
    try { await rm(tmpVideoPath, { force: true }); } catch {}
  }
}
