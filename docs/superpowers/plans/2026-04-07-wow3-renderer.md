# wow3-renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a CLI app that records wow3-animation presentations to MP4 using headless Puppeteer + puppeteer-screen-recorder, with FFmpeg audio mixing.

**Architecture:** wow3-renderer is a Node.js CLI tool in `apps/wow3-renderer/`. It serves the pre-built wow3-animation app via a local HTTP server, opens it in headless Puppeteer with `?mode=player`, loads a `.wow3a` file, records playback at 24fps, extracts audio tracks from the ZIP, and merges video+audio with FFmpeg.

**Tech Stack:** Node.js, Puppeteer, puppeteer-screen-recorder, JSZip, sirv (static file server), FFmpeg (external)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/wow3-renderer/package.json` | Package definition, dependencies, bin entry |
| Create | `apps/wow3-renderer/src/index.js` | CLI entry point + orchestration |
| Create | `apps/wow3-renderer/src/server.js` | Local HTTP server (serves dist/ + .wow3a) |
| Create | `apps/wow3-renderer/src/recorder.js` | Puppeteer launch + screen recording |
| Create | `apps/wow3-renderer/src/audio.js` | Audio extraction from ZIP + FFmpeg mixing |
| Modify | `apps/wow3-animation/js/app.js` | Add player mode: detect `?mode=player`, skip editor UI, expose `window.__wow3` API |
| Modify | `apps/wow3-animation/css/main.css` | Add `body.player-mode` styles to hide UI and show canvas full-screen |
| Modify | `package.json` (root) | Add `render` script |

---

### Task 1: Scaffold wow3-renderer package

**Files:**
- Create: `apps/wow3-renderer/package.json`
- Create: `apps/wow3-renderer/src/index.js` (placeholder)

- [ ] **Step 1: Create package.json**

Create `apps/wow3-renderer/package.json`:

```json
{
  "name": "@wow/wow3-renderer",
  "version": "0.1.0",
  "description": "CLI tool to render wow3-animation presentations to MP4",
  "private": true,
  "type": "module",
  "bin": {
    "wow3-render": "./src/index.js"
  },
  "scripts": {
    "start": "node src/index.js"
  },
  "dependencies": {
    "jszip": "^3.10.1",
    "puppeteer": "^24.0.0",
    "puppeteer-screen-recorder": "^3.0.8",
    "sirv": "^3.0.1"
  }
}
```

- [ ] **Step 2: Create placeholder entry point**

Create `apps/wow3-renderer/src/index.js`:

```javascript
#!/usr/bin/env node

/**
 * wow3-renderer CLI — renders .wow3a presentations to MP4.
 *
 * Usage: node src/index.js <path-to-file.wow3a>
 */

console.log('wow3-renderer: scaffold OK');
```

- [ ] **Step 3: Install dependencies**

Run:
```bash
cd apps/wow3-renderer && pnpm install
```

Expected: lockfile updated, node_modules populated.

- [ ] **Step 4: Add root script**

Add to the root `package.json` scripts:

```json
"render": "pnpm --filter @wow/wow3-renderer start --"
```

- [ ] **Step 5: Verify scaffold**

Run:
```bash
pnpm render -- --help
```

Expected: prints "wow3-renderer: scaffold OK" (no errors).

- [ ] **Step 6: Commit**

```bash
git add apps/wow3-renderer/package.json apps/wow3-renderer/src/index.js package.json pnpm-lock.yaml
git commit -m "feat(wow3-renderer): scaffold package with dependencies"
```

---

### Task 2: Add player mode to wow3-animation

**Files:**
- Modify: `apps/wow3-animation/js/app.js`
- Modify: `apps/wow3-animation/css/main.css`

- [ ] **Step 1: Add player-mode CSS**

Append to `apps/wow3-animation/css/main.css`:

```css
/* ── Player mode (headless renderer) ── */
body.player-mode {
  grid-template-rows: 1fr;
  grid-template-areas: "workspace";
}
body.player-mode #top-bar,
body.player-mode #playback-bar,
body.player-mode #timeline-area,
body.player-mode #properties-panel { display: none !important; }
body.player-mode #workspace {
  grid-template-columns: 1fr;
}
body.player-mode #canvas-area {
  display: block;
  background: #000;
  overflow: hidden;
}
body.player-mode #canvas-wrapper {
  transform: none !important;
  box-shadow: none;
}
body.player-mode #slide-canvas {
  position: absolute;
  top: 0;
  left: 0;
}
```

- [ ] **Step 2: Add player mode detection and API to app.js**

In `apps/wow3-animation/js/app.js`, add a static helper method to `WOW3AnimationApp` and modify the `init()` method. Insert this method right after the constructor (after line 44):

```javascript
  /**
   * Detect if running in player mode via URL parameter.
   * @returns {boolean}
   */
  static get isPlayerMode() {
    return new URLSearchParams(window.location.search).has('mode', 'player');
  }
