# Auto Play Feature Design

## Overview

Add a per-slide "auto play" feature that automatically advances to the next slide after a configurable duration. A 2px progress bar at the top of the screen shows remaining time during presentation.

## Requirements

- Per-slide setting: each slide can independently enable/disable auto play with its own duration
- Timer is total slide time (starts immediately when slide appears, including animation time)
- Manual advance (click/arrow) is still allowed and cancels the timer
- Progress bar: 2px height, top of screen, fills left-to-right over the duration
- Reuses the existing `wow3:nextSlide` custom event mechanism for slide advancement

## Data Model Changes (Slide.js)

New properties:
- `autoPlay` — boolean, default `false`
- `autoPlayDuration` — number (seconds), default `5`

Serialized in `toJSON()` and restored in `fromJSON()`.

## UI Changes (Right Sidebar - Slide Tab)

New "Auto Play" section in the slide settings panel:
- Checkbox to toggle auto play on/off
- Number input for duration in seconds (1–300), enabled only when checkbox is checked

## Playback Changes (PlaybackController.js)

In `showSlide()`:
1. If `slide.autoPlay` is enabled, create a progress bar div at top of presentation view
2. Start a CSS transition (width 0% → 100%) over `autoPlayDuration` seconds
3. Set a `setTimeout` for the same duration
4. When timer fires: dispatch `wow3:nextSlide` event (reuses existing "Next Slide" build out mechanism)
5. On manual advance or slide change: cancel timeout, remove progress bar

In `stop()`:
- Clean up any active auto play timer and progress bar

## CSS

- Progress bar: `position: absolute; top: 0; left: 0; height: 2px; z-index: 9999`
- Background color: accent/brand color
- CSS `transition: width <duration>s linear`
