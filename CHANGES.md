# Changes

## 2026-04-07

### wow3-renderer: Implement CLI orchestration

Replaced the placeholder `index.js` with the full CLI entry point that ties
together server, recorder, and audio modules. The flow: validate input file and
prerequisites (FFmpeg, wow3-animation build), start local HTTP server, record
the presentation with Puppeteer, extract and mix audio with FFmpeg, clean up.

**Modified files:**
- `apps/wow3-renderer/src/index.js` — full CLI orchestration with validation,
  server startup, recording, audio mixing, and cleanup

### wow3-renderer: Add audio extraction and FFmpeg mixing

Created the audio module for extracting audio clips from `.wow3a` ZIP files and
mixing them with recorded video using FFmpeg.

**New files:**
- `apps/wow3-renderer/src/audio.js` — `extractAudio()` reads audio tracks from
  `.wow3a`, extracts assets to temp files; `mergeAudioVideo()` builds an FFmpeg
  `filter_complex` pipeline with trim, volume, fade in/out, and delay per clip;
  `copyVideoOnly()` passes through when no audio is present

### wow3-renderer: Add Puppeteer screen recorder

Created the Puppeteer-based recorder module that opens a headless browser,
navigates to the wow3-animation player mode, loads a `.wow3a` presentation,
and records playback at 24fps using `puppeteer-screen-recorder`.

**New files:**
- `apps/wow3-renderer/src/recorder.js` — `record()` function with browser
  lifecycle, viewport setup, player API interaction, and screen recording

### wow3-renderer: Add local HTTP server for dist and .wow3a

Added `startServer()` function that spins up a local HTTP server on a random
port. It serves the pre-built wow3-animation app from `apps/wow3-animation/dist/`
as static files via `sirv`, and exposes the input `.wow3a` file at `/input.wow3a`
so the headless browser can fetch it.

**New files:**
- `apps/wow3-renderer/src/server.js` — HTTP server with sirv static serving and
  .wow3a endpoint

### wow3-animation: Add player mode for headless rendering

Added a "player mode" to the animation editor, triggered by `?mode=player` URL
parameter. In player mode all editor UI is hidden and only the presentation
canvas is shown at native resolution. A control API is exposed on `window.__wow3`
for external automation (e.g. Puppeteer-driven video capture).

**Modified files:**
- `apps/wow3-animation/css/main.css` — added player-mode CSS rules that hide
  editor chrome and display the canvas full-viewport
- `apps/wow3-animation/js/app.js` — added `isPlayerMode` static getter,
  conditional init flow, and `_exposePlayerAPI()` method

### wow3-renderer: Scaffold package

Created the `wow3-renderer` app in the monorepo. This CLI tool will render
wow3-animation presentations to MP4.

**New files:**
- `apps/wow3-renderer/package.json` — package config with puppeteer, jszip, sirv, puppeteer-screen-recorder dependencies
- `apps/wow3-renderer/src/index.js` — placeholder CLI entry point

**Modified files:**
- `package.json` — added `render` script to root workspace

## 2026-04-06

### wow3-animation: Full Timeline Editor implementation

Implemented the interactive Timeline Editor with all planned features:

**New files:**
- `js/views/CanvasRenderer.js` — renders visual clips onto `#slide-canvas` at current playhead time
- `js/controllers/ClipController.js` — bridges wow-core interaction handlers (drag/resize/rotate/crop/marquee) with clip model
- `js/views/PropertiesPanel.js` — right sidebar with timing controls, position inputs, and wow-core type-specific panels
- `js/views/WaveformRenderer.js` — decodes audio via Web Audio API and draws waveforms in timeline clips
- `js/controllers/HistoryManager.js` — undo/redo via JSON project snapshots

**Enhanced files:**
- `js/app.js` — full rewrite: initializes all new controllers/views, toolbar buttons (click + drag), keyboard shortcuts, window.app global
- `js/controllers/TimelineController.js` — added: addClipToTrack, removeClip, track CRUD, zoom in/out
- `js/views/TimelineView.js` — added: clip drag/resize, ruler scrub, auto-scroll, track management (rename/delete/reorder), drop zones, waveform integration
- `js/models/VisualClip.js` — added `createDefault()` factory with sensible defaults per element type
- `index.html` — zoom buttons, split add-track into visual/audio
- `css/main.css` — canvas selection/handles, properties panel, alignment guides
- `css/timeline.css` — track management, clip drag, waveform, drop indicator styles

## 2026-04-06

### Update ES module imports to @wow/core

Updated 13 files under `apps/wow3/js/` to import shared modules from the
`@wow/core` package instead of relative paths. The following module paths were
replaced:

- `utils/dom.js` -> `@wow/core/utils/dom.js`
- `utils/events.js` -> `@wow/core/utils/events.js`
- `utils/constants.js` -> `@wow/core/utils/constants.js`
- `utils/positioning.js` -> `@wow/core/utils/positioning.js`
- `utils/toasts.js` -> `@wow/core/utils/toasts.js`
- `utils/settings.js` -> `@wow/core/utils/settings.js`
- `animations/definitions.js` -> `@wow/core/animations/definitions.js`
- `managers/AudioManager.js` -> `@wow/core/managers/AudioManager.js`

Files updated:
- `controllers/ElementController.js`
- `controllers/RecordingController.js`
- `controllers/SettingsController.js`
- `controllers/AnimationEditorController.js`
- `controllers/EditorController.js`
- `controllers/PlaybackController.js`
- `controllers/RemoteController.js`
- `controllers/SlideController.js`
- `views/RightSidebar.js`
- `animations/AnimationManager.js`
- `animations/migration.js`
- `utils/storage.js`
- `app.js`
