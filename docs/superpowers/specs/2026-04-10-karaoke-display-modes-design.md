# Karaoke Player - Display Modes

**Date:** 2026-04-10
**Status:** Draft
**Scope:** wow3-animation Karaoke Player SRT display modes

## Overview

Add multiple display modes to the Karaoke Player, selectable via a dropdown in the KaraokePanel. Each mode combines a specific layout, transition effects, and styling to serve different presentation contexts: karaoke, cinema subtitles, and highlighted text blocks.

The implementation uses a **Strategy Pattern**: `KaraokeElement` delegates rendering to a `DisplayStrategy` subclass. Switching mode swaps the strategy instance, making it easy to add new modes in the future.

## Architecture

### DisplayStrategy (base class)

Abstract base class with the shared interface:

```
DisplayStrategy
  render(cues, activeIdx, container, props)  — build/update DOM for the current time
  destroy()                                   — tear down DOM and clean up
  applyStyles(el, fontProps, colorProps)       — shared font/color/shadow/stroke application
```

`applyStyles()` lives in the base class to avoid duplicating font, shadow, and stroke logic across strategies.

### KaraokeElement (coordinator)

Holds a `this._strategy` instance. Core change to `updateAtTime()`:

```javascript
updateAtTime(timeMs, cues) {
  const idx = findActiveCue(cues, timeMs);
  this._strategy.render(cues, idx, this._container, this.properties);
}
```

When `displayMode` changes:
1. `this._strategy.destroy()`
2. Instantiate new strategy from factory
3. `this._strategy.render()` with current state

### Strategy Implementations

Three strategies, each managing its own DOM inside the element's container.

#### 1. KaraokeStrategy (default)

Evolution of current behavior. Default mode for backward compatibility.

- **Layout:** 3 lines — previous (dimmed), current (highlighted), next (dimmed)
- **Transitions:** Fade on line change (~300ms, CSS transition on opacity)
- **Properties used:** All existing properties including gradient animation, colorCurrent, colorPrev, shadow, stroke
- **DOM:** Same structure as current (3 `div.karaoke-line` elements)

This is effectively the existing rendering logic extracted into a strategy class, with the addition of fade transitions between line changes.

#### 2. SubtitleStrategy

Single-line cinematic subtitle display.

- **Layout:** Single centered line
- **Transitions:**
  - Cue appears: fade in
  - Cue ends (gap before next): fade out
  - Cue-to-cue (no gap): cross-fade — two overlapping `div` elements, old fades out while new fades in simultaneously
  - No active cue: container empty/transparent
- **Properties used:** Font, colorCurrent (text color), shadow, stroke
- **DOM:** Two alternating `div.subtitle-line` elements (A/B swap for cross-fade)

**Mode-specific properties:**

| Property | Type | Range | Default | Description |
|----------|------|-------|---------|-------------|
| `subtitle.position` | string | `'top'` \| `'center'` \| `'bottom'` | `'bottom'` | Vertical position |
| `subtitle.fadeDuration` | number | 100–500 ms | 200 | Fade in/out duration |

#### 3. BlockStrategy

Multi-line display with highlighted current line.

- **Layout:** N lines visible simultaneously, showing consecutive cues
- **Highlight:** Active line uses `colorCurrent`; inactive lines use `colorPrev`
- **Scrolling:** When active line exits the visible block, the block scrolls to keep it centered. Scroll transition with fade (~300ms)
- **Edge case:** If total cues < visible lines, all cues shown without scroll
- **Properties used:** Font, colorCurrent, colorPrev, shadow, stroke
- **DOM:** Container `div.block-container` with N `div.block-line` children

**Mode-specific properties:**

| Property | Type | Range | Default | Description |
|----------|------|-------|---------|-------------|
| `block.visibleLines` | number | 3–15 | 5 | Number of visible lines |
| `block.highlightBg` | color | CSS color | `'transparent'` | Background color on active line |

## Data Model

### New properties on `element.properties`

```javascript
{
  // Mode selector
  displayMode: 'karaoke',    // 'karaoke' | 'subtitle' | 'block'

  // Subtitle mode
  subtitle: {
    position: 'bottom',      // 'top' | 'center' | 'bottom'
    fadeDuration: 200         // ms, 100-500
  },

  // Block mode
  block: {
    visibleLines: 5,          // 3-15
    highlightBg: 'transparent' // CSS color
  }
}
```

Default `displayMode` is `'karaoke'` for backward compatibility with existing projects.

## KaraokePanel Configuration

### Always visible (all modes)

- **Modalità** dropdown: Karaoke / Sottotitolo / Blocco
- SRT Source selector (existing)
- Font: family, size, weight, style, alignment (existing)
- Text color / Highlight color (existing)
- Shadow and Stroke (existing)

### Visible only in Karaoke mode

- Animated gradient + speed + animation type (existing)

### Visible only in Subtitle mode

- Vertical position: top / center / bottom (radio or select)
- Fade duration: slider 100–500ms

### Visible only in Block mode

- Visible lines: slider 3–15
- Highlight background: color picker

The panel shows/hides mode-specific sections dynamically based on the selected mode. Mode change from the dropdown is immediate: strategy swap + re-render with current cues.

## Files to Create/Modify

All paths relative to `apps/wow3-animation/`.

### New files

- `js/strategies/DisplayStrategy.js` — base class
- `js/strategies/KaraokeStrategy.js` — 3-line karaoke mode
- `js/strategies/SubtitleStrategy.js` — single-line subtitle mode
- `js/strategies/BlockStrategy.js` — multi-line block mode
- `js/strategies/index.js` — strategy registry/factory (maps mode name → class)

### Modified files

- `js/models/KaraokeElement.js` — delegate to strategy, handle mode switching
- `js/models/VisualClip.js` — add default values for new properties
- `js/panels/KaraokePanel.js` — add mode dropdown, conditional sections
- `css/main.css` — styles for subtitle-line, block-container, block-line, transitions

## Backward Compatibility

- `displayMode` defaults to `'karaoke'`
- Existing projects without `displayMode` property render identically to current behavior
- No changes to SRT parsing, cue lookup, or caching
- No changes to CanvasRenderer pipeline — it still calls `element.updateAtTime()`
