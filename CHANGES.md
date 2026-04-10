# Changes

## 2026-04-10

### wow3-animation: Karaoke Player display modes

Added three selectable display modes to the Karaoke Player via a Strategy Pattern:
- **Karaoke** (default): 3-line display (prev/current/next) with fade transitions between lines
- **Subtitle**: single-line cinematic display with fade in/out and cross-fade between cues
- **Block**: multi-line display with configurable visible lines and highlighted current line

KaraokePanel now includes a display mode dropdown with mode-specific configuration sections.
New properties: `displayMode`, `subtitle.position`, `subtitle.fadeDuration`, `block.visibleLines`, `block.highlightBg`.
Full backward compatibility: existing projects default to karaoke mode.

**New files:**
- `apps/wow3-animation/js/strategies/DisplayStrategy.js` — base class with shared font/color/highlight logic
- `apps/wow3-animation/js/strategies/KaraokeStrategy.js` — 3-line karaoke mode
- `apps/wow3-animation/js/strategies/SubtitleStrategy.js` — single-line cinematic subtitle mode
- `apps/wow3-animation/js/strategies/BlockStrategy.js` — multi-line block mode
- `apps/wow3-animation/js/strategies/index.js` — strategy registry and factory

**Modified files:**
- `apps/wow3-animation/js/models/KaraokeElement.js` — delegates rendering to strategy
- `apps/wow3-animation/js/models/VisualClip.js` — added display mode defaults
- `apps/wow3-animation/js/panels/KaraokePanel.js` — mode dropdown and conditional sections
- `apps/wow3-animation/css/main.css` — styles for new display modes

## 2026-04-07

### wow3-animation: import external asset URLs into the project media folder

External asset URLs are now fetched once, stored in MediaDB inside a folder
owned by the current project, and rewritten to `media_...` IDs. This makes the
editor and player use local MediaDB-backed assets instead of repeatedly loading
remote URLs and redirects on every canvas re-render.

**Modified files:**
- `apps/wow3-animation/js/utils/externalMedia.js` — new helper that imports
  external URLs into the project's MediaDB folder and rewrites project refs.
- `apps/wow3-animation/js/app.js` — normalize external URLs on editor startup,
  JSON apply, project import, and player `loadFile()`.
- `apps/wow3-animation/js/controllers/ClipController.js`,
  `apps/wow3-animation/js/views/PropertiesPanel.js`,
  `apps/wow3-animation/js/panels/KaraokePanel.js`,
  `packages/wow-core/src/panels/TextPanel.js` — convert user-entered external
  URLs to project-local `mediaId` values at edit time.
- `apps/wow3-animation/js/models/Project.js`,
  `apps/wow3-animation/js/utils/projectStorage.js`,
  `packages/wow-core/classic/media_db.js` — persist the project media folder,
  strip it from ZIP export, restore it on ZIP import, and allow explicit
  non-deduped project copies when importing remote assets.

---

### wow3-renderer: preload assets as blob URLs to avoid double-fetching

`preloadAssets()` now downloads each asset once and converts it to a blob URL
(`URL.createObjectURL`), then patches the clip property (url/mediaId/src) with
the blob URL. All downstream code (ImageElement, VideoElement,
AudioPlaybackManager, fetchMediaArrayBuffer) resolves the blob URL instantly
from memory — no second network request, regardless of HTTP cache headers.

**Modified files:**
- `apps/wow3-animation/js/app.js` — replaced `_resolveMediaUrl`, `_preloadMedia`,
  `_preloadFetch` with a single `_fetchAsBlobUrl` helper; `preloadAssets()` patches
  clip properties with blob URLs after download.

---

### wow3-renderer: 60fps, fix fade-in effects, strict asset preloading

- Recording bumped from 24fps to 60fps.
- Fixed missing in-animations: `play()` now clears the canvas before seeking
  to time 0 so elements are freshly created with their WAAPI animations when
  recording is active (previously, `loadFile()` created them early and the
  animations had already completed).
- `preloadAssets()` now logs each asset name with OK/FAIL status and returns
  the list of failed assets. The recorder aborts with an error listing all
  failed assets instead of rendering with missing resources.

**Modified files:**
- `apps/wow3-animation/js/app.js` — `preloadAssets()` tracks names, logs per-asset
  status, returns failures; `play()` calls `canvasRenderer.clear()` before seek.
- `apps/wow3-renderer/src/recorder.js` — fps set to 60; preload result checked,
  render aborted on failures.

---

### wow3-renderer: preload all media assets before playback

Added `preloadAssets()` to the `__wow3` player API — pre-fetches all images,
videos, audio, and SRT files (both external URLs and MediaDB entries) before
playback starts, so the headless recorder never renders blank/missing frames.

**Modified files:**
- `apps/wow3-animation/js/app.js` — added `_resolveMediaUrl()`, `_preloadMedia()`,
  `_preloadFetch()` helpers and `preloadAssets()` method on `window.__wow3`.
- `apps/wow3-renderer/src/recorder.js` — calls `preloadAssets()` after `loadFile()`
  and before starting recording.

---

### wow3-renderer: per-second rendering progress log

The recorder now logs `Rendering: N/Ts` for each second of playback, enabling
external services to parse stdout and show a progress indicator.

**Modified files:**
- `apps/wow3-renderer/src/recorder.js` — poll `currentTime` every 250ms during
  playback, log each new second via `onProgress` callback.

---

### wow3-renderer: support external URL audio assets

Audio clips can now reference external URLs (e.g. `https://easyshare.os3.services/d/...`)
instead of only ZIP-embedded files. The renderer downloads them to a temp file before
passing to FFmpeg.

**Modified files:**
- `apps/wow3-renderer/src/audio.js` — added URL detection, download, and extension
  extraction helpers; `extractAudio()` now fetches remote audio when the asset path
  is an HTTP(S) URL.

---

### wow3-animation: add media source input to audio clip properties

Added `ImageSelector` (URL / media ID / file upload) to the audio clip properties
panel, matching the pattern used by image and video elements.

**Modified files:**
- `apps/wow3-animation/js/views/PropertiesPanel.js` — added `<div id="audio-media-selector">` container in the audio section HTML and instantiated `ImageSelector` in `_bindAudioInputs()` with proper handling for File uploads, media IDs, and URLs.

---

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
