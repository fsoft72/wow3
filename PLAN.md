# WOW3 Implementation Plan
## Complete Implementation Guide for Plain HTML/JavaScript/CSS3

---

## Context

WOW3 is a web-based presentation software similar to Apple Keynote. This plan provides a complete implementation roadmap for building WOW3 from scratch using **plain HTML, JavaScript (ES6+), and CSS3**, with MaterializeCSS for the UI framework. The software allows users to create, edit, and present slide-based presentations with rich media elements, animations, and interactive features.

**Why Plain HTML/JS/CSS:**
- No build process required
- Browser-native execution
- Easy deployment and maintenance
- Direct DOM manipulation for maximum control
- Leveraging modern JavaScript features (ES6 modules, classes, async/await)

**Key Objectives:**
1. Build a fully functional presentation editor in the browser
2. Support multiple element types (text, images, videos, audio, shapes, lists, links)
3. Implement a comprehensive CSS3 animation system
4. Provide intuitive drag-drop, resize, and rotate interactions
5. Enable presentation playback mode
6. Support data persistence (localStorage/IndexedDB)

---

## Project Structure

```
wow3/
├── index.html                      # Main application entry point
├── css/
│   ├── materialize.min.css        # MaterializeCSS framework
│   ├── animations.css              # WOW3 animation system
│   ├── main.css                    # Main application styles
│   ├── editor.css                  # Editor canvas styles
│   ├── sidebar.css                 # Sidebar styles
│   └── components.css              # Reusable component styles
├── js/
│   ├── app.js                      # Main application bootstrap
│   ├── models/
│   │   ├── Presentation.js         # Presentation data model
│   │   ├── Slide.js                # Slide data model
│   │   ├── Element.js              # Element data model (base class)
│   │   ├── TextElement.js          # Text element implementation
│   │   ├── ImageElement.js         # Image element implementation
│   │   ├── VideoElement.js         # Video element implementation
│   │   ├── AudioElement.js         # Audio element implementation
│   │   ├── ShapeElement.js         # Shape element implementation
│   │   ├── ListElement.js          # List element implementation
│   │   └── LinkElement.js          # Link element implementation
│   ├── controllers/
│   │   ├── EditorController.js     # Main editor logic
│   │   ├── SlideController.js      # Slide management
│   │   ├── ElementController.js    # Element manipulation
│   │   ├── AnimationController.js  # Animation system
│   │   └── PlaybackController.js   # Presentation playback
│   ├── views/
│   │   ├── UIManager.js            # UI state management
│   │   ├── LeftSidebar.js          # Slide list sidebar
│   │   ├── RightSidebar.js         # Properties sidebar
│   │   ├── Canvas.js               # Main editing canvas
│   │   ├── Toolbar.js              # Top toolbar
│   │   ├── StatusBar.js            # Bottom status bar
│   │   └── ElementsTree.js         # Page elements tree view
│   ├── utils/
│   │   ├── animations.js           # Animation utilities
│   │   ├── storage.js              # Data persistence
│   │   ├── dom.js                  # DOM manipulation helpers
│   │   ├── events.js               # Event handling utilities
│   │   ├── positioning.js          # Element positioning helpers
│   │   └── constants.js            # Application constants
│   └── interactions/
│       ├── DragHandler.js          # Drag and drop
│       ├── ResizeHandler.js        # Element resizing
│       ├── RotateHandler.js        # Element rotation
│       └── AlignmentGuides.js      # Alignment guide system
├── assets/
│   ├── icons/                      # Application icons
│   ├── images/                     # Sample/default images
│   └── fonts/                      # Custom fonts
└── docs/
    ├── specifications.md           # Feature specifications
    └── animations.md               # Animation system docs
```

---

## Implementation Phases

### Phase 1: Foundation and Core Structure
**Goal:** Set up the HTML structure, CSS foundation, and basic JavaScript architecture

#### 1.1 HTML Structure (`index.html`)
Create the main HTML file with:
- DOCTYPE, meta tags, viewport settings
- MaterializeCSS CDN link
- Custom CSS files
- Application structure:
  - Top menu bar with toolbar
  - Left sidebar for slide list
  - Main canvas area for editing
  - Right sidebar for properties
  - Bottom status bar
- JavaScript module imports
- Modal templates (animation editor, element properties, etc.)

**Key HTML Elements:**
```html
<!-- Top Menu Bar -->
<nav id="top-menu">
  <div class="nav-wrapper">
    <a href="#" class="brand-logo">WOW3</a>
    <ul id="toolbar" class="right">
      <!-- Toolbar buttons: New, Open, Save, Text, Image, etc. -->
    </ul>
  </div>
</nav>

<!-- Main Container -->
<div id="app-container">
  <!-- Left Sidebar -->
  <aside id="left-sidebar" class="sidebar">
    <div class="sidebar-header">
      <button id="add-slide-btn" class="btn waves-effect">
        <i class="material-icons">add</i> New Slide
      </button>
    </div>
    <div id="slide-list" class="slide-list">
      <!-- Slide thumbnails will be rendered here -->
    </div>
  </aside>

  <!-- Main Canvas -->
  <main id="main-canvas" class="canvas-area">
    <div id="canvas-wrapper">
      <div id="slide-canvas" class="slide-canvas">
        <!-- Current slide elements rendered here -->
      </div>
      <div id="alignment-guides" class="alignment-guides">
        <!-- Dynamic alignment guides -->
      </div>
    </div>
  </main>

  <!-- Right Sidebar -->
  <aside id="right-sidebar" class="sidebar">
    <ul class="tabs">
      <li class="tab"><a href="#tab-slide">Slide</a></li>
      <li class="tab"><a href="#tab-element">Element</a></li>
      <li class="tab"><a href="#tab-animation">Animation</a></li>
    </ul>
    <div id="tab-slide" class="tab-content">
      <!-- Slide properties -->
    </div>
    <div id="tab-element" class="tab-content">
      <!-- Element properties -->
    </div>
    <div id="tab-animation" class="tab-content">
      <!-- Page Elements Tree -->
      <div id="elements-tree"></div>
    </div>
  </aside>
</div>

<!-- Bottom Status Bar -->
<footer id="status-bar" class="status-bar">
  <span id="slide-counter">Slide 1 of 1</span>
  <span id="zoom-level">100%</span>
</footer>

<!-- Modals -->
<div id="animation-modal" class="modal">
  <!-- Animation editor modal -->
</div>
```

#### 1.2 CSS Foundation

**1.2.1 animations.css**
Implement the complete animation system with:
- Base animation classes (`.wow-animated`, `.wow-fade-in`, `.wow-slide-in-*`, etc.)
- Animation type definitions matching specifications:
  - Fade: `fade-in`, `fade-out`
  - Slide: `slide-in-{top|bottom|left|right}`, `slide-out-{top|bottom|left|right}`
  - Zoom: `zoom-in`, `zoom-out`, `zoom-in-up`, `zoom-in-down`, etc.
  - Flip: `flip-in-x`, `flip-in-y`, `flip-out-x`, `flip-out-y`
  - Bounce: `bounce-in`, `bounce-out`
  - Rotate: `rotate-in`, `rotate-out`
- Duration classes (`.wow-duration-fast`, `.wow-duration-normal`, etc.)
- Delay classes (`.wow-delay-1` through `.wow-delay-20`)
- Easing classes (`.wow-ease-linear`, `.wow-ease-in-out-back`, etc.)
- Performance optimizations: `will-change`, `transform3d`
- Media queries for `prefers-reduced-motion`

**Structure:**
```css
/* Base animation class */
.wow-animated {
  animation-fill-mode: both;
  animation-duration: 0.6s;
  will-change: transform, opacity;
}

/* Fade animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.wow-fade-in {
  animation-name: fadeIn;
}

/* Slide animations with 3D transforms */
@keyframes slideInLeft {
  from {
    transform: translate3d(-100%, 0, 0);
    opacity: 0;
  }
  to {
    transform: translate3d(0, 0, 0);
    opacity: 1;
  }
}

.wow-slide-in-left {
  animation-name: slideInLeft;
}

/* Duration utilities */
.wow-duration-fast { animation-duration: 0.3s; }
.wow-duration-normal { animation-duration: 0.6s; }
.wow-duration-slow { animation-duration: 1s; }

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .wow-animated {
    animation-duration: 0.01ms !important;
  }
}
```

**1.2.2 main.css**
Application layout and base styles:
```css
:root {
  --sidebar-width: 250px;
  --toolbar-height: 64px;
  --statusbar-height: 32px;
  --canvas-bg: #f5f5f5;
  --sidebar-bg: #ffffff;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Roboto', sans-serif;
  overflow: hidden;
}

#app-container {
  display: flex;
  height: calc(100vh - var(--toolbar-height) - var(--statusbar-height));
  margin-top: var(--toolbar-height);
}

.sidebar {
  width: var(--sidebar-width);
  background: var(--sidebar-bg);
  border-right: 1px solid #e0e0e0;
  overflow-y: auto;
}

.canvas-area {
  flex: 1;
  background: var(--canvas-bg);
  position: relative;
  overflow: hidden;
}

.status-bar {
  height: var(--statusbar-height);
  background: #263238;
  color: white;
  display: flex;
  align-items: center;
  padding: 0 16px;
  justify-content: space-between;
}
```

