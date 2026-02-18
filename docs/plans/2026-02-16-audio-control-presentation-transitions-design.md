# Audio Control During Presentation Transitions

**Date:** 2026-02-16
**Status:** Approved

## Overview

This design addresses audio playback behavior during presentation transitions and in editor mode. Currently, audio elements autoplay in the editor (even when they shouldn't) and audio doesn't stop cleanly when entering/exiting presentation mode.

## Problem Statement

1. **Editor Autoplay Issue:** Audio elements with the autoplay flag enabled start playing automatically in editor mode, which is unexpected and disruptive during editing.

2. **Presentation Start:** When entering presentation mode, any audio playing from editor testing continues playing, creating a jarring experience.

3. **Presentation Exit:** Audio stops immediately without fade-out when exiting presentation mode, creating an abrupt transition.

## Solution

Modify audio playback behavior to:
- Disable autoplay in editor mode (manual playback only)
- Stop all audio with smooth fade-out when entering presentation mode
- Stop all audio with smooth fade-out when exiting presentation mode

## Architecture

### Files Modified

1. **`js/models/AudioElement.js`** - Prevent autoplay in editor mode
2. **`js/controllers/PlaybackController.js`** - Add audio stop calls on presentation start/stop

### Dependencies

- Existing `AudioManager` singleton with `stopAll(fadeOut)` method
- Mode detection via `#presentation-view.active` class

## Detailed Changes

### Change 1: Prevent Editor Autoplay

**File:** `js/models/AudioElement.js:42`

**Current:**
```javascript
audio.autoplay = this.properties.autoplay;
```

**Updated:**
```javascript
audio.autoplay = isPresentation && this.properties.autoplay;
```

**Rationale:** Only enable HTML5 autoplay when in presentation mode. The `isPresentation` variable is already detected at line 37. In editor mode, users can manually test audio using controls or the play button.

---

### Change 2: Stop Audio on Presentation Start

**File:** `js/controllers/PlaybackController.js` - `start()` method

**Location:** After line 71 (`this.isPlaying = true;`)

**Add:**
```javascript
// Stop any playing audio from editor with smooth fade-out
if (window.AudioManager) {
  window.AudioManager.stopAll(true);
}
```

**Rationale:** Ensures a clean slate when entering presentation mode. The 500ms fade prevents jarring audio cutoff. First slide's autoplay audio will start after the fade completes.

---

### Change 3: Consistent Fade on Presentation Exit

**File:** `js/controllers/PlaybackController.js:447` - `stop()` method

**Current:**
```javascript
if (window.AudioManager) {
  window.AudioManager.stopAll(false);
}
```

**Updated:**
```javascript
if (window.AudioManager) {
  window.AudioManager.stopAll(true);
}
```

**Rationale:** Symmetric fade behavior on entry and exit for polished transitions. Changes parameter from `false` (immediate) to `true` (500ms fade).

## Behavior & Data Flow

### In Editor Mode

1. User adds audio element to slide
2. Audio renders with `autoplay = false` (regardless of flag)
3. User can manually play/pause using:
   - Native HTML5 controls (if enabled)
   - Canvas overlay play button (if controls disabled)
   - Elements Control Center buttons

### On Presentation Start

1. User clicks play presentation
2. `PlaybackController.start()` is called
3. `AudioManager.stopAll(true)` stops any editor audio with 500ms fade
4. Presentation view shows, first slide loads
5. `showSlide()` calls `AudioManager.onSlideChange()`
6. First slide's autoplay audio starts (if configured)

### During Presentation

- Audio with `continueOnSlides` keeps playing across slides (existing behavior)
- New slide with audio elements stops continuing audio with fade (existing behavior)
- Autoplay audio starts on slides that have it configured

### On Presentation Exit

1. User presses Escape or exits fullscreen
2. `PlaybackController.stop()` is called
3. `AudioManager.stopAll(true)` stops all presentation audio with 500ms fade
4. User returns to editor

## Error Handling

### Graceful Degradation

- All changes check for `window.AudioManager` existence before calling methods
- If AudioManager not loaded, operations fail silently (already handled in current code)
- No breaking changes - existing null checks remain in place

### Edge Cases Handled

1. **No audio playing on presentation start:** `stopAll()` is safe to call with empty registry
2. **Audio already fading:** AudioManager's `_fadingAudios` Set prevents duplicate fade operations
3. **Rapid start/stop:** Fade-out is interrupted, new state takes precedence (existing behavior)
4. **Browser autoplay policy:** HTML5 autoplay restrictions still apply - caught by existing `.catch()` handlers

## Testing Strategy

### Manual Testing Checklist

**Editor Mode:**
1. ✓ Add audio element with autoplay enabled
2. ✓ Verify audio does NOT start playing automatically
3. ✓ Verify play button/controls work manually
4. ✓ Play audio manually, then start presentation
5. ✓ Verify editor audio fades out smoothly before presentation starts

**Presentation Mode:**
6. ✓ Start presentation with no audio playing - verify no errors
7. ✓ Start presentation, verify first slide autoplay works
8. ✓ Navigate between slides with continuing audio enabled
9. ✓ Exit presentation with audio playing - verify smooth fade-out
10. ✓ Exit presentation with no audio playing - verify no errors

**Edge Cases:**
11. ✓ Rapidly start/stop presentation - verify no audio glitches
12. ✓ Multiple audio elements with autoplay on same slide

### Success Criteria

- Audio never autoplays in editor mode
- Smooth 500ms fade when entering/exiting presentation
- No console errors or warnings
- Existing continue-on-slides functionality unchanged

## Implementation Notes

- Total changes: 3 lines modified across 2 files
- No new dependencies or APIs required
- Leverages existing AudioManager fade infrastructure
- Backward compatible - no changes to data models or serialization

## Future Considerations

- Could add user preference for fade duration (currently hardcoded to 500ms)
- Could add visual indicator during audio fade transitions
- Could track editor vs presentation audio separately (currently not needed)
