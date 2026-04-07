#!/usr/bin/env node

/**
 * wow3-renderer CLI — renders .wow3a presentations to MP4.
 *
 * Usage: node src/index.js <path-to-file.wow3a>
 */

import { resolve, dirname, basename, join } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { startServer } from './server.js';
import { record } from './recorder.js';
import { extractAudio, mergeAudioVideo, copyVideoOnly } from './audio.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);

/**
 * Print a message to stdout with a prefix.
 * @param {string} msg
 */
function log(msg) {
  console.log(`[wow3-renderer] ${msg}`);
}

/**
 * Validate that all prerequisites are met.
 * @param {string} inputPath
 * @returns {Promise<{width: number, height: number, durationMs: number}>} Project info
 */
async function validate(inputPath) {
  // Check input file exists
  if (!existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  // Check it's a valid .wow3a
  try {
    const data = await readFile(inputPath);
    const zip = await JSZip.loadAsync(data);
    const projectFile = zip.file('project.json');
    if (!projectFile) throw new Error('missing project.json');
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

    // Check FFmpeg is available
    try {
      await execFileAsync('ffmpeg', ['-version']);
    } catch {
      console.error('Error: FFmpeg not found. Install it: https://ffmpeg.org/download.html');
      process.exit(1);
    }

    // Check wow3-animation build exists
    const distDir = resolve(__dirname, '../../wow3-animation/dist');
    if (!existsSync(distDir)) {
      console.error('Error: wow3-animation not built. Run: pnpm build:animation');
      process.exit(1);
    }

    return { width, height, durationMs };
  } catch (err) {
    console.error(`Error: Invalid .wow3a file: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Main entry point.
 */
async function main() {
  const inputArg = process.argv.slice(2).find(a => a !== '--');

  if (!inputArg || inputArg === '--help' || inputArg === '-h') {
    console.log('Usage: wow3-render <path-to-file.wow3a>');
    console.log('');
    console.log('Renders a .wow3a presentation to MP4 in the same directory.');
    process.exit(inputArg ? 0 : 1);
  }

  const inputPath = resolve(inputArg);
  const outputPath = join(dirname(inputPath), basename(inputPath, '.wow3a') + '.mp4');
  const tmpVideoPath = join(tmpdir(), `wow3-video-${Date.now()}.mp4`);

  // Validate prerequisites
  const { width, height, durationMs } = await validate(inputPath);
  log(`Project: ${width}x${height}, duration: ${(durationMs / 1000).toFixed(1)}s`);
  log(`Output: ${outputPath}`);

  let server;
  try {
    // Start local server
    server = await startServer(inputPath);
    log(`Server started on port ${server.port}`);

    // Record the presentation
    await record({
      port: server.port,
      width,
      height,
      outputPath: tmpVideoPath,
      onProgress: log,
    });

    // Extract and mix audio
    log('Processing audio...');
    const audioData = await extractAudio(inputPath);

    if (audioData) {
      log(`Mixing ${audioData.clips.length} audio track(s)...`);
      try {
        await mergeAudioVideo({
          videoPath: tmpVideoPath,
          clips: audioData.clips,
          outputPath,
        });
      } finally {
        await rm(audioData.tmpDir, { recursive: true, force: true });
      }
    } else {
      log('No audio tracks found.');
      await copyVideoOnly(tmpVideoPath, outputPath);
    }

    log(`Done! Output: ${outputPath}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  } finally {
    // Cleanup
    if (server) await server.close();
    try { await rm(tmpVideoPath, { force: true }); } catch {}
  }
}

main();
