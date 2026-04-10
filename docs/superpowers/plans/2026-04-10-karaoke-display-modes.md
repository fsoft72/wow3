# Karaoke Display Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three selectable display modes (Karaoke, Subtitle, Block) to the Karaoke Player using a Strategy Pattern.

**Architecture:** `KaraokeElement` delegates rendering to a `DisplayStrategy` subclass. A strategy registry maps mode names to classes. The `KaraokePanel` dropdown switches modes by swapping the strategy instance. Each strategy manages its own DOM inside the element's container.

**Tech Stack:** Vanilla JS (ES modules), DOM manipulation, CSS transitions, existing PanelUtils (global `window.PanelUtils`)

**Spec:** `docs/superpowers/specs/2026-04-10-karaoke-display-modes-design.md`

---

## File Structure

All paths relative to `apps/wow3-animation/`.

### New files
| File | Responsibility |
|------|---------------|
| `js/strategies/DisplayStrategy.js` | Base class: shared `applyStyles()`, abstract `render()`/`destroy()` interface |
| `js/strategies/KaraokeStrategy.js` | 3-line karaoke mode with fade transitions |
| `js/strategies/SubtitleStrategy.js` | Single-line cinematic subtitle with fade in/out/cross-fade |
| `js/strategies/BlockStrategy.js` | Multi-line block with highlighted current line and scroll |
| `js/strategies/index.js` | Strategy registry: maps mode names → classes, factory function |

### Modified files
| File | Changes |
|------|---------|
| `js/models/KaraokeElement.js` | Delegate rendering to strategy, handle mode switching |
| `js/models/VisualClip.js` | Add defaults for `displayMode`, `subtitle.*`, `block.*` |
| `js/panels/KaraokePanel.js` | Add mode dropdown, conditional sections for mode-specific controls |
| `css/main.css` | Add styles for subtitle-line, block-container, block-line, fade transitions |

---

## Task 1: DisplayStrategy base class

**Files:**
- Create: `js/strategies/DisplayStrategy.js`

- [ ] **Step 1: Create the base class**

```javascript
/**
 * Abstract base class for karaoke display strategies.
 * Subclasses implement render() and destroy() to manage DOM.
 */
export class DisplayStrategy {
  constructor() {
    /** @type {HTMLElement|null} */
    this._container = null;
  }

  /**
   * Render/update the display at the current time.
   * @param {Array<{index: number, startMs: number, endMs: number, text: string}>} cues
   * @param {number} activeIdx - Index of active cue, or -1
   * @param {number} relativeMs - Time relative to clip start
   * @param {HTMLElement} container - Parent element to render into
   * @param {Object} props - element.properties
   */
  render(cues, activeIdx, relativeMs, container, props) {
    throw new Error('DisplayStrategy.render() must be overridden');
  }

  /**
   * Tear down DOM and clean up event listeners/animations.
   */
  destroy() {
    if (this._container) {
      this._container.innerHTML = '';
    }
  }

  /**
   * Apply shared font, shadow, and stroke styles to an element.
   * @param {HTMLElement} el
   * @param {Object} props - element.properties (contains font, shadow, stroke)
   */
  applyFontStyles(el, props) {
    const font = props.font || {};
    el.style.fontFamily = `${font.family || 'Roboto'}, sans-serif`;
    el.style.fontSize = (font.size || 36) + 'px';
    el.style.fontWeight = font.weight || 'bold';
    el.style.fontStyle = font.style || 'normal';
    el.style.textAlign = font.alignment || 'center';
    el.style.lineHeight = '1.4';

    const sh = font.shadow;
    el.style.textShadow = sh?.enabled
      ? `${sh.offsetX ?? 2}px ${sh.offsetY ?? 2}px ${sh.blur ?? 4}px ${sh.color || '#000000'}`
      : 'none';

    const st = font.stroke;
    el.style.webkitTextStroke = st?.enabled
      ? `${st.width ?? 1}px ${st.color || '#000000'}`
      : '';
  }

  /**
   * Apply highlight color — supports solid colors, CSS gradients, and gradient animation.
   * @param {HTMLElement} el
   * @param {string} color - CSS color or gradient string
   * @param {number} animSpeed - Gradient animation speed (0 = disabled)
   * @param {string} animType - 'pingpong' or 'cycle'
   */
  applyHighlightColor(el, color, animSpeed = 0, animType = 'pingpong') {
    if (color.includes('gradient')) {
      el.style.background = color;
      el.style.webkitBackgroundClip = 'text';
      el.style.webkitTextFillColor = 'transparent';
      el.style.backgroundClip = 'text';
      el.style.color = '';
      if (animSpeed > 0) {
        const duration = Math.max(0.5, 11 - animSpeed);
        const animName = animType === 'cycle' ? 'wow3GradientCycleForward' : 'wow3GradientCycle';
        el.style.backgroundSize = '200% 200%';
        el.style.animation = `${animName} ${duration}s ease infinite`;
      } else {
        el.style.backgroundSize = '';
        el.style.animation = '';
      }
    } else {
      el.style.background = '';
      el.style.webkitBackgroundClip = '';
      el.style.webkitTextFillColor = '';
      el.style.backgroundClip = '';
      el.style.backgroundSize = '';
      el.style.animation = '';
      el.style.color = color;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/wow3-animation/js/strategies/DisplayStrategy.js
git commit -m "feat(karaoke): add DisplayStrategy base class"
```