**1.2.3 editor.css**
Canvas and element styles:
```css
#canvas-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slide-canvas {
  width: 1280px;
  height: 720px;
  background: white;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  position: relative;
  overflow: hidden;
}

/* Element base styles */
.element {
  position: absolute;
  cursor: move;
  user-select: none;
}

.element.selected {
  outline: 2px solid #2196F3;
  outline-offset: 2px;
}

.element.dragging {
  opacity: 0.7;
  box-shadow: 0 8px 16px rgba(0,0,0,0.3);
}

/* Resize handles */
.resize-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #2196F3;
  border: 2px solid white;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.resize-handle.nw { top: -5px; left: -5px; cursor: nw-resize; }
.resize-handle.ne { top: -5px; right: -5px; cursor: ne-resize; }
.resize-handle.sw { bottom: -5px; left: -5px; cursor: sw-resize; }
.resize-handle.se { bottom: -5px; right: -5px; cursor: se-resize; }
.resize-handle.n { top: -5px; left: 50%; transform: translateX(-50%); cursor: n-resize; }
.resize-handle.s { bottom: -5px; left: 50%; transform: translateX(-50%); cursor: s-resize; }
.resize-handle.w { left: -5px; top: 50%; transform: translateY(-50%); cursor: w-resize; }
.resize-handle.e { right: -5px; top: 50%; transform: translateY(-50%); cursor: e-resize; }

/* Rotation handle */
.rotate-handle {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 20px;
  background: #4CAF50;
  border: 2px solid white;
  border-radius: 50%;
  cursor: grab;
}

/* Alignment guides */
.alignment-guide {
  position: absolute;
  background: #2196F3;
  z-index: 9999;
}

.alignment-guide.horizontal {
  width: 100%;
  height: 1px;
}

.alignment-guide.vertical {
  width: 1px;
  height: 100%;
}
```

**1.2.4 sidebar.css**
Sidebar specific styles:
```css
/* Slide list */
.slide-list {
  padding: 8px;
}

.slide-thumbnail {
  width: 100%;
  aspect-ratio: 16/9;
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 4px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.slide-thumbnail.active {
  border-color: #2196F3;
  box-shadow: 0 2px 8px rgba(33,150,243,0.3);
}

.slide-thumbnail:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.slide-number {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0,0,0,0.6);
  color: white;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
}

/* Elements tree */
.elements-tree {
  padding: 16px;
}

.tree-item {
  padding: 8px 12px;
  border-left: 2px solid #e0e0e0;
  margin-bottom: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tree-item.level-1 {
  margin-left: 20px;
}

.tree-item:hover {
  background: #f5f5f5;
}

.tree-item.selected {
  background: #E3F2FD;
  border-left-color: #2196F3;
}

.animation-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid #ccc;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.animation-btn.active {
  background: #4CAF50;
  color: white;
  border-color: #4CAF50;
}
```

**1.2.5 components.css**
Reusable component styles (property panels, modals, etc.)

#### 1.3 JavaScript Architecture Setup

**1.3.1 Constants (`js/utils/constants.js`)**
```javascript
// Animation type constants (bitwise flags)
export const AnimationType = {
  FADE_IN: 1,
  FADE_OUT: 2,
  SLIDE_IN: 4,
  SLIDE_OUT: 8,
  ZOOM_IN: 16,
  ZOOM_OUT: 32
};

// Animation triggers
export const AnimationTrigger = {
  CLICK: 'click',
  AUTO: 'auto'
};

// Element types
export const ElementType = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  LIST: 'list',
  LINK: 'link',
  SHAPE: 'shape'
};

// Slide directions
export const SlideDirection = {
  TOP: 'top',
  BOTTOM: 'bottom',
  LEFT: 'left',
  RIGHT: 'right'
};

// Canvas settings
export const CANVAS = {
  WIDTH: 1280,
  HEIGHT: 720,
  ASPECT_RATIO: 16/9
};

// Default values
export const DEFAULTS = {
  FONT_FAMILY: 'Roboto',
  FONT_SIZE: 16,
  FONT_COLOR: '#000000',
  ANIMATION_DURATION: 600
};
```

**1.3.2 Application Bootstrap (`js/app.js`)**
```javascript
import { EditorController } from './controllers/EditorController.js';
import { UIManager } from './views/UIManager.js';

class WOW3App {
  constructor() {
    this.editor = null;
    this.uiManager = null;
  }

  async init() {
    console.log('Initializing WOW3...');

    // Initialize MaterializeCSS components
    this.initMaterialize();

    // Initialize UI Manager
    this.uiManager = new UIManager();
    await this.uiManager.init();

    // Initialize Editor Controller
    this.editor = new EditorController(this.uiManager);
    await this.editor.init();

    // Load or create presentation
    await this.loadPresentation();

    // Setup global event listeners
    this.setupGlobalEvents();

    console.log('WOW3 initialized successfully');
  }

  initMaterialize() {
    // Initialize MaterializeCSS components when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
      M.AutoInit(); // Auto-initialize all Materialize components
      M.Tabs.init(document.querySelectorAll('.tabs'));
      M.Modal.init(document.querySelectorAll('.modal'));
      M.Dropdown.init(document.querySelectorAll('.dropdown-trigger'));
    });
  }

  async loadPresentation() {
    // Try to load from localStorage or create new
    const savedData = localStorage.getItem('wow3_current_presentation');
    if (savedData) {
      await this.editor.loadPresentation(JSON.parse(savedData));
    } else {
      await this.editor.createNewPresentation();
    }
  }

  setupGlobalEvents() {
    // Auto-save
    setInterval(() => {
      this.editor.autoSave();
    }, 30000); // Every 30 seconds

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });

    // Window resize
    window.addEventListener('resize', () => {
      this.uiManager.handleResize();
    });

    // Before unload warning
    window.addEventListener('beforeunload', (e) => {
      if (this.editor.hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    });
  }

  handleKeyboardShortcuts(e) {
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key === 's') {
      e.preventDefault();
      this.editor.savePresentation();
    } else if (ctrl && e.key === 'z') {
      e.preventDefault();
      this.editor.undo();
    } else if (ctrl && e.key === 'y') {
      e.preventDefault();
      this.editor.redo();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        this.editor.deleteSelectedElement();
      }
    }
  }
}

// Initialize application
const app = new WOW3App();
app.init();
```

---

### Phase 2: Data Models
**Goal:** Implement all data model classes with proper structure and methods

#### 2.1 Base Element Class (`js/models/Element.js`)
```javascript
import { generateId } from '../utils/dom.js';

export class Element {
  constructor(type, properties = {}) {
    this.id = properties.id || generateId('element');
    this.type = type;
    this.position = properties.position || {
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      rotation: 0
    };
    this.properties = {
      font: {
        family: 'Roboto',
        size: 16,
        color: '#000000',
        style: 'normal',
        weight: 'normal',
        decoration: 'none',
        alignment: 'left'
      },
      ...properties.properties
    };
    this.inEffect = properties.inEffect || null;
    this.outEffect = properties.outEffect || null;
    this.children = properties.children || [];
    this.parent = null;
  }

  // Convert to JSON for storage
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      position: this.position,
      properties: this.properties,
      inEffect: this.inEffect,
      outEffect: this.outEffect,
      children: this.children.map(child => child.toJSON())
    };
  }

  // Create from JSON
  static fromJSON(data) {
    const element = new Element(data.type, data);
    if (data.children && data.children.length > 0) {
      element.children = data.children.map(childData => Element.fromJSON(childData));
    }
    return element;
  }

  // Add child element
  addChild(element) {
    if (this.children.length === 0) { // Only one level of nesting allowed
      element.parent = this;
      this.children.push(element);
      return true;
    }
    return false;
  }

  // Remove child element
  removeChild(elementId) {
    const index = this.children.findIndex(child => child.id === elementId);
    if (index !== -1) {
      this.children[index].parent = null;
      this.children.splice(index, 1);
      return true;
    }
    return false;
  }

  // Clone element
  clone() {
    const data = this.toJSON();
    data.id = generateId('element');
    return Element.fromJSON(data);
  }

  // Update position
  updatePosition(updates) {
    this.position = { ...this.position, ...updates };
  }

  // Render to DOM (to be overridden by subclasses)
  render() {
    const el = document.createElement('div');
    el.className = 'element';
    el.id = this.id;
    el.style.cssText = `
      left: ${this.position.x}px;
      top: ${this.position.y}px;
      width: ${this.position.width}px;
      height: ${this.position.height}px;
      transform: rotate(${this.position.rotation}deg);
    `;
    return el;
  }
}
```

#### 2.2 Specific Element Classes

**TextElement.js:**
```javascript
import { Element } from './Element.js';
import { ElementType } from '../utils/constants.js';

export class TextElement extends Element {
  constructor(properties = {}) {
    super(ElementType.TEXT, properties);
    this.properties.text = properties.properties?.text || 'Enter text here';
  }

  render() {
    const el = super.render();
    el.classList.add('text-element');

    const textContent = document.createElement('div');
    textContent.className = 'text-content';
    textContent.contentEditable = true;
    textContent.innerText = this.properties.text;
    textContent.style.cssText = `
      font-family: ${this.properties.font.family};
      font-size: ${this.properties.font.size}px;
      color: ${this.properties.font.color};
      font-style: ${this.properties.font.style};
      font-weight: ${this.properties.font.weight};
      text-decoration: ${this.properties.font.decoration};
      text-align: ${this.properties.font.alignment};
      width: 100%;
      height: 100%;
      outline: none;
    `;

    el.appendChild(textContent);
    return el;
  }

  updateText(text) {
    this.properties.text = text;
  }
}
```

