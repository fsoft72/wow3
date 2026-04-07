# wow3-renderer Design Spec

## Overview

**wow3-renderer** is a Node.js CLI app added to the `wow3` monorepo under `apps/wow3-renderer/`. It takes a `.wow3a` presentation file as input and exports it as an `.mp4` video file saved in the same directory.

It works by serving the built wow3-animation app locally, opening it in headless Puppeteer in a dedicated "player mode", playing the presentation in real-time, and recording the screen with `puppeteer-screen-recorder` at 24fps. Audio tracks are extracted from the `.wow3a` file and mixed separately with FFmpeg, then merged into the final `.mp4`.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   wow3-renderer CLI                  │
│                   (src/index.js)                     │
├─────────────┬──────────────┬────────────────────────┤
│  Server     │  Recorder    │  Audio Mixer            │
│ (src/       │ (src/        │ (src/audio.js)          │
│  server.js) │  recorder.js)│                         │
├─────────────┴──────────────┴────────────────────────┤
│              External Dependencies                   │
│  Puppeteer  │  puppeteer-screen-recorder  │  FFmpeg  │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────┐
│  wow3-animation       │
│  (pre-built dist/)    │
│  ?mode=player         │
└───────────────────────┘
```

## Components

### 1. CLI Entry Point (`src/index.js`)

Responsibilities:
- Parse CLI arguments: path to `.wow3a` file
- Validate prerequisites:
  - Input file exists and is a valid `.wow3a` (ZIP with `project.json`)
  - FFmpeg is installed and accessible in PATH
  - wow3-animation build exists at `apps/wow3-animation/dist/`
- Read `.wow3a` to determine project resolution and duration
- Orchestrate the full pipeline: server start -> record -> audio mix -> merge -> cleanup
- Print progress to stdout
- Exit with appropriate codes on error

Usage:
```bash
node apps/wow3-renderer/src/index.js /path/to/presentation.wow3a
# Output: /path/to/presentation.mp4
```

### 2. Local Server (`src/server.js`)

Responsibilities:
- Serve `apps/wow3-animation/dist/` as static files at the root
- Serve the input `.wow3a` file at `/input.wow3a`
- Start on a random available port
- Return the assigned port so the recorder knows the URL
- Provide a `close()` method for cleanup

Implementation:
- Use Node.js built-in `http` module + `sirv` for static file serving
- No external framework needed

### 3. Recorder (`src/recorder.js`)

Responsibilities:
- Launch Puppeteer in headless mode
- Set viewport to match project resolution (1920x1080 for landscape, 1080x1920 for portrait)
- Navigate to `http://localhost:PORT/?mode=player`
- Wait for page to be ready (exposed `window.__wow3.ready` promise)
- Call `window.__wow3.loadFile('/input.wow3a')` to load the presentation
- Call `window.__wow3.play()` to start playback
- Start `puppeteer-screen-recorder` with 24fps
- Wait for playback to end (poll `window.__wow3.currentTime >= window.__wow3.duration` or listen for `window.__wow3.onEnd`)
- Stop recording, save video to a temp file
- Close browser

puppeteer-screen-recorder config:
```javascript
{
  followNewTab: false,
  fps: 24,
  videoFrame: {
    width: projectWidth,
    height: projectHeight
  },
  aspectRatio: '16:9' // or '9:16' for portrait
}
```

### 4. Audio Mixer (`src/audio.js`)

Responsibilities:
- Read the `.wow3a` ZIP file using `jszip`
- Parse `project.json` to find audio clips with their timing:
  - `startMs` — when the clip starts
  - `endMs` — when the clip ends (null = until project end)
  - `volume` — 0 to 1
  - `fadeInMs` — fade-in duration
  - `fadeOutMs` — fade-out duration
  - `mediaId` / filename — reference to the audio asset
- Extract audio files from the `assets/` folder in the ZIP to temp directory
- Build FFmpeg filter_complex command to:
  - Delay each audio track by its `startMs`
  - Apply volume adjustment
  - Apply fade in/out filters
  - Trim to `endMs - startMs` duration
  - Mix all tracks together