---

## Task 2: KaraokeStrategy (3-line mode)

**Files:**
- Create: `js/strategies/KaraokeStrategy.js`

- [ ] **Step 1: Create the strategy**

Extract the current `KaraokeElement` rendering logic into a strategy class, adding fade transitions.

```javascript
import { DisplayStrategy } from './DisplayStrategy.js';

/**
 * Classic 3-line karaoke display: previous (dimmed), current (highlighted), next (dimmed).
 * Supports fade transitions on line change.
 */
export class KaraokeStrategy extends DisplayStrategy {
  constructor() {
    super();
    this._prevLine = null;
    this._currentLine = null;
    this._nextLine = null;
    this._lastActiveIdx = -2; // force first render
  }

  /**
   * Build or update 3-line karaoke display.
   * @param {Array} cues
   * @param {number} activeIdx
   * @param {number} relativeMs
   * @param {HTMLElement} container
   * @param {Object} props
   */
  render(cues, activeIdx, relativeMs, container, props) {
    this._container = container;

    // Build DOM on first call
    if (!this._prevLine) {
      this._buildDOM(container);
    }

    // Apply styles every frame (properties may change from panel)
    const colorPrev = props.colorPrev || '#888888';
    const colorCurrent = props.colorCurrent || '#ff9800';
    const animSpeed = props.highlightAnimationSpeed || 0;
    const animType = props.highlightAnimationType || 'pingpong';

    this._prevLine.style.color = colorPrev;
    this._nextLine.style.color = colorPrev;
    this.applyHighlightColor(this._currentLine, colorCurrent, animSpeed, animType);

    for (const line of [this._prevLine, this._currentLine, this._nextLine]) {
      this.applyFontStyles(line, props);
    }

    // Update text content
    if (!cues || cues.length === 0) {
      this._setText('', 'Karaoke', '');
      return;
    }

    // Detect line change for fade transition
    const changed = activeIdx !== this._lastActiveIdx;
    this._lastActiveIdx = activeIdx;

    let prevText = '';
    let currentText = '';
    let nextText = '';

    if (activeIdx >= 0) {
      prevText = activeIdx > 0 ? cues[activeIdx - 1].text : '';
      currentText = cues[activeIdx].text;
      nextText = activeIdx < cues.length - 1 ? cues[activeIdx + 1].text : '';
    } else {
      const nextIdx = cues.findIndex(c => c.startMs > relativeMs);
      if (nextIdx === -1) {
        prevText = cues[cues.length - 1].text;
      } else if (nextIdx === 0) {
        nextText = cues[0].text;
      } else {
        prevText = cues[nextIdx - 1].text;
        nextText = cues[nextIdx].text;
      }
    }

    if (changed) {
      this._fadeTransition(prevText, currentText, nextText);
    } else {
      this._setText(prevText, currentText, nextText);
    }
  }

  destroy() {
    this._prevLine = null;
    this._currentLine = null;
    this._nextLine = null;
    this._lastActiveIdx = -2;
    super.destroy();
  }

  /**
   * Build the 3-line DOM structure.
   * @param {HTMLElement} container
   */
  _buildDOM(container) {
    container.innerHTML = '';

    this._prevLine = document.createElement('div');
    this._prevLine.className = 'karaoke-line karaoke-prev';
    this._prevLine.style.opacity = '0.6';
    this._prevLine.style.transition = 'opacity 0.3s ease';

    this._currentLine = document.createElement('div');
    this._currentLine.className = 'karaoke-line karaoke-current';
    this._currentLine.style.transition = 'opacity 0.3s ease';

    this._nextLine = document.createElement('div');
    this._nextLine.className = 'karaoke-line karaoke-next';
    this._nextLine.style.opacity = '0.6';
    this._nextLine.style.transition = 'opacity 0.3s ease';

    container.appendChild(this._prevLine);
    container.appendChild(this._currentLine);
    container.appendChild(this._nextLine);

    this._currentLine.textContent = 'Karaoke';
  }

  /**
   * Set text without transition.
   * @param {string} prev
   * @param {string} current
   * @param {string} next
   */
  _setText(prev, current, next) {
    this._prevLine.textContent = prev;
    this._currentLine.textContent = current;
    this._nextLine.textContent = next;
  }

  /**
   * Fade out all lines, update text, fade back in.
   * @param {string} prev
   * @param {string} current
   * @param {string} next
   */
  _fadeTransition(prev, current, next) {
    const lines = [this._prevLine, this._currentLine, this._nextLine];
    const targetOpacities = ['0.6', '1', '0.6'];

    // Fade out
    for (const line of lines) {
      line.style.opacity = '0';
    }

    // After fade-out, update text and fade in
    setTimeout(() => {
      this._setText(prev, current, next);
      lines.forEach((line, i) => {
        line.style.opacity = targetOpacities[i];
      });
    }, 150);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/wow3-animation/js/strategies/KaraokeStrategy.js
git commit -m "feat(karaoke): add KaraokeStrategy for 3-line display with fade"
```