**ImageElement.js:**
```javascript
import { Element } from './Element.js';
import { ElementType } from '../utils/constants.js';

export class ImageElement extends Element {
  constructor(properties = {}) {
    super(ElementType.IMAGE, properties);
    this.properties.url = properties.properties?.url || '';
    this.properties.aspectRatio = properties.properties?.aspectRatio || null;
  }

  render() {
    const el = super.render();
    el.classList.add('image-element');

    const img = document.createElement('img');
    img.src = this.properties.url;
    img.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
    `;

    // Store aspect ratio when image loads
    img.onload = () => {
      if (!this.properties.aspectRatio) {
        this.properties.aspectRatio = img.naturalWidth / img.naturalHeight;
      }
    };

    el.appendChild(img);
    return el;
  }

  setUrl(url) {
    this.properties.url = url;
  }
}
```

**VideoElement.js:**
```javascript
import { Element } from './Element.js';
import { ElementType } from '../utils/constants.js';

export class VideoElement extends Element {
  constructor(properties = {}) {
    super(ElementType.VIDEO, properties);
    this.properties.url = properties.properties?.url || '';
    this.properties.aspectRatio = properties.properties?.aspectRatio || 16/9;
  }

  render() {
    const el = super.render();
    el.classList.add('video-element');

    const video = document.createElement('video');
    video.src = this.properties.url;
    video.controls = true;
    video.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
    `;

    // Store aspect ratio when video loads
    video.onloadedmetadata = () => {
      if (video.videoWidth && video.videoHeight) {
        this.properties.aspectRatio = video.videoWidth / video.videoHeight;
      }
    };

    el.appendChild(video);
    return el;
  }

  setUrl(url) {
    this.properties.url = url;
  }
}
```

**ShapeElement.js:**
```javascript
import { Element } from './Element.js';
import { ElementType } from '../utils/constants.js';

export class ShapeElement extends Element {
  constructor(properties = {}) {
    super(ElementType.SHAPE, properties);
    this.properties.shapeType = properties.properties?.shapeType || 'rectangle';
    this.properties.fillColor = properties.properties?.fillColor || '#2196F3';
    this.properties.strokeColor = properties.properties?.strokeColor || '#000000';
    this.properties.strokeWidth = properties.properties?.strokeWidth || 2;
  }

  render() {
    const el = super.render();
    el.classList.add('shape-element');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');

    let shape;
    switch (this.properties.shapeType) {
      case 'circle':
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        shape.setAttribute('cx', '50%');
        shape.setAttribute('cy', '50%');
        shape.setAttribute('r', '45%');
        break;
      case 'rectangle':
      default:
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        shape.setAttribute('width', '100%');
        shape.setAttribute('height', '100%');
        break;
    }

    shape.setAttribute('fill', this.properties.fillColor);
    shape.setAttribute('stroke', this.properties.strokeColor);
    shape.setAttribute('stroke-width', this.properties.strokeWidth);

    svg.appendChild(shape);
    el.appendChild(svg);
    return el;
  }
}
```

**ListElement.js, AudioElement.js, LinkElement.js** - Similar implementations

#### 2.3 Slide Model (`js/models/Slide.js`)
```javascript
import { generateId } from '../utils/dom.js';

export class Slide {
  constructor(properties = {}) {
    this.id = properties.id || generateId('slide');
    this.title = properties.title || 'Untitled Slide';
    this.elements = properties.elements || [];
    this.background = properties.background || '#ffffff';
  }

  addElement(element) {
    this.elements.push(element);
  }

  removeElement(elementId) {
    const index = this.elements.findIndex(el => el.id === elementId);
    if (index !== -1) {
      this.elements.splice(index, 1);
      return true;
    }
    return false;
  }

  getElement(elementId) {
    return this.elements.find(el => el.id === elementId);
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      elements: this.elements.map(el => el.toJSON()),
      background: this.background
    };
  }

  static fromJSON(data) {
    const slide = new Slide({
      id: data.id,
      title: data.title,
      background: data.background
    });

    if (data.elements) {
      slide.elements = data.elements.map(elData => {
        // Import appropriate element class based on type
        const ElementClass = getElementClass(elData.type);
        return new ElementClass(elData);
      });
    }

    return slide;
  }

  clone() {
    const data = this.toJSON();
    data.id = generateId('slide');
    return Slide.fromJSON(data);
  }
}

// Helper to get element class by type
function getElementClass(type) {
  const classes = {
    text: TextElement,
    image: ImageElement,
    video: VideoElement,
    audio: AudioElement,
    shape: ShapeElement,
    list: ListElement,
    link: LinkElement
  };
  return classes[type] || Element;
}
```

#### 2.4 Presentation Model (`js/models/Presentation.js`)
```javascript
import { generateId } from '../utils/dom.js';
import { Slide } from './Slide.js';

export class Presentation {
  constructor(properties = {}) {
    this.id = properties.id || generateId('presentation');
    this.title = properties.title || 'Untitled Presentation';
    this.slides = properties.slides || [new Slide()];
    this.currentSlideIndex = 0;
    this.metadata = {
      created: properties.metadata?.created || new Date().toISOString(),
      modified: properties.metadata?.modified || new Date().toISOString(),
      author: properties.metadata?.author || ''
    };
  }

  getCurrentSlide() {
    return this.slides[this.currentSlideIndex];
  }

  setCurrentSlide(index) {
    if (index >= 0 && index < this.slides.length) {
      this.currentSlideIndex = index;
      return true;
    }
    return false;
  }

  addSlide(slide = null, index = null) {
    const newSlide = slide || new Slide();
    if (index === null) {
      this.slides.push(newSlide);
    } else {
      this.slides.splice(index, 0, newSlide);
    }
    this.updateModified();
    return newSlide;
  }

  removeSlide(index) {
    if (this.slides.length > 1 && index >= 0 && index < this.slides.length) {
      this.slides.splice(index, 1);
      if (this.currentSlideIndex >= this.slides.length) {
        this.currentSlideIndex = this.slides.length - 1;
      }
      this.updateModified();
      return true;
    }
    return false;
  }

  duplicateSlide(index) {
    if (index >= 0 && index < this.slides.length) {
      const clonedSlide = this.slides[index].clone();
      this.slides.splice(index + 1, 0, clonedSlide);
      this.updateModified();
      return clonedSlide;
    }
    return null;
  }

  reorderSlides(fromIndex, toIndex) {
    if (fromIndex >= 0 && fromIndex < this.slides.length &&
        toIndex >= 0 && toIndex < this.slides.length) {
      const slide = this.slides.splice(fromIndex, 1)[0];
      this.slides.splice(toIndex, 0, slide);
      this.updateModified();
      return true;
    }
    return false;
  }

  updateModified() {
    this.metadata.modified = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      slides: this.slides.map(slide => slide.toJSON()),
      metadata: this.metadata
    };
  }

  static fromJSON(data) {
    const presentation = new Presentation({
      id: data.id,
      title: data.title,
      metadata: data.metadata
    });

    if (data.slides) {
      presentation.slides = data.slides.map(slideData => Slide.fromJSON(slideData));
    }

    return presentation;
  }
}
```

---

### Phase 3: Controllers and Business Logic
**Goal:** Implement controllers for managing presentation state and operations

#### 3.1 Editor Controller (`js/controllers/EditorController.js`)
Main controller coordinating all editor operations:

```javascript
import { Presentation } from '../models/Presentation.js';
import { SlideController } from './SlideController.js';
import { ElementController } from './ElementController.js';
import { AnimationController } from './AnimationController.js';
import { savePresentation, loadPresentation } from '../utils/storage.js';

export class EditorController {
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.presentation = null;
    this.slideController = null;
    this.elementController = null;
    this.animationController = null;
    this.history = [];
    this.historyIndex = -1;
    this.unsavedChanges = false;
  }

  async init() {
    // Initialize sub-controllers
    this.slideController = new SlideController(this);
    this.elementController = new ElementController(this);
    this.animationController = new AnimationController(this);

    await this.slideController.init();
    await this.elementController.init();
    await this.animationController.init();

    // Setup event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Toolbar events
    document.getElementById('add-slide-btn').addEventListener('click', () => {
      this.addSlide();
    });

    document.getElementById('save-btn')?.addEventListener('click', () => {
      this.savePresentation();
    });

    // Add element buttons
    document.getElementById('add-text-btn')?.addEventListener('click', () => {
      this.addElement('text');
    });

    document.getElementById('add-image-btn')?.addEventListener('click', () => {
      this.addElement('image');
    });

    // ... more event listeners
  }

  async createNewPresentation() {
    this.presentation = new Presentation();
    this.resetHistory();
    await this.render();
  }

  async loadPresentation(data) {
    this.presentation = Presentation.fromJSON(data);
    this.resetHistory();
    await this.render();
  }

  async render() {
    if (!this.presentation) return;

    // Render slides in left sidebar
    await this.slideController.renderSlides();

    // Render current slide in canvas
    await this.slideController.renderCurrentSlide();

    // Update UI
    this.uiManager.updateStatusBar(
      this.presentation.currentSlideIndex + 1,
      this.presentation.slides.length
    );
  }

  addSlide() {
    const slide = this.presentation.addSlide();
    this.recordHistory();
    this.render();
    this.presentation.setCurrentSlide(this.presentation.slides.length - 1);
  }

  addElement(type) {
    this.elementController.createElement(type);
    this.recordHistory();
  }

  deleteSelectedElement() {
    if (this.elementController.selectedElement) {
      this.elementController.deleteElement(this.elementController.selectedElement.id);
      this.recordHistory();
    }
  }

  // History management
  recordHistory() {
    const state = JSON.stringify(this.presentation.toJSON());
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(state);
    this.historyIndex++;
    this.unsavedChanges = true;
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.loadPresentation(JSON.parse(this.history[this.historyIndex]));
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.loadPresentation(JSON.parse(this.history[this.historyIndex]));
    }
  }

  resetHistory() {
    this.history = [JSON.stringify(this.presentation.toJSON())];
    this.historyIndex = 0;
    this.unsavedChanges = false;
  }

  // Persistence
  savePresentation() {
    savePresentation(this.presentation);
    this.unsavedChanges = false;
    M.toast({html: 'Presentation saved!', classes: 'green'});
  }

  autoSave() {
    if (this.unsavedChanges) {
      this.savePresentation();
    }
  }

  hasUnsavedChanges() {
    return this.unsavedChanges;
  }
}
```

#### 3.2 Slide Controller (`js/controllers/SlideController.js`)
Manages slide operations:

```javascript
export class SlideController {
  constructor(editorController) {
    this.editor = editorController;
  }

  async init() {
    this.setupSlideEvents();
  }

  setupSlideEvents() {
    // Drag and drop for reordering
    const slideList = document.getElementById('slide-list');

    slideList.addEventListener('dragstart', (e) => {
      if (e.target.classList.contains('slide-thumbnail')) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.innerHTML);
        e.target.classList.add('dragging');
      }
    });

    slideList.addEventListener('dragend', (e) => {
      if (e.target.classList.contains('slide-thumbnail')) {
        e.target.classList.remove('dragging');
      }
    });

    slideList.addEventListener('dragover', (e) => {
      e.preventDefault();
      const afterElement = this.getDragAfterElement(slideList, e.clientY);
      const dragging = document.querySelector('.dragging');
      if (afterElement) {
        slideList.insertBefore(dragging, afterElement);
      } else {
        slideList.appendChild(dragging);
      }
    });

    slideList.addEventListener('drop', (e) => {
      e.preventDefault();
      this.handleSlideReorder();
    });
  }

  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.slide-thumbnail:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  handleSlideReorder() {
    // Get new order from DOM
    const thumbnails = document.querySelectorAll('.slide-thumbnail');
    const newOrder = Array.from(thumbnails).map(thumb =>
      parseInt(thumb.dataset.slideIndex)
    );

    // Reorder slides in model
    const newSlides = newOrder.map(index => this.editor.presentation.slides[index]);
    this.editor.presentation.slides = newSlides;
    this.editor.recordHistory();
    this.renderSlides();
  }

  async renderSlides() {
    const slideList = document.getElementById('slide-list');
    slideList.innerHTML = '';

    this.editor.presentation.slides.forEach((slide, index) => {
      const thumbnail = this.createSlideThumbnail(slide, index);
      slideList.appendChild(thumbnail);
    });
  }

  createSlideThumbnail(slide, index) {
    const div = document.createElement('div');
    div.className = 'slide-thumbnail';
    if (index === this.editor.presentation.currentSlideIndex) {
      div.classList.add('active');
    }
    div.dataset.slideIndex = index;
    div.draggable = true;

    // Slide number
    const number = document.createElement('div');
    number.className = 'slide-number';
    number.textContent = index + 1;
    div.appendChild(number);

    // Thumbnail preview (simplified)
    const preview = document.createElement('div');
    preview.className = 'slide-preview';
    preview.style.cssText = `
      width: 100%;
      height: 100%;
      background: ${slide.background};
      position: relative;
    `;
    div.appendChild(preview);

    // Click to select
    div.addEventListener('click', () => {
      this.selectSlide(index);
    });

    // Right-click context menu
    div.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showSlideContextMenu(e, index);
    });

    return div;
  }

  selectSlide(index) {
    this.editor.presentation.setCurrentSlide(index);
    this.renderCurrentSlide();
    this.renderSlides(); // Update active state
  }

  async renderCurrentSlide() {
    const canvas = document.getElementById('slide-canvas');
    canvas.innerHTML = '';

    const currentSlide = this.editor.presentation.getCurrentSlide();
    canvas.style.background = currentSlide.background;

    // Render all elements
    currentSlide.elements.forEach(element => {
      const elementDOM = element.render();
      canvas.appendChild(elementDOM);

      // Attach interaction handlers
      this.editor.elementController.attachHandlers(elementDOM, element);

      // Render children
      element.children.forEach(child => {
        const childDOM = child.render();
        elementDOM.appendChild(childDOM);
        this.editor.elementController.attachHandlers(childDOM, child);
      });
    });

    // Update elements tree
    this.editor.uiManager.updateElementsTree(currentSlide.elements);
  }

  showSlideContextMenu(e, index) {
    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.cssText = `
      position: fixed;
      left: ${e.clientX}px;
      top: ${e.clientY}px;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 10000;
    `;

    const options = [
      { label: 'Duplicate', action: () => this.duplicateSlide(index) },
      { label: 'Delete', action: () => this.deleteSlide(index) }
    ];

    options.forEach(opt => {
      const item = document.createElement('div');
      item.className = 'context-menu-item';
      item.textContent = opt.label;
      item.style.cssText = `
        padding: 8px 16px;
        cursor: pointer;
      `;
      item.addEventListener('click', () => {
        opt.action();
        menu.remove();
      });
      menu.appendChild(item);
    });

    document.body.appendChild(menu);

    // Remove on click outside
    setTimeout(() => {
      document.addEventListener('click', () => menu.remove(), { once: true });
    }, 0);
  }

  duplicateSlide(index) {
    this.editor.presentation.duplicateSlide(index);
    this.editor.recordHistory();
    this.renderSlides();
  }

  deleteSlide(index) {
    if (confirm('Delete this slide?')) {
      this.editor.presentation.removeSlide(index);
      this.editor.recordHistory();
      this.renderSlides();
      this.renderCurrentSlide();
    }
  }
}
```

#### 3.3 Element Controller (`js/controllers/ElementController.js`)
Manages element operations and interactions:

```javascript
import { DragHandler } from '../interactions/DragHandler.js';
import { ResizeHandler } from '../interactions/ResizeHandler.js';
import { RotateHandler } from '../interactions/RotateHandler.js';
import { TextElement, ImageElement, VideoElement, ShapeElement } from '../models/index.js';

export class ElementController {
  constructor(editorController) {
    this.editor = editorController;
    this.selectedElement = null;
    this.dragHandler = null;
    this.resizeHandler = null;
    this.rotateHandler = null;
  }

  async init() {
    this.dragHandler = new DragHandler(this);
    this.resizeHandler = new ResizeHandler(this);
    this.rotateHandler = new RotateHandler(this);
  }

  createElement(type) {
    const ElementClass = this.getElementClass(type);
    const element = new ElementClass();

    const currentSlide = this.editor.presentation.getCurrentSlide();
    currentSlide.addElement(element);

    this.editor.slideController.renderCurrentSlide();
    this.selectElement(element);
  }

  getElementClass(type) {
    const classes = {
      text: TextElement,
      image: ImageElement,
      video: VideoElement,
      shape: ShapeElement
      // ... other types
    };
    return classes[type] || TextElement;
  }

  deleteElement(elementId) {
    const currentSlide = this.editor.presentation.getCurrentSlide();
    currentSlide.removeElement(elementId);
    this.selectedElement = null;
    this.editor.slideController.renderCurrentSlide();
  }

  selectElement(element) {
    // Deselect previous
    if (this.selectedElement) {
      const prevDOM = document.getElementById(this.selectedElement.id);
      if (prevDOM) {
        prevDOM.classList.remove('selected');
        this.removeHandles(prevDOM);
      }
    }

    // Select new
    this.selectedElement = element;
    const elementDOM = document.getElementById(element.id);
    if (elementDOM) {
      elementDOM.classList.add('selected');
      this.addHandles(elementDOM);
    }

    // Update properties panel
    this.editor.uiManager.updatePropertiesPanel(element);
  }

  deselectElement() {
    if (this.selectedElement) {
      const elementDOM = document.getElementById(this.selectedElement.id);
      if (elementDOM) {
        elementDOM.classList.remove('selected');
        this.removeHandles(elementDOM);
      }
      this.selectedElement = null;
    }
  }

  attachHandlers(elementDOM, element) {
    // Click to select
    elementDOM.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectElement(element);
    });

    // Double-click to edit (for text elements)
    if (element.type === 'text') {
      elementDOM.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.enableTextEditing(elementDOM, element);
      });
    }
  }

  addHandles(elementDOM) {
    // Add resize handles
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    handles.forEach(direction => {
      const handle = document.createElement('div');
      handle.className = `resize-handle ${direction}`;
      handle.dataset.direction = direction;
      elementDOM.appendChild(handle);

      // Attach resize handler
      this.resizeHandler.attach(handle, this.selectedElement);
    });

    // Add rotation handle
    const rotateHandle = document.createElement('div');
    rotateHandle.className = 'rotate-handle';
    elementDOM.appendChild(rotateHandle);

    // Attach rotate handler
    this.rotateHandler.attach(rotateHandle, this.selectedElement);

    // Attach drag handler to element
    this.dragHandler.attach(elementDOM, this.selectedElement);
  }

  removeHandles(elementDOM) {
    const handles = elementDOM.querySelectorAll('.resize-handle, .rotate-handle');
    handles.forEach(handle => handle.remove());
  }

  enableTextEditing(elementDOM, element) {
    const textContent = elementDOM.querySelector('.text-content');
    if (textContent) {
      textContent.focus();

      textContent.addEventListener('blur', () => {
        element.updateText(textContent.innerText);
        this.editor.recordHistory();
      }, { once: true });
    }
  }

  updateElementProperty(property, value) {
    if (!this.selectedElement) return;

    // Update element property based on path
    const paths = property.split('.');
    let target = this.selectedElement;
    for (let i = 0; i < paths.length - 1; i++) {
      target = target[paths[i]];
    }
    target[paths[paths.length - 1]] = value;

    // Re-render
    this.editor.slideController.renderCurrentSlide();
    this.selectElement(this.selectedElement);
    this.editor.recordHistory();
  }
}
```

#### 3.4 Animation Controller (`js/controllers/AnimationController.js`)
Manages animation system:

```javascript
import { applyAnimation, removeAnimation, waitForAnimation } from '../utils/animations.js';

export class AnimationController {
  constructor(editorController) {
    this.editor = editorController;
    this.playMode = false;
    this.animationQueue = [];
  }

  async init() {
    // Setup animation modal
    this.setupAnimationModal();
  }

  setupAnimationModal() {
    const modal = document.getElementById('animation-modal');
    // Setup animation editor UI
  }

  openAnimationEditor(element, mode) {
    // mode: 'in' or 'out'
    const modal = M.Modal.getInstance(document.getElementById('animation-modal'));

    // Populate modal with current animation settings
    const currentAnimation = mode === 'in' ? element.inEffect : element.outEffect;

    // ... populate form fields

    modal.open();
  }

  setAnimation(element, mode, animation) {
    if (mode === 'in') {
      element.inEffect = animation;
    } else {
      element.outEffect = animation;
    }
    this.editor.recordHistory();
    this.editor.uiManager.updateElementsTree(
      this.editor.presentation.getCurrentSlide().elements
    );
  }

  async playSlideAnimations(slide) {
    // Get all elements with inEffect
    const animatedElements = slide.elements.filter(el => el.inEffect);

    // Sort by trigger type
    const autoElements = animatedElements.filter(el =>
      el.inEffect.trigger === 'auto'
    );
    const clickElements = animatedElements.filter(el =>
      el.inEffect.trigger === 'click'
    );

    // Play auto animations first
    for (const element of autoElements) {
      await this.playElementAnimation(element, 'in');
    }

    // Setup click handlers for click-triggered animations
    let clickIndex = 0;
    const handleClick = async () => {
      if (clickIndex < clickElements.length) {
        const element = clickElements[clickIndex];
        await this.playElementAnimation(element, 'in');
        clickIndex++;
      }
    };

    document.addEventListener('click', handleClick);
  }

  async playElementAnimation(element, mode) {
    const animation = mode === 'in' ? element.inEffect : element.outEffect;
    if (!animation) return;

    const elementDOM = document.getElementById(element.id);
    if (!elementDOM) return;

    // Apply animation
    await applyAnimation(elementDOM, animation);

    // Play children animations
    for (const child of element.children) {
      await this.playElementAnimation(child, mode);
    }
  }

  enterPlayMode() {
    this.playMode = true;
    // Hide editor UI, show presentation
    this.editor.uiManager.enterPlayMode();
    this.playSlideAnimations(this.editor.presentation.getCurrentSlide());
  }

  exitPlayMode() {
    this.playMode = false;
    this.editor.uiManager.exitPlayMode();
  }
}
```

#### 3.5 Playback Controller (`js/controllers/PlaybackController.js`)
Handles presentation mode:

```javascript
export class PlaybackController {
  constructor(editorController) {
    this.editor = editorController;
    this.currentSlideIndex = 0;
    this.isPlaying = false;
  }

  start() {
    this.isPlaying = true;
    this.currentSlideIndex = 0;

    // Create fullscreen presentation view
    this.createPresentationView();

    // Enter fullscreen
    document.getElementById('presentation-view').requestFullscreen();

    // Show first slide
    this.showSlide(0);

    // Setup navigation
    this.setupNavigation();
  }

  createPresentationView() {
    let view = document.getElementById('presentation-view');
    if (!view) {
      view = document.createElement('div');
      view.id = 'presentation-view';
      view.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: black;
        z-index: 100000;
        display: none;
      `;
      document.body.appendChild(view);
    }
    view.style.display = 'flex';
    view.style.alignItems = 'center';
    view.style.justifyContent = 'center';
  }

  showSlide(index) {
    const slide = this.editor.presentation.slides[index];
    if (!slide) return;

    const view = document.getElementById('presentation-view');
    view.innerHTML = '';

    // Create slide container
    const slideContainer = document.createElement('div');
    slideContainer.style.cssText = `
      width: 1280px;
      height: 720px;
      background: ${slide.background};
      position: relative;
    `;

    // Render elements
    slide.elements.forEach(element => {
      const elementDOM = element.render();
      slideContainer.appendChild(elementDOM);

      // Initially hide elements with inEffect
      if (element.inEffect) {
        elementDOM.style.opacity = '0';
      }

      // Render children
      element.children.forEach(child => {
        const childDOM = child.render();
        if (child.inEffect) {
          childDOM.style.opacity = '0';
        }
        elementDOM.appendChild(childDOM);
      });
    });

    view.appendChild(slideContainer);

    // Play animations
    this.editor.animationController.playSlideAnimations(slide);
  }

  setupNavigation() {
    document.addEventListener('keydown', (e) => {
      if (!this.isPlaying) return;

      if (e.key === 'ArrowRight' || e.key === ' ') {
        this.nextSlide();
      } else if (e.key === 'ArrowLeft') {
        this.previousSlide();
      } else if (e.key === 'Escape') {
        this.stop();
      }
    });
  }

  nextSlide() {
    if (this.currentSlideIndex < this.editor.presentation.slides.length - 1) {
      this.currentSlideIndex++;
      this.showSlide(this.currentSlideIndex);
    } else {
      this.stop();
    }
  }

  previousSlide() {
    if (this.currentSlideIndex > 0) {
      this.currentSlideIndex--;
      this.showSlide(this.currentSlideIndex);
    }
  }

  stop() {
    this.isPlaying = false;
    document.exitFullscreen();
    const view = document.getElementById('presentation-view');
    if (view) {
      view.style.display = 'none';
    }
  }
}
```

---

### Phase 4: Interaction Handlers
**Goal:** Implement drag, resize, and rotate interactions

#### 4.1 Drag Handler (`js/interactions/DragHandler.js`)
```javascript
import { AlignmentGuides } from './AlignmentGuides.js';

