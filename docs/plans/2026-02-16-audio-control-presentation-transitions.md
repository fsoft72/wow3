# Audio Control Presentation Transitions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent audio autoplay in editor mode and ensure smooth fade-out transitions when entering/exiting presentation mode.

**Architecture:** Modify audio element rendering to conditionally enable autoplay based on mode detection, and add AudioManager.stopAll(true) calls at presentation lifecycle boundaries for clean transitions.

**Tech Stack:** Vanilla JavaScript, existing AudioManager singleton, PlaybackController

---

## Task 1: Prevent Editor Autoplay

**Files:**
- Modify: `js/models/AudioElement.js:42`

**Step 1: Locate and understand current autoplay behavior**

Read: `js/models/AudioElement.js` lines 32-43

Current code unconditionally sets `audio.autoplay = this.properties.autoplay` which causes autoplay in both editor and presentation modes.

The `isPresentation` variable is already detected at line 37:
```javascript
const isPresentation = document.getElementById('presentation-view')?.classList.contains('active');
```

**Step 2: Modify autoplay to be mode-aware**

In `js/models/AudioElement.js` at line 42, change:

```javascript
audio.autoplay = this.properties.autoplay;
```

To:

```javascript
audio.autoplay = isPresentation && this.properties.autoplay;
```

**Step 3: Manual test - Editor mode**

1. Open application in browser
2. Create a new slide with audio element
3. In Audio Panel, enable "Autoplay" checkbox
4. Upload an audio file
5. Expected: Audio does NOT start playing automatically
6. Click play button manually
7. Expected: Audio plays successfully

**Step 4: Manual test - Presentation mode**

1. With autoplay-enabled audio on slide
2. Click "Play Presentation" button
3. Expected: Audio starts playing automatically when slide loads
4. Press Escape to exit
5. Return to editor
6. Expected: Audio does NOT autoplay in editor

**Step 5: Commit**

```bash
git add js/models/AudioElement.js
git commit -m "fix: prevent audio autoplay in editor mode

Only enable HTML5 autoplay when in presentation mode. In editor mode,
users can manually control audio playback using controls or play button.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Stop Audio on Presentation Start

**Files:**
- Modify: `js/controllers/PlaybackController.js:68-105` (start method)

**Step 1: Locate insertion point**

Read: `js/controllers/PlaybackController.js` lines 68-105

Find the `start(fromIndex = 0)` method. We need to add audio stopping after setting `this.isPlaying = true` (line 71) and before showing the presentation view (line 75).

**Step 2: Add AudioManager.stopAll call**

After line 71 (`this.isPlaying = true;`), add:

```javascript
    // Stop any playing audio from editor with smooth fade-out
    if (window.AudioManager) {
      window.AudioManager.stopAll(true);
    }