---

## Task 3: SubtitleStrategy (single-line cinematic)

**Files:**
- Create: `js/strategies/SubtitleStrategy.js`

- [ ] **Step 1: Create the strategy**

Uses two alternating `div` elements (A/B) for cross-fade between consecutive cues.

```javascript
import { DisplayStrategy } from './DisplayStrategy.js';

/**
 * Single-line cinematic subtitle display.
 * Uses A/B swap technique for cross-fade between cues.
 */
export class SubtitleStrategy extends DisplayStrategy {
  constructor() {
    super();
    this._lineA = null;
    this._lineB = null;
    /** @type {'a'|'b'} Which line is currently visible */
    this._activeSlot = 'a';
    this._lastActiveIdx = -2;
    this._lastText = '';
  }

  /**
   * Build or update single-line subtitle display.
   * @param {Array} cues
   * @param {number} activeIdx
   * @param {number} relativeMs
   * @param {HTMLElement} container
   * @param {Object} props
   */
  render(cues, activeIdx, relativeMs, container, props) {
    this._container = container;
    const fadeDuration = props.subtitle?.fadeDuration ?? 200;
    const position = props.subtitle?.position ?? 'bottom';
    const transitionCss = `opacity ${fadeDuration}ms ease`;

    // Build DOM on first call
    if (!this._lineA) {
      this._buildDOM(container);
    }

    // Apply position
    container.style.justifyContent = position === 'top' ? 'flex-start'
      : position === 'center' ? 'center' : 'flex-end';

    // Apply styles to both slots
    for (const line of [this._lineA, this._lineB]) {
      this.applyFontStyles(line, props);
      line.style.transition = transitionCss;
    }

    const colorCurrent = props.colorCurrent || '#ff9800';

    if (!cues || cues.length === 0) {
      this._hideAll();
      return;
    }

    // No change — just update styles
    if (activeIdx === this._lastActiveIdx) {
      const activeLine = this._activeSlot === 'a' ? this._lineA : this._lineB;
      activeLine.style.color = colorCurrent;
      return;
    }

    this._lastActiveIdx = activeIdx;

    if (activeIdx < 0) {
      // No active cue — fade out current
      this._hideAll();
      this._lastText = '';
      return;
    }

    const newText = cues[activeIdx].text;

    if (this._lastText === '') {
      // Fade in (from nothing)
      const activeLine = this._activeSlot === 'a' ? this._lineA : this._lineB;
      activeLine.textContent = newText;
      activeLine.style.color = colorCurrent;
      activeLine.style.opacity = '1';
    } else {
      // Cross-fade: hide old slot, show new slot
      const oldLine = this._activeSlot === 'a' ? this._lineA : this._lineB;
      const newLine = this._activeSlot === 'a' ? this._lineB : this._lineA;

      oldLine.style.opacity = '0';
      newLine.textContent = newText;
      newLine.style.color = colorCurrent;
      newLine.style.opacity = '1';

      this._activeSlot = this._activeSlot === 'a' ? 'b' : 'a';
    }

    this._lastText = newText;
  }

  destroy() {
    this._lineA = null;
    this._lineB = null;
    this._activeSlot = 'a';
    this._lastActiveIdx = -2;
    this._lastText = '';
    super.destroy();
  }

  /**
   * Build A/B subtitle lines (stacked via position: absolute).
   * @param {HTMLElement} container
   */
  _buildDOM(container) {
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'subtitle-wrapper';
    wrapper.style.cssText = 'position: relative; width: 100%;';

    this._lineA = document.createElement('div');
    this._lineA.className = 'subtitle-line subtitle-line-a';
    this._lineA.style.cssText = 'opacity: 0; position: absolute; width: 100%; left: 0;';

    this._lineB = document.createElement('div');
    this._lineB.className = 'subtitle-line subtitle-line-b';
    this._lineB.style.cssText = 'opacity: 0; position: absolute; width: 100%; left: 0;';

    wrapper.appendChild(this._lineA);
    wrapper.appendChild(this._lineB);
    container.appendChild(wrapper);
  }

  /**
   * Fade out both lines.
   */
  _hideAll() {
    if (this._lineA) this._lineA.style.opacity = '0';
    if (this._lineB) this._lineB.style.opacity = '0';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/wow3-animation/js/strategies/SubtitleStrategy.js
git commit -m "feat(karaoke): add SubtitleStrategy for cinematic single-line display"
```

---

## Task 4: BlockStrategy (multi-line highlighted)

**Files:**
- Create: `js/strategies/BlockStrategy.js`

- [ ] **Step 1: Create the strategy**