export class DragHandler {
  constructor(elementController) {
    this.elementController = elementController;
    this.alignmentGuides = new AlignmentGuides();
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.elementStart = { x: 0, y: 0 };
  }

  attach(elementDOM, element) {
    elementDOM.addEventListener('mousedown', (e) => {
      // Don't drag if clicking on handles
      if (e.target.classList.contains('resize-handle') ||
          e.target.classList.contains('rotate-handle')) {
        return;
      }

      // Don't drag if editing text
      if (e.target.contentEditable === 'true') {
        return;
      }

      this.startDrag(e, elementDOM, element);
    });
  }

  startDrag(e, elementDOM, element) {
    e.preventDefault();
    this.isDragging = true;

    elementDOM.classList.add('dragging');

    this.dragStart = { x: e.clientX, y: e.clientY };
    this.elementStart = { x: element.position.x, y: element.position.y };

    const canvas = document.getElementById('slide-canvas');
    const canvasRect = canvas.getBoundingClientRect();

    const onMouseMove = (e) => {
      if (!this.isDragging) return;

      const dx = e.clientX - this.dragStart.x;
      const dy = e.clientY - this.dragStart.y;

      // Calculate new position relative to canvas
      let newX = this.elementStart.x + dx;
      let newY = this.elementStart.y + dy;

      // Constrain to canvas
      newX = Math.max(0, Math.min(newX, canvasRect.width - element.position.width));
      newY = Math.max(0, Math.min(newY, canvasRect.height - element.position.height));

      // Update position
      element.updatePosition({ x: newX, y: newY });
      elementDOM.style.left = newX + 'px';
      elementDOM.style.top = newY + 'px';

      // Show alignment guides
      this.alignmentGuides.update(element, canvas);
    };

    const onMouseUp = () => {
      this.isDragging = false;
      elementDOM.classList.remove('dragging');
      this.alignmentGuides.hide();
      this.elementController.editor.recordHistory();

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
}
```

#### 4.2 Resize Handler (`js/interactions/ResizeHandler.js`)
```javascript
export class ResizeHandler {
  constructor(elementController) {
    this.elementController = elementController;
    this.isResizing = false;
  }

  attach(handleDOM, element) {
    handleDOM.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.startResize(e, handleDOM, element);
    });
  }