```

The complete section (lines 68-77) should look like:

```javascript
  start(fromIndex = 0) {
    if (!this.presentationView) return;

    this.isPlaying = true;

    // Stop any playing audio from editor with smooth fade-out
    if (window.AudioManager) {
      window.AudioManager.stopAll(true);
    }

    // Show presentation view
    this.presentationView.style.display = 'flex';
    this.presentationView.classList.add('active');
```

**Step 3: Manual test - Audio fade on presentation start**

1. In editor mode, add audio element (without autoplay)
2. Manually start playing the audio using play button
3. While audio is playing, click "Play Presentation"
4. Expected:
   - Audio fades out smoothly over ~500ms
   - Presentation starts after fade begins
   - No audio continues playing from editor

**Step 4: Manual test - No audio playing**

1. In editor mode, ensure no audio is playing
2. Click "Play Presentation"
3. Expected:
   - Presentation starts normally
   - No errors in console
   - stopAll() call handles empty registry gracefully

**Step 5: Manual test - Presentation autoplay still works**

1. Create slide with audio that has autoplay enabled
2. Start presentation
3. Expected:
   - Any editor audio fades out
   - After ~100ms delay, presentation slide's autoplay audio starts
   - Autoplay audio plays successfully

**Step 6: Commit**

```bash
git add js/controllers/PlaybackController.js
git commit -m "feat: stop audio with fade when starting presentation

Stop all playing audio with 500ms fade-out when entering presentation
mode. Ensures clean transition from editor to presentation without
jarring audio cutoff.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Consistent Fade on Presentation Exit

**Files:**
- Modify: `js/controllers/PlaybackController.js:447`

**Step 1: Locate current stopAll call**

Read: `js/controllers/PlaybackController.js` lines 443-491

Find the `stop()` method. Currently at line 447, it calls `AudioManager.stopAll(false)` which stops audio immediately without fade.

**Step 2: Change to fade-out**

At line 448, change the parameter from `false` to `true`:

Before:
```javascript
    // Stop all audio immediately
    if (window.AudioManager) {
      window.AudioManager.stopAll(false);
    }
```

After:
```javascript
    // Stop all audio with smooth fade-out
    if (window.AudioManager) {
      window.AudioManager.stopAll(true);
    }
```

Also update the comment from "immediately" to "with smooth fade-out" for accuracy.

**Step 3: Manual test - Audio fade on presentation exit**

1. Start presentation
2. Navigate to slide with autoplay audio (audio should be playing)
3. Press Escape to exit presentation
4. Expected:
   - Audio fades out smoothly over ~500ms
   - Presentation exits and returns to editor
   - Audio completely stops after fade completes

**Step 4: Manual test - Continuing audio fade**

1. Add audio with "Continue on Slides" enabled
2. Start presentation and manually play the audio
3. Navigate to next slide (audio should continue)
4. Press Escape to exit
5. Expected:
   - Continuing audio fades out smoothly
   - No abrupt audio cutoff

**Step 5: Manual test - No audio playing**

1. Start presentation on slide with no audio
2. Press Escape to exit
3. Expected:
   - Presentation exits normally
   - No errors in console

**Step 6: Commit**

```bash
git add js/controllers/PlaybackController.js
git commit -m "feat: fade out audio when exiting presentation

Change from immediate stop to 500ms fade-out for symmetric, polished
transitions. Consistent with presentation start behavior.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Comprehensive Testing

**Files:**
- No files modified, testing only

**Step 1: Test editor autoplay prevention**

1. Add multiple audio elements to different slides
2. Enable autoplay on all of them
3. Navigate between slides in editor mode
4. Expected: No audio autoplays when switching slides in editor

**Step 2: Test rapid presentation start/stop**

1. Start playing audio in editor
2. Quickly start presentation (Shift+F5)
3. Immediately press Escape
4. Start presentation again
5. Expected:
   - No audio glitches
   - Fades are interrupted cleanly
   - New state takes precedence

**Step 3: Test multiple autoplay audio on same slide**

1. Add 3 audio elements to one slide
2. Enable autoplay on all 3
3. Start presentation
4. Expected:
   - All 3 audio elements attempt to play
   - Browser autoplay policy may block some
   - No JavaScript errors

**Step 4: Test cross-slide continuing audio**

1. Add audio with "Continue on Slides" enabled to slide 1
2. Add regular audio to slide 3
3. Start presentation, play continuing audio
4. Navigate to slide 2 (no audio)
5. Expected: Audio continues playing
6. Navigate to slide 3 (has audio)
7. Expected: Continuing audio fades out
8. Press Escape
9. Expected: Slide 3 audio fades out smoothly

**Step 5: Test edge cases**

Test cases:
- Audio with controls disabled (use overlay play button in editor)
- Audio from MediaDB vs external URL
- Audio with loop enabled
- Starting presentation from middle slide (Shift+click play)
- Exiting presentation via fullscreen exit vs Escape key

Expected: All scenarios work without errors, audio behavior is consistent

**Step 6: Verify console logs**

Check browser console throughout all tests.

Expected:
- No errors
- No warnings (except possible "crypto.subtle not available" on HTTP)
- AudioManager registration/unregistration logs (if present) show correct behavior

---

## Task 5: Update CHANGES.md

**Files:**
- Modify: `CHANGES.md` (prepend to top)

**Step 1: Add changelog entry**

Add the following entry at the top of `CHANGES.md` (after the current 2026-02-16 date header):

```markdown
### Fix: Audio Control During Presentation Transitions

Fixed audio playback behavior during presentation transitions and in editor mode.

**Issues Fixed:**

1. **Editor Autoplay Prevention**
   - Audio elements no longer autoplay in editor mode
   - Users must manually play audio in editor using controls or play button
   - Autoplay only active in presentation mode

2. **Smooth Presentation Start**
   - All playing audio now fades out (500ms) when starting presentation
   - Clean transition from editor to presentation mode
   - Prevents jarring audio overlap

3. **Smooth Presentation Exit**
   - Audio now fades out (500ms) when exiting presentation (previously immediate stop)
   - Symmetric, polished transition behavior
   - Consistent with slide transition fades

**Technical Changes:**
- Modified `AudioElement.js`: Conditional autoplay based on presentation mode
- Modified `PlaybackController.js`: Added stopAll(true) on presentation start
- Modified `PlaybackController.js`: Changed stopAll(false) to stopAll(true) on presentation exit

**User-Facing Changes:**
- Editor is quieter - no unexpected audio playback while editing
- Smoother, more professional presentation transitions
- Better control over audio testing in editor

**Updated Files:**
- `js/models/AudioElement.js`
- `js/controllers/PlaybackController.js`

---

```

**Step 2: Commit**

```bash
git add CHANGES.md
git commit -m "docs: update CHANGES.md with audio transition fixes

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Implementation Complete

**Total Changes:**
- 3 lines modified across 2 JavaScript files
- 1 documentation update

**Testing Approach:**
- Manual testing (no unit tests needed for UI integration changes)
- Comprehensive edge case coverage
- Cross-browser verification recommended

**Rollback Plan:**
If issues arise, revert commits in reverse order (Tasks 5, 3, 2, 1).
