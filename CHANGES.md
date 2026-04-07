# Changes

## 2026-04-07

### wow3-renderer: CLI tool for rendering presentations to MP4

New app `@wow/wow3-renderer` — a Node.js CLI that renders `.wow3a` presentations
to MP4 video using headless Puppeteer + puppeteer-screen-recorder at 24fps,
with FFmpeg audio mixing.

Usage: `pnpm render -- /path/to/presentation.wow3a`

**New files:**
- `apps/wow3-renderer/package.json` — package with puppeteer, jszip, sirv deps
- `apps/wow3-renderer/src/index.js` — CLI entry point with validation and orchestration
- `apps/wow3-renderer/src/server.js` — local HTTP server (serves dist/ + .wow3a)
- `apps/wow3-renderer/src/recorder.js` — Puppeteer screen recording at 24fps
- `apps/wow3-renderer/src/audio.js` — audio extraction from ZIP + FFmpeg mixing

**Modified files:**
- `apps/wow3-animation/js/app.js` — added player mode (`?mode=player`) with `window.__wow3` API
- `apps/wow3-animation/css/main.css` — added player-mode CSS (hide UI, canvas full-screen)
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