  startResize(e, handleDOM, element) {
    e.preventDefault();
    this.isResizing = true;

    const direction = handleDOM.dataset.direction;
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...element.position };

    // Check if CTRL is pressed for aspect ratio lock
    const lockAspectRatio = e.ctrlKey || (element.properties.aspectRatio !== null);
    const aspectRatio = element.properties.aspectRatio || (startPos.width / startPos.height);

    const onMouseMove = (e) => {
      if (!this.isResizing) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newWidth = startPos.width;
      let newHeight = startPos.height;
      let newX = startPos.x;
      let newY = startPos.y;

      // Calculate new dimensions based on direction
      switch (direction) {
        case 'se': // Bottom-right
          newWidth = startPos.width + dx;
          newHeight = lockAspectRatio ? newWidth / aspectRatio : startPos.height + dy;
          break;
        case 'sw': // Bottom-left
          newWidth = startPos.width - dx;
          newHeight = lockAspectRatio ? newWidth / aspectRatio : startPos.height + dy;
          newX = startPos.x + dx;
          break;
        case 'ne': // Top-right
          newWidth = startPos.width + dx;
          newHeight = lockAspectRatio ? newWidth / aspectRatio : startPos.height - dy;
          newY = lockAspectRatio ? startPos.y + (startPos.height - newHeight) : startPos.y + dy;
          break;
        case 'nw': // Top-left
          newWidth = startPos.width - dx;
          newHeight = lockAspectRatio ? newWidth / aspectRatio : startPos.height - dy;
          newX = startPos.x + dx;
          newY = lockAspectRatio ? startPos.y + (startPos.height - newHeight) : startPos.y + dy;
          break;
        case 'e': // Right
          newWidth = startPos.width + dx;
          if (lockAspectRatio) {
            newHeight = newWidth / aspectRatio;
          }
          break;
        case 'w': // Left
          newWidth = startPos.width - dx;
          newX = startPos.x + dx;
          if (lockAspectRatio) {
            newHeight = newWidth / aspectRatio;
          }
          break;
        case 'n': // Top
          newHeight = startPos.height - dy;
          newY = startPos.y + dy;
          if (lockAspectRatio) {
            newWidth = newHeight * aspectRatio;
          }
          break;
        case 's': // Bottom
          newHeight = startPos.height + dy;
          if (lockAspectRatio) {
            newWidth = newHeight * aspectRatio;
          }
          break;
      }

      // Minimum size constraints
      newWidth = Math.max(20, newWidth);
      newHeight = Math.max(20, newHeight);

      // Update element
      element.updatePosition({
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight
      });

      const elementDOM = document.getElementById(element.id);
      elementDOM.style.left = newX + 'px';
      elementDOM.style.top = newY + 'px';
      elementDOM.style.width = newWidth + 'px';
      elementDOM.style.height = newHeight + 'px';
    };