```javascript
import { DisplayStrategy } from './DisplayStrategy.js';

/**
 * Multi-line block display with highlighted current line.
 * Shows N visible lines; scrolls to keep active line centered.
 */
export class BlockStrategy extends DisplayStrategy {
  constructor() {
    super();
    this._lines = [];
    this._wrapper = null;
    this._lastActiveIdx = -2;
    this._lastWindowStart = -1;
  }

  /**
   * Build or update multi-line block display.
   * @param {Array} cues
   * @param {number} activeIdx
   * @param {number} relativeMs
   * @param {HTMLElement} container
   * @param {Object} props
   */
  render(cues, activeIdx, relativeMs, container, props) {
    this._container = container;
    const visibleLines = props.block?.visibleLines ?? 5;
    const highlightBg = props.block?.highlightBg ?? 'transparent';
    const colorPrev = props.colorPrev || '#888888';
    const colorCurrent = props.colorCurrent || '#ff9800';

    if (!cues || cues.length === 0) {
      this._clear(container);
      return;
    }

    // Calculate the window of cues to show
    const totalCues = cues.length;
    const count = Math.min(visibleLines, totalCues);
    let windowStart = 0;

    if (activeIdx >= 0) {
      // Center the active line in the visible window
      const halfWindow = Math.floor(count / 2);
      windowStart = Math.max(0, Math.min(activeIdx - halfWindow, totalCues - count));
    }

    // Rebuild DOM if line count changed or first call
    if (!this._wrapper || this._lines.length !== count) {
      this._buildDOM(container, count);
    }

    // Detect window change for fade transition
    const windowChanged = windowStart !== this._lastWindowStart;
    this._lastWindowStart = windowStart;
    this._lastActiveIdx = activeIdx;

    if (windowChanged) {
      // Fade transition on scroll
      this._wrapper.style.opacity = '0';
      setTimeout(() => {
        this._updateLines(cues, activeIdx, windowStart, count, colorPrev, colorCurrent, highlightBg, props);
        this._wrapper.style.opacity = '1';
      }, 150);
    } else {
      this._updateLines(cues, activeIdx, windowStart, count, colorPrev, colorCurrent, highlightBg, props);
    }
  }

  destroy() {
    this._lines = [];
    this._wrapper = null;
    this._lastActiveIdx = -2;
    this._lastWindowStart = -1;
    super.destroy();
  }

  /**
   * Build N line elements inside a wrapper.
   * @param {HTMLElement} container
   * @param {number} count
   */
  _buildDOM(container, count) {
    container.innerHTML = '';

    this._wrapper = document.createElement('div');
    this._wrapper.className = 'block-container';
    this._wrapper.style.cssText = 'display: flex; flex-direction: column; justify-content: center; height: 100%; transition: opacity 0.3s ease;';

    this._lines = [];
    for (let i = 0; i < count; i++) {
      const line = document.createElement('div');
      line.className = 'block-line';
      line.style.cssText = 'padding: 2px 8px; word-wrap: break-word; overflow-wrap: break-word; transition: background-color 0.2s ease, color 0.2s ease;';
      this._wrapper.appendChild(line);
      this._lines.push(line);
    }

    container.appendChild(this._wrapper);
  }

  /**
   * Update line text, colors, and highlight.
   * @param {Array} cues
   * @param {number} activeIdx
   * @param {number} windowStart
   * @param {number} count
   * @param {string} colorPrev
   * @param {string} colorCurrent
   * @param {string} highlightBg
   * @param {Object} props
   */
  _updateLines(cues, activeIdx, windowStart, count, colorPrev, colorCurrent, highlightBg, props) {
    for (let i = 0; i < count; i++) {
      const cueIdx = windowStart + i;
      const line = this._lines[i];
      if (!line) continue;

      this.applyFontStyles(line, props);

      if (cueIdx < cues.length) {
        line.textContent = cues[cueIdx].text;

        if (cueIdx === activeIdx) {
          line.style.color = colorCurrent;
          line.style.backgroundColor = highlightBg;
          line.style.opacity = '1';
        } else {
          line.style.color = colorPrev;
          line.style.backgroundColor = 'transparent';
          line.style.opacity = '0.6';
        }
      } else {
        line.textContent = '';
        line.style.backgroundColor = 'transparent';
      }
    }
  }

  /**
   * Clear all content.
   * @param {HTMLElement} container
   */
  _clear(container) {
    if (this._wrapper) {
      for (const line of this._lines) {
        line.textContent = '';
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/wow3-animation/js/strategies/BlockStrategy.js
git commit -m "feat(karaoke): add BlockStrategy for multi-line highlighted display"
```

---

## Task 5: Strategy registry and factory

**Files:**
- Create: `js/strategies/index.js`

- [ ] **Step 1: Create the registry**

```javascript
import { KaraokeStrategy } from './KaraokeStrategy.js';
import { SubtitleStrategy } from './SubtitleStrategy.js';
import { BlockStrategy } from './BlockStrategy.js';

/**
 * Registry of display mode names to strategy classes.
 * @type {Object<string, typeof import('./DisplayStrategy.js').DisplayStrategy>}
 */
const STRATEGY_MAP = {
  karaoke: KaraokeStrategy,
  subtitle: SubtitleStrategy,
  block: BlockStrategy,
};

/**
 * Available display mode names for UI dropdowns.
 * @type {Array<{value: string, label: string}>}
 */
export const DISPLAY_MODES = [
  { value: 'karaoke', label: 'Karaoke' },
  { value: 'subtitle', label: 'Subtitle' },
  { value: 'block', label: 'Block' },
];

/**
 * Create a strategy instance for the given display mode.
 * Falls back to KaraokeStrategy for unknown modes.
 * @param {string} mode - 'karaoke' | 'subtitle' | 'block'
 * @returns {import('./DisplayStrategy.js').DisplayStrategy}
 */
export function createStrategy(mode) {
  const StrategyClass = STRATEGY_MAP[mode] || KaraokeStrategy;
  return new StrategyClass();
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/wow3-animation/js/strategies/index.js
git commit -m "feat(karaoke): add strategy registry and factory"
```