```

Then modify the `init()` method to support player mode. Replace the existing `init()` method (lines 46-59) with:

```javascript
  async init() {
    this._playerMode = WOW3AnimationApp.isPlayerMode;

    this._initProject();
    this._initControllers();
    this._initCanvas();

    if (!this._playerMode) {
      this._initUI();
      this._setupGlobals();
      this._bindKeyboard();
      this._initMediaManager();
      this._initJsonEditor();
      this._initImportExport();
      this._startAutoSave();
    } else {
      document.body.classList.add('player-mode');
      this._initMediaManager();
    }

    this.canvasRenderer.renderAtCurrentTime();

    if (this._playerMode) {
      this._exposePlayerAPI();
    }

    console.log(this._playerMode ? 'WOW3 Player mode initialized' : 'WOW3 Animation Editor initialized');
  }
```

- [ ] **Step 3: Add the _exposePlayerAPI method**

Add this method to the `WOW3AnimationApp` class, after the `_applyRedo()` method (after line 642):

```javascript
  /**
   * Expose a control API on window.__wow3 for external automation (headless renderer).
   * @private
   */
  _exposePlayerAPI() {
    const self = this;
    let endResolve = null;

    // Listen for playback end
    appEvents.on(AppEvents.PLAYBACK_STOPPED, () => {
      if (endResolve && self.timeline.currentTimeMs >= self.project.getEffectiveDuration()) {
        endResolve();
        endResolve = null;
      }
    });

    window.__wow3 = {
      /** @returns {boolean} */
      get ready() { return true; },

      /** @returns {number} Total project duration in ms */
      get duration() { return self.project.getEffectiveDuration(); },

      /** @returns {number} Current playback position in ms */
      get currentTime() { return self.timeline.currentTimeMs; },

      /** @returns {{width: number, height: number}} Project resolution */
      get resolution() { return { width: self.project.width, height: self.project.height }; },

      /**
       * Load a .wow3a file from a URL.
       * @param {string} url
       * @returns {Promise<void>}
       */
      async loadFile(url) {
        const resp = await fetch(url);
        const blob = await resp.blob();
        const file = new File([blob], 'input.wow3a', { type: 'application/zip' });

        const { importProjectZip } = await import('./utils/projectStorage.js');
        const jsonData = await importProjectZip(file);
        const newProject = Project.fromJSON(jsonData);

        self.timeline.project = newProject;
        self.project = newProject;

        // Set canvas to exact project dimensions
        const canvas = document.getElementById('slide-canvas');
        canvas.style.width = newProject.width + 'px';
        canvas.style.height = newProject.height + 'px';

        self.canvasRenderer.clear();
        self.timeline.seekTo(0);
        self.canvasRenderer.renderAtCurrentTime();
      },

      /**
       * Start playback from the beginning. Returns a Promise that resolves when playback ends.
       * @returns {Promise<void>}
       */
      play() {
        self.timeline.seekTo(0);
        return new Promise((resolve) => {
          endResolve = resolve;
          self.playback.play();
        });
      }
    };
  }