- If no audio clips exist, skip audio processing entirely

FFmpeg merge (final step):
```bash
ffmpeg -i /tmp/video-only.mp4 -i /tmp/audio-mix.mp3 \
  -c:v copy -c:a aac -b:a 192k \
  -shortest /path/to/presentation.mp4
```

If no audio clips: simply rename/copy the video-only file to the final output.

### 5. Modifications to wow3-animation: Player Mode

Triggered by URL parameter `?mode=player`.

Behavior:
- Hide all UI: toolbar, timeline panel, properties panel, any overlay
- Show only `#slide-canvas` at its native resolution (no scaling, no letterboxing)
- Set `document.body` background to black
- Position `#slide-canvas` at 0,0

Exposed API on `window.__wow3`:
- `ready` — Promise that resolves when the app is fully initialized
- `loadFile(url)` — Fetches a `.wow3a` from the given URL, imports it into the player, returns Promise
- `play()` — Starts playback from the beginning
- `duration` — Total project duration in milliseconds (getter)
- `currentTime` — Current playback position in milliseconds (getter)
- `onEnd` — Promise that resolves when playback reaches the end

Implementation:
- Detect `mode=player` early in `app.js` initialization
- Skip rendering editor UI components (timeline view, properties panel)
- After project load, set CSS to hide everything except canvas
- Expose the `window.__wow3` API object for external control

## Execution Flow

```
1. CLI validates input (.wow3a exists, FFmpeg available, build present)
2. Read .wow3a → parse project.json → extract resolution + duration
3. Start HTTP server (serves wow3-animation dist/ + input .wow3a)
4. Launch Puppeteer headless (viewport = project resolution)
5. Navigate to http://localhost:PORT/?mode=player
6. Wait for window.__wow3.ready
7. page.evaluate → __wow3.loadFile('/input.wow3a')
8. page.evaluate → __wow3.play()
9. Start puppeteer-screen-recorder (24fps)
10. Wait for playback to finish (__wow3.onEnd)
11. Stop recording → save to temp video file
12. Extract audio clips from .wow3a → temp directory
13. FFmpeg: mix audio tracks with correct timing → temp audio file
14. FFmpeg: merge video + audio → /path/to/presentation.mp4
15. Cleanup: stop server, close browser, delete temp files
```

## Dependencies

### wow3-renderer package.json

```json
{
  "name": "@wow/wow3-renderer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "wow3-render": "./src/index.js"
  },
  "dependencies": {
    "puppeteer": "latest",
    "puppeteer-screen-recorder": "latest",
    "jszip": "latest",
    "sirv": "latest"
  }
}
```

### External

- **FFmpeg** — must be installed on the system and available in PATH

## File Structure

```
apps/wow3-renderer/
├── package.json
├── src/
│   ├── index.js        # CLI entry point + orchestration
│   ├── server.js       # Local HTTP server
│   ├── recorder.js     # Puppeteer + screen recorder
│   └── audio.js        # Audio extraction + FFmpeg mixing
```

## Monorepo Integration

### Root package.json additions

```json
{
  "scripts": {
    "render": "pnpm --filter @wow/wow3-renderer start"
  }
}
```

### wow3-renderer does NOT depend on wow3-animation as a package

It accesses the build output via relative path (`../wow3-animation/dist/`). This avoids circular dependency issues and keeps things simple. The CLI validates that the build exists and suggests running `pnpm build:animation` if it doesn't.

## Error Handling

- Missing .wow3a file → clear error message with usage example
- Invalid .wow3a (not a ZIP or missing project.json) → descriptive error
- FFmpeg not found → error with install instructions
- wow3-animation not built → error suggesting `pnpm build:animation`
- Puppeteer launch failure → error with troubleshooting hints
- Recording failure → cleanup temp files, report error
- FFmpeg merge failure → keep video-only file, report audio error

## Constraints and Limitations

- Recording happens in real-time: a 60-second presentation takes ~60 seconds to record
- Requires a system with Chromium support (no lightweight containers without headless deps)
- FFmpeg must be pre-installed
- wow3-animation must be pre-built before rendering