---

## Task 6: Refactor KaraokeElement to use strategies

**Files:**
- Modify: `js/models/KaraokeElement.js`

- [ ] **Step 1: Rewrite KaraokeElement to delegate to strategy**

Replace the entire file content:

```javascript
import { Element } from '@wow/core/models';
import { findActiveCue } from '../utils/srt-parser.js';
import { createStrategy } from '../strategies/index.js';

/**
 * Karaoke subtitle element.
 * Delegates display rendering to a DisplayStrategy based on displayMode.
 * Synchronized to timeline playhead via updateAtTime().
 */
export class KaraokeElement extends Element {
  /**
   * @param {Object} properties
   */
  constructor(properties = {}) {
    super('karaoke', properties);

    this.properties.colorPrev = properties.properties?.colorPrev ?? '#888888';
    this.properties.colorCurrent = properties.properties?.colorCurrent ?? '#ff9800';
    this.properties.colorNext = properties.properties?.colorNext ?? '#888888';
    this.properties.displayMode = properties.properties?.displayMode ?? 'karaoke';

    /** @type {import('../strategies/DisplayStrategy.js').DisplayStrategy} */
    this._strategy = createStrategy(this.properties.displayMode);
    /** @type {string} Tracks current mode to detect changes */
    this._currentMode = this.properties.displayMode;
  }

  /**
   * Render the karaoke element DOM.
   * @param {number} zIndex
   * @returns {HTMLElement}
   */
  render(zIndex = null) {
    const el = super.render(zIndex);
    el.classList.add('karaoke-element');

    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.justifyContent = 'center';
    el.style.overflow = 'hidden';

    // Initial render with empty cues (shows placeholder)
    this._strategy.render([], -1, 0, el, this.properties);

    return el;
  }

  /**
   * Update displayed content based on the current relative time.
   * Handles strategy swap when displayMode changes.
   * @param {number} relativeMs - Time relative to clip start
   * @param {Array<{startMs: number, endMs: number, text: string}>} cues - Parsed SRT cues
   */
  updateAtTime(relativeMs, cues) {
    const dom = document.getElementById(this.id);
    if (!dom) return;

    // Swap strategy if mode changed
    const mode = this.properties.displayMode || 'karaoke';
    if (mode !== this._currentMode) {
      this._strategy.destroy();
      this._strategy = createStrategy(mode);
      this._currentMode = mode;
    }

    const activeIdx = findActiveCue(cues, relativeMs);
    this._strategy.render(cues, activeIdx, relativeMs, dom, this.properties);
  }
}
```

- [ ] **Step 2: Verify no other file imports internal KaraokeElement methods**

Run this search (the only consumer should be CanvasRenderer calling `updateAtTime` and `render`):

```bash
grep -rn '_applyHighlightColor\|karaoke-prev\|karaoke-current\|karaoke-next' apps/wow3-animation/js/ --include='*.js'
```

Expected: No results outside `KaraokeStrategy.js` (which uses the class names internally). `CanvasRenderer.js` only calls `element.updateAtTime()` — no direct DOM queries on karaoke internals.

- [ ] **Step 3: Commit**

```bash
git add apps/wow3-animation/js/models/KaraokeElement.js
git commit -m "refactor(karaoke): delegate rendering to DisplayStrategy"
```

---

## Task 7: Update VisualClip defaults

**Files:**
- Modify: `js/models/VisualClip.js:79-86`

- [ ] **Step 1: Add new property defaults to the karaoke section**

In `VisualClip.createDefault()`, replace the karaoke defaults block:

```javascript
      karaoke: {
        position: { x: 100, y: 600, width: 800, height: 200, rotation: 0 },
        properties: {
          srtMediaId: null, srtUrl: '',
          displayMode: 'karaoke',
          colorPrev: '#888888', colorCurrent: '#ff9800', colorNext: '#888888',
          highlightAnimationSpeed: 0, highlightAnimationType: 'pingpong',
          font: { family: 'Roboto', size: 36, weight: 'bold', alignment: 'center' },
          subtitle: { position: 'bottom', fadeDuration: 200 },
          block: { visibleLines: 5, highlightBg: 'transparent' }
        }
      }
```

- [ ] **Step 2: Commit**

```bash
git add apps/wow3-animation/js/models/VisualClip.js
git commit -m "feat(karaoke): add displayMode, subtitle, block defaults to VisualClip"
```

---

## Task 8: Update KaraokePanel with mode dropdown and conditional sections

**Files:**
- Modify: `js/panels/KaraokePanel.js`

- [ ] **Step 1: Update the render method**

Replace the entire `render` method body. Adds mode dropdown at top, then shared controls, then mode-specific sections wrapped in conditional `div`s.