    const onMouseUp = () => {
      this.isResizing = false;
      this.elementController.editor.recordHistory();

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
}
```

#### 4.3 Rotate Handler (`js/interactions/RotateHandler.js`)
```javascript
export class RotateHandler {
  constructor(elementController) {
    this.elementController = elementController;
    this.isRotating = false;
  }

  attach(handleDOM, element) {
    handleDOM.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.startRotate(e, element);
    });
  }

  startRotate(e, element) {
    e.preventDefault();
    this.isRotating = true;

    const elementDOM = document.getElementById(element.id);
    const rect = elementDOM.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const startRotation = element.position.rotation;

    const onMouseMove = (e) => {
      if (!this.isRotating) return;

      const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      const deltaAngle = (currentAngle - startAngle) * (180 / Math.PI);

      let newRotation = startRotation + deltaAngle;

      // Snap to 15-degree increments if Shift is pressed
      if (e.shiftKey) {
        newRotation = Math.round(newRotation / 15) * 15;
      }

      element.updatePosition({ rotation: newRotation });
      elementDOM.style.transform = `rotate(${newRotation}deg)`;
    };

    const onMouseUp = () => {
      this.isRotating = false;
      this.elementController.editor.recordHistory();

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
}
```

#### 4.4 Alignment Guides (`js/interactions/AlignmentGuides.js`)
```javascript
export class AlignmentGuides {
  constructor() {
    this.guides = [];
    this.threshold = 5; // Snap threshold in pixels
  }

  update(draggedElement, canvas) {
    this.hide();

    const currentSlide = canvas.querySelector('.slide-canvas');
    const otherElements = Array.from(currentSlide.children)
      .filter(el => el.id !== draggedElement.id && el.classList.contains('element'));

    const draggedRect = {
      left: draggedElement.position.x,
      right: draggedElement.position.x + draggedElement.position.width,
      top: draggedElement.position.y,
      bottom: draggedElement.position.y + draggedElement.position.height,
      centerX: draggedElement.position.x + draggedElement.position.width / 2,
      centerY: draggedElement.position.y + draggedElement.position.height / 2
    };

    otherElements.forEach(otherDOM => {
      const other = this.getElementFromDOM(otherDOM);
      if (!other) return;

      const otherRect = {
        left: other.position.x,
        right: other.position.x + other.position.width,
        top: other.position.y,
        bottom: other.position.y + other.position.height,
        centerX: other.position.x + other.position.width / 2,
        centerY: other.position.y + other.position.height / 2
      };

      // Check horizontal alignment
      if (Math.abs(draggedRect.left - otherRect.left) < this.threshold) {
        this.showGuide('vertical', otherRect.left);
      }
      if (Math.abs(draggedRect.right - otherRect.right) < this.threshold) {
        this.showGuide('vertical', otherRect.right);
      }
      if (Math.abs(draggedRect.centerX - otherRect.centerX) < this.threshold) {
        this.showGuide('vertical', otherRect.centerX);
      }

      // Check vertical alignment
      if (Math.abs(draggedRect.top - otherRect.top) < this.threshold) {
        this.showGuide('horizontal', otherRect.top);
      }
      if (Math.abs(draggedRect.bottom - otherRect.bottom) < this.threshold) {
        this.showGuide('horizontal', otherRect.bottom);
      }
      if (Math.abs(draggedRect.centerY - otherRect.centerY) < this.threshold) {
        this.showGuide('horizontal', otherRect.centerY);
      }
    });
  }

  showGuide(type, position) {
    const guide = document.createElement('div');
    guide.className = `alignment-guide ${type}`;

    if (type === 'vertical') {
      guide.style.left = position + 'px';
    } else {
      guide.style.top = position + 'px';
    }

    const canvas = document.getElementById('slide-canvas');
    canvas.appendChild(guide);
    this.guides.push(guide);
  }

  hide() {
    this.guides.forEach(guide => guide.remove());
    this.guides = [];
  }

  getElementFromDOM(elementDOM) {
    // Get element from current slide by ID
    const editor = window.app?.editor;
    if (!editor) return null;

    const currentSlide = editor.presentation.getCurrentSlide();
    return currentSlide.getElement(elementDOM.id);
  }
}
```

---

### Phase 5: View Components and UI Management
**Goal:** Implement UI views and state management

#### 5.1 UI Manager (`js/views/UIManager.js`)
```javascript
import { LeftSidebar } from './LeftSidebar.js';
import { RightSidebar } from './RightSidebar.js';
import { Toolbar } from './Toolbar.js';
import { StatusBar } from './StatusBar.js';
import { ElementsTree } from './ElementsTree.js';

export class UIManager {
  constructor() {
    this.leftSidebar = null;
    this.rightSidebar = null;
    this.toolbar = null;
    this.statusBar = null;
    this.elementsTree = null;
  }

  async init() {
    this.leftSidebar = new LeftSidebar();
    this.rightSidebar = new RightSidebar();
    this.toolbar = new Toolbar();
    this.statusBar = new StatusBar();
    this.elementsTree = new ElementsTree();

    await this.leftSidebar.init();
    await this.rightSidebar.init();
    await this.toolbar.init();
    await this.statusBar.init();
    await this.elementsTree.init();
  }

  updateStatusBar(currentSlide, totalSlides) {
    this.statusBar.update(currentSlide, totalSlides);
  }

  updatePropertiesPanel(element) {
    this.rightSidebar.updateProperties(element);
  }

  updateElementsTree(elements) {
    this.elementsTree.render(elements);
  }

  handleResize() {
    // Handle window resize
    const canvas = document.getElementById('slide-canvas');
    // Scale canvas to fit
  }

  enterPlayMode() {
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('top-menu').style.display = 'none';
    document.getElementById('status-bar').style.display = 'none';
  }

  exitPlayMode() {
    document.getElementById('app-container').style.display = 'flex';
    document.getElementById('top-menu').style.display = 'block';
    document.getElementById('status-bar').style.display = 'flex';
  }
}
```

#### 5.2 Elements Tree View (`js/views/ElementsTree.js`)
```javascript
export class ElementsTree {
  async init() {
    this.container = document.getElementById('elements-tree');
  }

  render(elements) {
    this.container.innerHTML = '';

    elements.forEach(element => {
      const item = this.createTreeItem(element, 0);
      this.container.appendChild(item);

      // Render children
      element.children.forEach(child => {
        const childItem = this.createTreeItem(child, 1);
        this.container.appendChild(childItem);
      });
    });
  }

  createTreeItem(element, level) {
    const item = document.createElement('div');
    item.className = `tree-item level-${level}`;
    item.dataset.elementId = element.id;

    // In button
    const inBtn = document.createElement('button');
    inBtn.className = `animation-btn ${element.inEffect ? 'active' : ''}`;
    inBtn.innerHTML = 'IN';
    inBtn.title = 'Set in animation';
    inBtn.addEventListener('click', () => {
      this.openAnimationEditor(element, 'in');
    });

    // Out button
    const outBtn = document.createElement('button');
    outBtn.className = `animation-btn ${element.outEffect ? 'active' : ''}`;
    outBtn.innerHTML = 'OUT';
    outBtn.title = 'Set out animation';
    outBtn.addEventListener('click', () => {
      this.openAnimationEditor(element, 'out');
    });

    // Element name
    const name = document.createElement('span');
    name.textContent = this.getElementName(element);

    item.appendChild(inBtn);
    item.appendChild(outBtn);
    item.appendChild(name);

    // Click to select element
    item.addEventListener('click', (e) => {
      if (e.target === item || e.target === name) {
        window.app.editor.elementController.selectElement(element);
      }
    });

    return item;
  }

  getElementName(element) {
    switch (element.type) {
      case 'text':
        return element.properties.text?.substring(0, 20) || 'Text';
      case 'image':
        return 'Image';
      case 'video':
        return 'Video';
      case 'shape':
        return `Shape (${element.properties.shapeType})`;
      default:
        return element.type;
    }
  }

  openAnimationEditor(element, mode) {
    window.app.editor.animationController.openAnimationEditor(element, mode);
  }
}
```

#### 5.3 Right Sidebar - Properties Panel (`js/views/RightSidebar.js`)
```javascript
export class RightSidebar {
  async init() {
    this.slideTab = document.getElementById('tab-slide');
    this.elementTab = document.getElementById('tab-element');
    this.animationTab = document.getElementById('tab-animation');
  }

  updateProperties(element) {
    if (!element) {
      this.elementTab.innerHTML = '<p class="grey-text">No element selected</p>';
      return;
    }

    this.elementTab.innerHTML = '';

    // Create property fields based on element type
    this.addPositionProperties(element);

    switch (element.type) {
      case 'text':
        this.addTextProperties(element);
        break;
      case 'image':
      case 'video':
        this.addMediaProperties(element);
        break;
      case 'shape':
        this.addShapeProperties(element);
        break;
    }
  }

  addPositionProperties(element) {
    const section = this.createSection('Position');

    section.appendChild(this.createNumberInput('X', element.position.x, (val) => {
      window.app.editor.elementController.updateElementProperty('position.x', parseFloat(val));
    }));

    section.appendChild(this.createNumberInput('Y', element.position.y, (val) => {
      window.app.editor.elementController.updateElementProperty('position.y', parseFloat(val));
    }));

    section.appendChild(this.createNumberInput('Width', element.position.width, (val) => {
      window.app.editor.elementController.updateElementProperty('position.width', parseFloat(val));
    }));

    section.appendChild(this.createNumberInput('Height', element.position.height, (val) => {
      window.app.editor.elementController.updateElementProperty('position.height', parseFloat(val));
    }));

    section.appendChild(this.createNumberInput('Rotation', element.position.rotation, (val) => {
      window.app.editor.elementController.updateElementProperty('position.rotation', parseFloat(val));
    }));

    this.elementTab.appendChild(section);
  }

  addTextProperties(element) {
    const section = this.createSection('Text');

    section.appendChild(this.createSelect('Font Family', element.properties.font.family,
      ['Roboto', 'Arial', 'Times New Roman', 'Courier New', 'Georgia'],
      (val) => {
        window.app.editor.elementController.updateElementProperty('properties.font.family', val);
      }
    ));

    section.appendChild(this.createNumberInput('Font Size', element.properties.font.size, (val) => {
      window.app.editor.elementController.updateElementProperty('properties.font.size', parseInt(val));
    }));

    section.appendChild(this.createColorInput('Color', element.properties.font.color, (val) => {
      window.app.editor.elementController.updateElementProperty('properties.font.color', val);
    }));

    section.appendChild(this.createSelect('Alignment', element.properties.font.alignment,
      ['left', 'center', 'right', 'justify'],
      (val) => {
        window.app.editor.elementController.updateElementProperty('properties.font.alignment', val);
      }
    ));

    this.elementTab.appendChild(section);
  }

  addMediaProperties(element) {
    const section = this.createSection('Media');

    section.appendChild(this.createTextInput('URL', element.properties.url, (val) => {
      window.app.editor.elementController.updateElementProperty('properties.url', val);
    }));

    this.elementTab.appendChild(section);
  }

  addShapeProperties(element) {
    const section = this.createSection('Shape');

    section.appendChild(this.createSelect('Shape Type', element.properties.shapeType,
      ['rectangle', 'circle', 'triangle'],
      (val) => {
        window.app.editor.elementController.updateElementProperty('properties.shapeType', val);
      }
    ));

    section.appendChild(this.createColorInput('Fill Color', element.properties.fillColor, (val) => {
      window.app.editor.elementController.updateElementProperty('properties.fillColor', val);
    }));

    section.appendChild(this.createColorInput('Stroke Color', element.properties.strokeColor, (val) => {
      window.app.editor.elementController.updateElementProperty('properties.strokeColor', val);
    }));

    this.elementTab.appendChild(section);
  }

  // Helper methods to create form inputs
  createSection(title) {
    const section = document.createElement('div');
    section.className = 'property-section';

    const heading = document.createElement('h6');
    heading.textContent = title;
    section.appendChild(heading);

    return section;
  }

  createNumberInput(label, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'input-field';

    const input = document.createElement('input');
    input.type = 'number';
    input.value = value;
    input.id = `prop-${label.toLowerCase().replace(' ', '-')}`;

    const labelEl = document.createElement('label');
    labelEl.setAttribute('for', input.id);
    labelEl.textContent = label;
    labelEl.classList.add('active');

    input.addEventListener('change', (e) => onChange(e.target.value));

    wrapper.appendChild(input);
    wrapper.appendChild(labelEl);

    return wrapper;
  }

  createTextInput(label, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'input-field';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.id = `prop-${label.toLowerCase().replace(' ', '-')}`;

    const labelEl = document.createElement('label');
    labelEl.setAttribute('for', input.id);
    labelEl.textContent = label;
    labelEl.classList.add('active');

    input.addEventListener('change', (e) => onChange(e.target.value));

    wrapper.appendChild(input);
    wrapper.appendChild(labelEl);

    return wrapper;
  }

  createColorInput(label, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'input-field';

    const input = document.createElement('input');
    input.type = 'color';
    input.value = value;
    input.id = `prop-${label.toLowerCase().replace(' ', '-')}`;

    const labelEl = document.createElement('label');
    labelEl.setAttribute('for', input.id);
    labelEl.textContent = label;
    labelEl.classList.add('active');

    input.addEventListener('change', (e) => onChange(e.target.value));

    wrapper.appendChild(input);
    wrapper.appendChild(labelEl);

    return wrapper;
  }

  createSelect(label, value, options, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'input-field';

    const select = document.createElement('select');
    select.id = `prop-${label.toLowerCase().replace(' ', '-')}`;

    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      option.selected = opt === value;
      select.appendChild(option);
    });

    const labelEl = document.createElement('label');
    labelEl.textContent = label;

    select.addEventListener('change', (e) => onChange(e.target.value));

    wrapper.appendChild(select);
    wrapper.appendChild(labelEl);

    // Initialize Materialize select
    setTimeout(() => M.FormSelect.init(select), 0);

    return wrapper;
  }
}
```

---

### Phase 6: Utility Modules
**Goal:** Implement utility functions for animations, storage, and DOM manipulation

#### 6.1 Animation Utilities (`js/utils/animations.js`)
```javascript
import { AnimationType, SlideDirection } from './constants.js';

