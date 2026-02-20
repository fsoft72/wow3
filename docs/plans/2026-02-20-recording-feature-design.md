# Record Presentation Feature — Design

## Overview

Add the ability to record a presentation as a WebM video, capturing tab content, optional camera (circle PiP), and optional microphone audio. The recording is composited in real-time onto a hidden canvas and saved in chunks to IndexedDB for crash resilience.

## Architecture: Canvas Compositing

- Capture the tab via `getDisplayMedia()`
- Capture camera via `getUserMedia()` (if enabled)
- Capture microphone via `getUserMedia()` (if enabled)
- Draw tab frame + camera circle onto a hidden `<canvas>` every frame using `requestAnimationFrame`
- Record the canvas stream (+ mixed audio) via `MediaRecorder` into WebM
- Save chunks to IndexedDB every 10 seconds

This produces a single WebM file with camera already baked in.

## Recording Flow

1. User clicks **Record** button in toolbar (next to Play buttons)
2. **Settings dialog** opens with device/resolution options
3. User clicks **Start Recording**
4. Browser prompts for tab capture permission
5. Compositing canvas starts, MediaRecorder begins
6. Presentation auto-enters fullscreen playback
7. Record button becomes a red **STOP** button
8. User presents normally — navigating slides, animations play
9. User clicks **STOP**
10. Playback stops, fullscreen exits
11. Modal blocks UI: "Building video..."
12. Chunks assembled from IndexedDB into final Blob
13. Browser triggers `.webm` download
14. IndexedDB chunks cleaned up, modal dismissed

## Settings Dialog

- **Resolution**: 720p (1280x720), 1080p (1920x1080), 1440p (2560x1440)
- **Cursor**: checkbox toggle (show/hide cursor in recording)
- **Camera**: dropdown from `enumerateDevices()`, first option "OFF", live preview when selected
- **Microphone**: dropdown from `enumerateDevices()`, first option "OFF", live level meter via `AnalyserNode`

## Camera PiP Overlay

- ~150px diameter circle, composited onto canvas
- Default position: bottom-right with ~20px margin
- Draggable by user during presentation (mouse events on fullscreen element)
- Clipped to circle via canvas `arc()` clipping
- Thin white border / subtle shadow for visibility

## IndexedDB Chunk Storage

New database: `wow3_recordings`

Store: `recording_chunks`
- `id`: auto-increment
- `sessionId`: string (groups chunks per recording session)
- `chunkIndex`: number
- `blob`: Blob
- `timestamp`: number

Chunks saved every 10 seconds via `MediaRecorder.ondataavailable`. On completion, all chunks for the session are read, concatenated into a single Blob, and downloaded. Chunks are then deleted.

## Files

| File | Purpose |
|------|---------|
| `js/controllers/RecordingController.js` | Core controller — MediaRecorder, compositing loop, chunk storage, start/stop lifecycle |
| `js/utils/recording_db.js` | IndexedDB `wow3_recordings` store for chunk blobs |
| `js/components/RecordingDialog.js` | Settings dialog — device enumeration, previews, level meter |
| `index.html` | Record button in toolbar-right, hidden compositing canvas |
| `css/recording.css` | Record button states, PiP circle, processing modal |
| `js/controllers/EditorController.js` | Wire up Record button, integrate with PlaybackController |
| `js/controllers/PlaybackController.js` | Expose start/stop hooks for RecordingController coordination |

## Dependencies

None. All native browser APIs:
- `getDisplayMedia()` — tab capture
- `getUserMedia()` — camera + mic
- `MediaRecorder` — WebM encoding
- Canvas 2D — compositing
- `AudioContext` + `AnalyserNode` — mic level meter
- IndexedDB — chunk storage