```javascript
  static render(element, clip) {
    const font = element.properties.font || {};
    const colorPrev = element.properties.colorPrev || '#888888';
    const colorCurrent = element.properties.colorCurrent || '#ff9800';
    const displayMode = element.properties.displayMode || 'karaoke';
    const subtitlePos = element.properties.subtitle?.position ?? 'bottom';
    const subtitleFade = element.properties.subtitle?.fadeDuration ?? 200;
    const blockLines = element.properties.block?.visibleLines ?? 5;
    const blockHighlightBg = element.properties.block?.highlightBg ?? 'transparent';

    const srtValue = clip?.properties?.srtMediaId || clip?.properties?.srtUrl || '';

    return `
      <div class="control-group">
        <label>Display Mode</label>
        <select id="karaoke-display-mode" class="panel-select">
          <option value="karaoke" ${displayMode === 'karaoke' ? 'selected' : ''}>Karaoke</option>
          <option value="subtitle" ${displayMode === 'subtitle' ? 'selected' : ''}>Subtitle</option>
          <option value="block" ${displayMode === 'block' ? 'selected' : ''}>Block</option>
        </select>
      </div>

      <div id="karaoke-srt-selector"></div>

      <div class="control-group">
        <label>Font Family</label>
        ${PanelUtils.renderFontFamilyPicker('font-family', font.family)}
      </div>

      ${PanelUtils.renderSlider('Font Size', 'font-size', font.size, 8, 144, 1, 'px')}

      ${PanelUtils.renderColorPicker('Text Color', 'karaoke-text-color', colorPrev)}

      ${PanelUtils.renderGradientPicker('Highlight Color', 'karaoke-highlight-gradient-selector', colorCurrent)}

      <div class="control-group">
        <label>Text Style</label>
        <div class="icon-toggle-row">
          <div class="icon-toggle-group" id="font-weight">
            <button class="icon-toggle-btn ${font.weight === '300' ? 'active' : ''}" data-value="300" title="Light">
              <span class="weight-preview" style="font-weight:300">A</span>
            </button>
            <button class="icon-toggle-btn ${font.weight === 'normal' || font.weight === '400' || (!font.weight || font.weight === '') ? 'active' : ''}" data-value="normal" title="Normal">
              <span class="weight-preview" style="font-weight:400">A</span>
            </button>
            <button class="icon-toggle-btn ${font.weight === 'bold' || font.weight === '700' ? 'active' : ''}" data-value="bold" title="Bold">
              <span class="weight-preview" style="font-weight:700">A</span>
            </button>
            <button class="icon-toggle-btn ${font.weight === '900' ? 'active' : ''}" data-value="900" title="Black">
              <span class="weight-preview" style="font-weight:900">A</span>
            </button>
          </div>
          <div class="icon-toggle-group" id="font-style">
            <button class="icon-toggle-btn ${font.style === 'italic' ? 'active' : ''}" data-value="italic" title="Italic">
              <i class="material-icons">format_italic</i>
            </button>
          </div>
        </div>
      </div>

      <div class="control-group">
        <label>Horizontal Alignment</label>
        <div class="icon-toggle-group" id="text-alignment">
          <button class="icon-toggle-btn ${font.alignment === 'left' ? 'active' : ''}" data-value="left">
            <i class="material-icons">format_align_left</i>
          </button>
          <button class="icon-toggle-btn ${font.alignment === 'center' ? 'active' : ''}" data-value="center">
            <i class="material-icons">format_align_center</i>
          </button>
          <button class="icon-toggle-btn ${font.alignment === 'right' ? 'active' : ''}" data-value="right">
            <i class="material-icons">format_align_right</i>
          </button>
        </div>
      </div>

      <div class="control-group">
        <label>
          <input type="checkbox" id="shadow-enabled" ${font.shadow?.enabled ? 'checked' : ''} />
          <span>Text Shadow</span>
        </label>
        <div id="shadow-options" style="display:${font.shadow?.enabled ? 'block' : 'none'}; margin-top:8px;">
          ${PanelUtils.renderColorPicker('Color', 'shadow-color', font.shadow?.color || '#000000')}
          ${PanelUtils.renderSlider('Offset X', 'shadow-offset-x', font.shadow?.offsetX ?? 2, -20, 20, 1, 'px')}
          ${PanelUtils.renderSlider('Offset Y', 'shadow-offset-y', font.shadow?.offsetY ?? 2, -20, 20, 1, 'px')}
          ${PanelUtils.renderSlider('Blur', 'shadow-blur', font.shadow?.blur ?? 4, 0, 30, 1, 'px')}
        </div>
      </div>

      <div class="control-group">
        <label>
          <input type="checkbox" id="stroke-enabled" ${font.stroke?.enabled ? 'checked' : ''} />
          <span>Text Stroke</span>
        </label>
        <div id="stroke-options" style="display:${font.stroke?.enabled ? 'block' : 'none'}; margin-top:8px;">
          ${PanelUtils.renderColorPicker('Color', 'stroke-color', font.stroke?.color || '#000000')}
          ${PanelUtils.renderSlider('Width', 'stroke-width', font.stroke?.width ?? 1, 0.5, 10, 0.5, 'px')}
        </div>
      </div>

      <!-- Karaoke-only: gradient animation -->
      <div id="mode-karaoke-options" style="display:${displayMode === 'karaoke' ? 'block' : 'none'};">
      </div>

      <!-- Subtitle-only options -->
      <div id="mode-subtitle-options" style="display:${displayMode === 'subtitle' ? 'block' : 'none'};">
        <div class="control-group">
          <label>Vertical Position</label>
          <div class="icon-toggle-group" id="subtitle-position">
            <button class="icon-toggle-btn ${subtitlePos === 'top' ? 'active' : ''}" data-value="top">Top</button>
            <button class="icon-toggle-btn ${subtitlePos === 'center' ? 'active' : ''}" data-value="center">Center</button>
            <button class="icon-toggle-btn ${subtitlePos === 'bottom' ? 'active' : ''}" data-value="bottom">Bottom</button>
          </div>
        </div>
        ${PanelUtils.renderSlider('Fade Duration', 'subtitle-fade-duration', subtitleFade, 100, 500, 10, 'ms')}
      </div>

      <!-- Block-only options -->
      <div id="mode-block-options" style="display:${displayMode === 'block' ? 'block' : 'none'};">
        ${PanelUtils.renderSlider('Visible Lines', 'block-visible-lines', blockLines, 3, 15, 1, '')}
        ${PanelUtils.renderColorPicker('Highlight Background', 'block-highlight-bg', blockHighlightBg)}
      </div>
    `;
  }
```