/**
 * Apply animation to an element
 */
export const applyAnimation = (element, animation, options = {}) => {
  return new Promise((resolve) => {
    // Remove existing animations
    removeAnimation(element);

    // Add base animated class
    element.classList.add('wow-animated');

    // Apply duration
    const duration = animation.duration || 600;
    element.style.animationDuration = `${duration}ms`;

    // Apply delay if specified
    if (options.delay) {
      element.style.animationDelay = `${options.delay}ms`;
    }

    // Apply easing
    if (options.easing) {
      element.classList.add(`wow-ease-${options.easing}`);
    }

    // Apply animation type classes
    const animationClasses = getAnimationClasses(animation.type, options.direction);
    animationClasses.forEach(cls => element.classList.add(cls));

    // Make element visible
    element.style.opacity = '1';

    // Wait for animation to complete
    const handler = () => {
      element.removeEventListener('animationend', handler);
      resolve();
    };
    element.addEventListener('animationend', handler);
  });
};

/**
 * Remove all animation classes
 */
export const removeAnimation = (element) => {
  const classes = Array.from(element.classList).filter(cls => cls.startsWith('wow-'));
  classes.forEach(cls => element.classList.remove(cls));
  element.style.animationDuration = '';
  element.style.animationDelay = '';
};

/**
 * Wait for animation to complete
 */
export const waitForAnimation = (element) => {
  return new Promise((resolve) => {
    const handler = () => {
      element.removeEventListener('animationend', handler);
      resolve();
    };
    element.addEventListener('animationend', handler);
  });
};

/**
 * Play animation sequence
 */
export const playAnimationSequence = async (animations, sequential = false) => {
  if (sequential) {
    for (const anim of animations) {
      await applyAnimation(anim.element, anim.animation, anim.options);
    }
  } else {
    await Promise.all(
      animations.map(anim => applyAnimation(anim.element, anim.animation, anim.options))
    );
  }
};

/**
 * Get CSS classes for animation type
 */