```

- [ ] **Step 4: Build wow3-animation and verify player mode**

Run:
```bash
cd apps/wow3-animation && pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/wow3-animation/js/app.js apps/wow3-animation/css/main.css
git commit -m "feat(wow3-animation): add player mode for headless rendering"
```

---

### Task 3: Implement the local HTTP server

**Files:**
- Create: `apps/wow3-renderer/src/server.js`

- [ ] **Step 1: Write server.js**

Create `apps/wow3-renderer/src/server.js`:

```javascript
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sirv from 'sirv';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Start a local HTTP server that serves the wow3-animation dist and the input .wow3a file.
 *
 * @param {string} wow3aPath - Absolute path to the .wow3a file to serve
 * @returns {Promise<{port: number, close: () => Promise<void>}>}
 */
export async function startServer(wow3aPath) {
  const distDir = resolve(__dirname, '../../wow3-animation/dist');
  const serve = sirv(distDir, { dev: true, single: false });

  const wow3aBuffer = readFileSync(wow3aPath);

  const server = createServer((req, res) => {
    // Serve the .wow3a file at /input.wow3a
    if (req.url === '/input.wow3a') {
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Length': wow3aBuffer.length,
      });
      res.end(wow3aBuffer);
      return;
    }

    // Everything else: static files from wow3-animation dist
    serve(req, res);
  });

  return new Promise((resolveP) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolveP({
        port,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}
```

- [ ] **Step 2: Verify server starts**

Temporarily add a test to `apps/wow3-renderer/src/index.js`:

```javascript
#!/usr/bin/env node
import { startServer } from './server.js';
const { port, close } = await startServer(process.argv[2] || '/dev/null');
console.log(`Server running on http://127.0.0.1:${port}`);
await close();
console.log('Server closed');
```

Run:
```bash
pnpm render -- /dev/null
```

Expected: prints "Server running on http://127.0.0.1:XXXXX" then "Server closed".

- [ ] **Step 3: Commit**

```bash
git add apps/wow3-renderer/src/server.js apps/wow3-renderer/src/index.js
git commit -m "feat(wow3-renderer): add local HTTP server for dist and .wow3a"
```

---

### Task 4: Implement the Puppeteer recorder

**Files:**
- Create: `apps/wow3-renderer/src/recorder.js`

- [ ] **Step 1: Write recorder.js**

Create `apps/wow3-renderer/src/recorder.js`:

```javascript
import puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';

/**
 * Record a wow3-animation presentation playing in headless Puppeteer.
 *
 * @param {Object} opts
 * @param {number} opts.port - Local server port
 * @param {number} opts.width - Project width in px
 * @param {number} opts.height - Project height in px
 * @param {string} opts.outputPath - Temp path for the video file
 * @param {(msg: string) => void} [opts.onProgress] - Progress callback
 * @returns {Promise<void>}
 */
export async function record({ port, width, height, outputPath, onProgress }) {
  const log = onProgress || (() => {});

  log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      `--window-size=${width},${height}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });

    log('Loading player...');
    await page.goto(`http://127.0.0.1:${port}/?mode=player`, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Wait for the player API to be available
    await page.waitForFunction(() => window.__wow3?.ready === true, { timeout: 15000 });

    log('Loading presentation...');
    await page.evaluate(async () => {
      await window.__wow3.loadFile('/input.wow3a');
    });

    // Read duration and resolution from the loaded project
    const duration = await page.evaluate(() => window.__wow3.duration);
    log(`Presentation duration: ${(duration / 1000).toFixed(1)}s`);

    // Configure and start recording
    const recorder = new PuppeteerScreenRecorder(page, {
      followNewTab: false,
      fps: 24,
      ffmpeg_Path: null,
      videoFrame: { width, height },
      videoCrf: 18,
      videoCodec: 'libx264',
      videoPreset: 'ultrafast',
      videoBitrate: 8000,
    });

    log('Starting recording...');
    await recorder.start(outputPath);

    // Start playback and wait for it to end
    await page.evaluate(() => window.__wow3.play());

    log('Recording complete.');
    await recorder.stop();
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/wow3-renderer/src/recorder.js
git commit -m "feat(wow3-renderer): add Puppeteer screen recorder"
```

---

### Task 5: Implement audio extraction and FFmpeg mixing

**Files:**
- Create: `apps/wow3-renderer/src/audio.js`

- [ ] **Step 1: Write audio.js**

Create `apps/wow3-renderer/src/audio.js`:

```javascript
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
    const zipEntry = zip.file(ac.assetPath);
    if (!zipEntry) {
      console.warn(`Audio asset not found in ZIP: ${ac.assetPath}`);
      continue;
    }

    const ext = ac.assetPath.split('.').pop() || 'mp3';
    const tmpFile = join(tmpDir, `audio_${i}.${ext}`);
    const buffer = await zipEntry.async('nodebuffer');
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
export async function mergeAudioVideo({ videoPath, clips, outputPath }) {
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

  await execFileAsync('ffmpeg', args);
}

/**
 * Copy the video file as-is when there's no audio to mix.
 *
 * @param {string} videoPath
 * @param {string} outputPath
 * @returns {Promise<void>}
 */
export async function copyVideoOnly(videoPath, outputPath) {
  await execFileAsync('ffmpeg', [
    '-i', videoPath,
    '-c', 'copy',
    '-y',
    outputPath,
  ]);
}

/**
 * Compute effective duration from project JSON (mirrors Project.getEffectiveDuration).
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/wow3-renderer/src/audio.js
git commit -m "feat(wow3-renderer): add audio extraction and FFmpeg mixing"
```

---

### Task 6: Implement the CLI entry point and orchestration

**Files:**
- Modify: `apps/wow3-renderer/src/index.js`

- [ ] **Step 1: Write the full CLI entry point**

Replace the contents of `apps/wow3-renderer/src/index.js` with:

```javascript
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
  const inputArg = process.argv[2];

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
```

- [ ] **Step 2: Commit**

```bash
git add apps/wow3-renderer/src/index.js
git commit -m "feat(wow3-renderer): implement CLI orchestration"
```

---

### Task 7: Build wow3-animation and end-to-end test

**Files:** None (testing only)

- [ ] **Step 1: Build wow3-animation with player mode**

Run:
```bash
pnpm build:animation
```

Expected: Build succeeds.

- [ ] **Step 2: Run wow3-renderer on a test file**

If you have a `.wow3a` test file available, run:

```bash
pnpm render -- /path/to/test-presentation.wow3a
```

Expected output:
```
[wow3-renderer] Project: 1920x1080, duration: XXs
[wow3-renderer] Output: /path/to/test-presentation.mp4
[wow3-renderer] Server started on port XXXXX
[wow3-renderer] Launching browser...
[wow3-renderer] Loading player...
[wow3-renderer] Loading presentation...
[wow3-renderer] Presentation duration: XXs
[wow3-renderer] Starting recording...
[wow3-renderer] Recording complete.
[wow3-renderer] Processing audio...
[wow3-renderer] Done! Output: /path/to/test-presentation.mp4
```

Verify the output MP4 plays correctly with `ffplay` or VLC.

- [ ] **Step 3: Test error cases**

Run without arguments:
```bash
pnpm render
```
Expected: prints usage info.

Run with non-existent file:
```bash
pnpm render -- /tmp/nonexistent.wow3a
```
Expected: prints "Error: File not found".

- [ ] **Step 4: Update CHANGES.md and commit**

Add an entry to `CHANGES.md` at the root:

```markdown
## wow3-renderer

- Added new app `wow3-renderer` — CLI tool to render .wow3a presentations to MP4
- Uses Puppeteer headless + puppeteer-screen-recorder at 24fps
- Supports audio mixing via FFmpeg
- Added `?mode=player` to wow3-animation for headless rendering
```

```bash
git add CHANGES.md
git commit -m "docs: update CHANGES.md with wow3-renderer"
```