- [ ] **Step 2: Update the bindEvents method**

Replace the entire `bindEvents` method body. Adds mode dropdown handler + mode-specific bindings.

```javascript
  static bindEvents(element, clip) {
    const updateProperty = (path, value) => {
      window.app.editor.elementController.updateElementProperty(path, value);
    };
    const refreshClip = (previousSource = null) => {
      const controller = window.app?.editor?.elementController;
      if (!controller || !clip) return;
      controller.timeline.project.touch();
      if (previousSource) controller.canvasRenderer.invalidateSrtCache(previousSource);
      const currentSource = clip.properties.srtMediaId || clip.properties.srtUrl;
      if (currentSource) controller.canvasRenderer.invalidateSrtCache(currentSource);
      controller.canvasRenderer.renderAtCurrentTime();
    };
    const importSource = (value, options) => {
      return window.app?.editor?.externalMediaImporter?.importSource
        ? window.app.editor.externalMediaImporter.importSource(value, options)
        : Promise.resolve(value);
    };

    // Display mode dropdown
    const modeSelect = document.getElementById('karaoke-display-mode');
    const modeKaraoke = document.getElementById('mode-karaoke-options');
    const modeSubtitle = document.getElementById('mode-subtitle-options');
    const modeBlock = document.getElementById('mode-block-options');

    modeSelect?.addEventListener('change', () => {
      const mode = modeSelect.value;
      updateProperty('properties.displayMode', mode);

      // Toggle mode-specific sections
      if (modeKaraoke) modeKaraoke.style.display = mode === 'karaoke' ? 'block' : 'none';
      if (modeSubtitle) modeSubtitle.style.display = mode === 'subtitle' ? 'block' : 'none';
      if (modeBlock) modeBlock.style.display = mode === 'block' ? 'block' : 'none';
    });

    // SRT source
    const srtValue = clip?.properties?.srtMediaId || clip?.properties?.srtUrl || '';
    new ImageSelector('karaoke-srt-selector', {
      label: 'SRT Source',
      accept: '.srt,text/plain',
      mediaType: 'subtitle',
      placeholder: 'Enter URL or media ID',
      value: srtValue,
      onMediaChange: async (value) => {
        if (!clip) return;
        const previousSource = clip.properties.srtMediaId || clip.properties.srtUrl;
        if (typeof value === 'object' && value instanceof File) {
          if (typeof MediaDB !== 'undefined') {
            const item = await MediaDB.addMedia(value);
            clip.properties.srtMediaId = item.id;
            clip.properties.srtUrl = '';
            refreshClip(previousSource);
            return item.id;
          }
        } else {
          const nextValue = await importSource(value, { kind: 'subtitle' });
          if (typeof nextValue === 'string' && nextValue.startsWith('media_')) {
            clip.properties.srtMediaId = nextValue;
            clip.properties.srtUrl = '';
          } else {
            clip.properties.srtUrl = nextValue;
            clip.properties.srtMediaId = null;
          }
          refreshClip(previousSource);
          return clip.properties.srtMediaId || clip.properties.srtUrl || '';
        }
      }
    });

    // Font family
    PanelUtils.bindFontFamilyPicker('font-family', (value) => {
      updateProperty('properties.font.family', value);
    });

    // Font size
    PanelUtils.bindSlider('font-size', (value) => {
      updateProperty('properties.font.size', parseInt(value));
    });

    // Text color
    PanelUtils.bindColorPicker('karaoke-text-color', (value) => {
      updateProperty('properties.colorPrev', value);
      updateProperty('properties.colorNext', value);
    });

    // Highlight color
    PanelUtils.bindGradientPicker('karaoke-highlight-gradient-selector', element.properties.colorCurrent, (value, animationSpeed, animationType) => {
      updateProperty('properties.colorCurrent', value);
      updateProperty('properties.highlightAnimationSpeed', animationSpeed);
      updateProperty('properties.highlightAnimationType', animationType);
    }, element.properties.highlightAnimationSpeed, element.properties.highlightAnimationType);

    // Font weight
    document.querySelectorAll('#font-weight .icon-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#font-weight .icon-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateProperty('properties.font.weight', btn.dataset.value);
      });
    });

    // Font style (italic)
    document.querySelectorAll('#font-style .icon-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const isActive = btn.classList.toggle('active');
        updateProperty('properties.font.style', isActive ? 'italic' : 'normal');
      });
    });

    // Alignment
    document.querySelectorAll('#text-alignment .icon-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#text-alignment .icon-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateProperty('properties.font.alignment', btn.dataset.value);
      });
    });

    // Shadow
    const shadowCheck = document.getElementById('shadow-enabled');
    const shadowOpts = document.getElementById('shadow-options');
    shadowCheck?.addEventListener('change', () => {
      updateProperty('properties.font.shadow.enabled', shadowCheck.checked);
      if (shadowOpts) shadowOpts.style.display = shadowCheck.checked ? 'block' : 'none';
    });
    PanelUtils.bindColorPicker('shadow-color', (v) => updateProperty('properties.font.shadow.color', v));
    PanelUtils.bindSlider('shadow-offset-x', (v) => updateProperty('properties.font.shadow.offsetX', parseFloat(v)));
    PanelUtils.bindSlider('shadow-offset-y', (v) => updateProperty('properties.font.shadow.offsetY', parseFloat(v)));
    PanelUtils.bindSlider('shadow-blur', (v) => updateProperty('properties.font.shadow.blur', parseFloat(v)));

    // Stroke
    const strokeCheck = document.getElementById('stroke-enabled');
    const strokeOpts = document.getElementById('stroke-options');
    strokeCheck?.addEventListener('change', () => {
      updateProperty('properties.font.stroke.enabled', strokeCheck.checked);
      if (strokeOpts) strokeOpts.style.display = strokeCheck.checked ? 'block' : 'none';
    });
    PanelUtils.bindColorPicker('stroke-color', (v) => updateProperty('properties.font.stroke.color', v));
    PanelUtils.bindSlider('stroke-width', (v) => updateProperty('properties.font.stroke.width', parseFloat(v)));

    // Subtitle-only: vertical position
    document.querySelectorAll('#subtitle-position .icon-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#subtitle-position .icon-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateProperty('properties.subtitle.position', btn.dataset.value);
      });
    });

    // Subtitle-only: fade duration
    PanelUtils.bindSlider('subtitle-fade-duration', (v) => {
      updateProperty('properties.subtitle.fadeDuration', parseInt(v));
    });

    // Block-only: visible lines
    PanelUtils.bindSlider('block-visible-lines', (v) => {
      updateProperty('properties.block.visibleLines', parseInt(v));
    });

    // Block-only: highlight background
    PanelUtils.bindColorPicker('block-highlight-bg', (v) => {
      updateProperty('properties.block.highlightBg', v);
    });
  }
```