const getAnimationClasses = (type, direction) => {
  const classes = [];

  if (type & AnimationType.FADE_IN) {
    classes.push('wow-fade-in');
  }
  if (type & AnimationType.FADE_OUT) {
    classes.push('wow-fade-out');
  }
  if (type & AnimationType.SLIDE_IN) {
    classes.push(`wow-slide-in-${direction || SlideDirection.LEFT}`);
  }
  if (type & AnimationType.SLIDE_OUT) {
    classes.push(`wow-slide-out-${direction || SlideDirection.LEFT}`);
  }
  if (type & AnimationType.ZOOM_IN) {
    classes.push('wow-zoom-in');
  }
  if (type & AnimationType.ZOOM_OUT) {
    classes.push('wow-zoom-out');
  }

  return classes;
};

/**
 * Animation presets
 */
export const AnimationPresets = {
  quickFadeIn: () => ({
    type: AnimationType.FADE_IN,
    duration: 300,
    trigger: 'auto'
  }),

  slideInBounce: (direction = SlideDirection.LEFT) => ({
    type: AnimationType.SLIDE_IN,
    duration: 600,
    trigger: 'auto',
    options: { direction, easing: 'ease-out-back' }
  }),

  dramaticZoomIn: () => ({
    type: AnimationType.ZOOM_IN,
    duration: 800,
    trigger: 'auto'
  }),

  fadeZoomIn: () => ({
    type: AnimationType.FADE_IN | AnimationType.ZOOM_IN,
    duration: 600,
    trigger: 'auto'
  })
};
```

#### 6.2 Storage Utilities (`js/utils/storage.js`)
```javascript
const STORAGE_KEY_PREFIX = 'wow3_';

/**
 * Save presentation to localStorage
 */
export const savePresentation = (presentation) => {
  try {
    const data = JSON.stringify(presentation.toJSON());
    localStorage.setItem(STORAGE_KEY_PREFIX + presentation.id, data);
    localStorage.setItem(STORAGE_KEY_PREFIX + 'current_presentation', data);
    return true;
  } catch (e) {
    console.error('Failed to save presentation:', e);
    return false;
  }
};

/**
 * Load presentation from localStorage
 */
export const loadPresentation = (id) => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_PREFIX + id);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to load presentation:', e);
    return null;
  }
};

/**
 * Get all saved presentations
 */
export const getAllPresentations = () => {
  const presentations = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(STORAGE_KEY_PREFIX) && key !== STORAGE_KEY_PREFIX + 'current_presentation') {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        presentations.push({
          id: data.id,
          title: data.title,
          modified: data.metadata.modified
        });
      } catch (e) {
        console.error('Failed to parse presentation:', e);
      }
    }
  }

  return presentations;
};

/**
 * Delete presentation
 */
export const deletePresentation = (id) => {
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + id);
    return true;
  } catch (e) {
    console.error('Failed to delete presentation:', e);
    return false;
  }
};

/**
 * Export presentation as JSON file
 */
export const exportPresentation = (presentation) => {
  const data = JSON.stringify(presentation.toJSON(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${presentation.title}.wow3.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Import presentation from JSON file
 */
export const importPresentation = () => {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.wow3.json';

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });

    input.click();
  });
};
```

#### 6.3 DOM Utilities (`js/utils/dom.js`)
```javascript
/**
 * Generate unique ID
 */
export const generateId = (prefix = 'id') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create element with attributes
 */
export const createElement = (tag, attributes = {}, children = []) => {
  const element = document.createElement(tag);

  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else {
      element.setAttribute(key, value);
    }
  });

  children.forEach(child => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  });

  return element;
};

/**
 * Get element position relative to parent
 */
export const getRelativePosition = (element, parent) => {
  const elementRect = element.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();

  return {
    x: elementRect.left - parentRect.left,
    y: elementRect.top - parentRect.top
  };
};

/**
 * Check if point is inside element
 */
export const isPointInElement = (x, y, element) => {
  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
};

/**
 * Debounce function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};
```

---

### Phase 7: Testing and Verification

#### 7.1 Manual Testing Checklist

**Presentation Management:**
- [ ] Create new presentation
- [ ] Save presentation to localStorage
- [ ] Load saved presentation
- [ ] Export presentation as JSON
- [ ] Import presentation from JSON
- [ ] Auto-save works every 30 seconds

**Slide Operations:**
- [ ] Add new slide
- [ ] Delete slide (with confirmation)
- [ ] Duplicate slide
- [ ] Reorder slides via drag-drop
- [ ] Navigate between slides
- [ ] Slide thumbnails update correctly

**Element Creation:**
- [ ] Add text element
- [ ] Add image element
- [ ] Add video element
- [ ] Add audio element
- [ ] Add shape element (rectangle, circle)
- [ ] Add list element
- [ ] Add link element

**Element Interactions:**
- [ ] Select element by clicking
- [ ] Drag element to reposition
- [ ] Resize element using corner handles
- [ ] Resize with CTRL maintains aspect ratio (images/videos)
- [ ] Rotate element using rotation handle
- [ ] Alignment guides appear during drag
- [ ] Delete element with Delete/Backspace key
- [ ] Edit text by double-clicking

**Element Properties:**
- [ ] Update position (x, y, width, height, rotation)
- [ ] Update text properties (font, size, color, alignment)
- [ ] Update image URL
- [ ] Update video URL
- [ ] Update shape properties (type, fill, stroke)
- [ ] Properties panel reflects selected element

**Element Hierarchy:**
- [ ] Add child element to parent (max 1 level)
- [ ] Cannot add grandchildren (enforced)
- [ ] Elements tree displays hierarchy correctly
- [ ] Parent and children appear together in Play Mode

**Animation System:**
- [ ] Set "in" effect for element
- [ ] Set "out" effect for element
- [ ] Animation modal shows current settings
- [ ] Combine multiple animation types (bitwise)
- [ ] Set animation trigger (click/auto)
- [ ] Set animation duration and direction
- [ ] Elements tree shows animation indicators

**Playback Mode:**
- [ ] Enter fullscreen presentation mode
- [ ] Elements with "in" effects animate correctly
- [ ] Click-triggered animations wait for click
- [ ] Auto-triggered animations play immediately
- [ ] Navigate slides with arrow keys
- [ ] Exit with Escape key
- [ ] Animations respect `prefers-reduced-motion`

**Keyboard Shortcuts:**
- [ ] Ctrl+S saves presentation
- [ ] Ctrl+Z undo
- [ ] Ctrl+Y redo
- [ ] Delete/Backspace removes selected element
- [ ] Escape exits play mode

**UI/UX:**
- [ ] MaterializeCSS components work (tabs, modals, dropdowns)
- [ ] Responsive layout adjusts to window size
- [ ] Status bar shows correct slide count
- [ ] Toast notifications for save/error
- [ ] Context menu for slides (right-click)
- [ ] Unsaved changes warning on exit

**Performance:**
- [ ] Smooth drag interactions
- [ ] No lag with 10+ elements
- [ ] Animations are hardware-accelerated
- [ ] No memory leaks during long sessions

#### 7.2 Browser Testing
Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

#### 7.3 Known Limitations
- Maximum 2 levels of element nesting (parent-child only)
- localStorage has ~5-10MB limit (consider IndexedDB for larger presentations)
- No collaborative editing (single-user only)
- No cloud sync (local storage only)

---

## Deployment Instructions

### Production Build
1. Combine and minify CSS files
2. Combine and minify JavaScript files
3. Optimize images and assets
4. Generate service worker for offline support

### Hosting
Upload to any static hosting service:
- GitHub Pages
- Netlify
- Vercel
- AWS S3
- Firebase Hosting

### Progressive Web App (Optional)
Add `manifest.json` and service worker for PWA capabilities:
```json
{
  "name": "WOW3 Presentation",
  "short_name": "WOW3",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2196F3",
  "icons": [...]
}
```

---

## Next Steps After Implementation

1. **Add More Element Types:**
   - Tables
   - Charts/Graphs
   - Code blocks
   - Embedded content (iframes)

2. **Advanced Features:**
   - Slide transitions
   - Master slides/templates
   - Themes and color schemes
   - Presenter notes
   - Slide timing

3. **Collaboration:**
   - Export to PDF
   - Share presentations via URL
   - Real-time collaboration

4. **Accessibility:**
   - Screen reader support
   - Keyboard-only navigation
   - High contrast mode

---

## Implementation Priority

**Phase 1-3:** Core foundation (HTML, CSS, Models, Controllers) - **Critical**
**Phase 4:** Interactions (Drag, Resize, Rotate) - **Critical**
**Phase 5:** UI Components - **High Priority**
**Phase 6:** Utilities and Animations - **High Priority**
**Phase 7:** Testing and Polish - **Medium Priority**

Estimated implementation time: **40-60 hours** for a single developer following this plan.

---

## Summary

This plan provides a complete roadmap for building WOW3 presentation software using plain HTML, JavaScript, and CSS3. The architecture follows MVC patterns with:

- **Models:** Data structures for Presentation, Slide, and Elements
- **Controllers:** Business logic for editing, animations, and playback
- **Views:** UI components and state management
- **Interactions:** Drag, resize, rotate handlers
- **Utilities:** Animations, storage, DOM helpers

The implementation is modular, maintainable, and follows modern JavaScript best practices. MaterializeCSS provides a professional UI foundation, while the custom animation system offers comprehensive CSS3-based animations with hardware acceleration.

---

**End of Plan**

This plan should be copied to `/home/fabio/dev/projects/wow3/PLAN.md` when ready to implement.