- [ ] **Step 3: Commit**

```bash
git add apps/wow3-animation/js/panels/KaraokePanel.js
git commit -m "feat(karaoke): add mode dropdown and conditional sections to KaraokePanel"
```

---

## Task 9: Update CSS

**Files:**
- Modify: `css/main.css`

- [ ] **Step 1: Add styles for new display modes**

Append after the existing karaoke styles (after line 312):

```css
/* ── Karaoke display modes ── */
.subtitle-wrapper { position: relative; width: 100%; min-height: 1.4em; }
.subtitle-line { padding: 2px 8px; word-wrap: break-word; overflow-wrap: break-word; }
.block-container { overflow: hidden; }
.block-line { padding: 2px 8px; word-wrap: break-word; overflow-wrap: break-word; border-radius: 2px; }
.panel-select {
  width: 100%; padding: 6px 8px; border: 1px solid var(--border-color, #444);
  background: var(--input-bg, #2a2a2a); color: var(--text-color, #e0e0e0);
  border-radius: 4px; font-size: 13px;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/wow3-animation/css/main.css
git commit -m "feat(karaoke): add CSS for subtitle, block display modes and panel select"
```

---

## Task 10: Update CHANGES.md

**Files:**
- Modify: `CHANGES.md`

- [ ] **Step 1: Add entry for display modes feature**

Add at the top of CHANGES.md:

```markdown
## 2026-04-10

### Added
- Karaoke Player: three selectable display modes via Strategy Pattern
  - **Karaoke** (default): 3-line display with fade transitions between lines
  - **Subtitle**: single-line cinematic display with fade in/out and cross-fade
  - **Block**: multi-line display with configurable visible lines and highlighted current line
- KaraokePanel: display mode dropdown with mode-specific configuration sections
- New properties: `displayMode`, `subtitle.position`, `subtitle.fadeDuration`, `block.visibleLines`, `block.highlightBg`
- Full backward compatibility: existing projects default to karaoke mode
```

- [ ] **Step 2: Commit**

```bash
git add CHANGES.md
git commit -m "docs: add karaoke display modes to CHANGES.md"
```
