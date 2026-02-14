# WOW3 - Web-based Presentation Software

A powerful, browser-based presentation editor similar to Apple Keynote, built with HTML, JavaScript (ES6+ modules), and CSS3. No build process required.

## Features

### Presentation Management
- Create, save, load presentations
- Browse saved presentations via Presentation Manager with thumbnails, search, and date grouping
- Import/export presentations as self-contained `.wow3` ZIP files (media embedded) or legacy JSON
- Auto-save snapshots every 30 seconds (localStorage) with permanent saves to IndexedDB
- Undo/redo with 50-state history
- Editable presentation title in the navbar

### Slide Operations
- Add, delete, duplicate slides
- Drag-drop slide reordering
- Live slide thumbnails via html2canvas (debounced capture, persisted in IndexedDB)
- Custom backgrounds
- Slide navigation
- Slide name shown on thumbnail hover, inline rename on click
- Slide templates: 6 built-in layouts + user-saved templates stored in IndexedDB
- Shell page: persistent element layer rendered on every slide (above or below), with dedicated editing mode

### Element Types
- **Text:** Rich formatting, fonts, colors, alignment
- **Image:** Aspect ratio preservation, object-fit controls, clip shapes (circle, rectangle), crop mode
- **Video:** YouTube embed support (privacy-friendly), direct URLs, MediaDB links, clip shapes, crop mode
- **Audio:** Audio playback with controls (autoplay, loop, muted)
- **Shape:** Rectangle, circle, triangle with fill/stroke
- **List:** Ordered and unordered lists
- **Link:** Clickable buttons with custom styling
- **Countdown Timer:** Cross-slide persistent timer with configurable duration, completion sound, and global style sync

### Element Interactions
- Drag elements with mouse
- 8-directional resize handles
- Aspect ratio locking (Ctrl or automatic for images/videos)
- Free rotation with snap-to-angle (Shift for 15-degree increments)
- Magnetic snap guides (element-to-element and canvas edge/center snapping)
- Multi-element selection via marquee (rubber-band) or Ctrl+Click
- Multi-element drag, delete, copy, cut, paste, duplicate
- Copy, paste, duplicate with cascading offset
- Z-index control (bring to front, send to back)
- Parent-child relationships (1 level deep)
- Double-click crop mode for images and videos (side handles for framing, corner handles for content scaling)
- Double-click empty image/video opens Media Manager for quick assignment
- Drag-and-drop files from the file system onto the canvas (auto-detect type, auto-resize)

### Animation System (WAAPI)
- 20+ Web Animations API (WAAPI) keyframe animations
- Animation types: Fade, Slide, Zoom, Flip, Bounce, Rotate
- 4 trigger types: onLoad, onClick, afterPrevious, withPrevious
- Custom duration, direction, easing
- Slide-level animation sequence (ordered list per slide)
- Elements Control Center floating panel with Sequence, Anim, and Elements tabs
- Drag-and-drop reorder of animation sequence
- Animation preview in editor
- Transform preservation (element rotation injected into keyframes)
- Auto-migration from legacy CSS-based animations

### Media Management
- IndexedDB-based media storage (binary blobs, not base64)
- Media Manager modal for browsing, previewing, and deleting media
- File upload via property panel or drag-and-drop
- SHA-256 content hashing for automatic deduplication
- Auto-resize images to natural dimensions (scaled to fit canvas)
- Portable export: media embedded in `.wow3` ZIP files

### Presentation Mode
- Fullscreen presentation playback
- Keyboard and click navigation
- Animation sequencing with skip support
- Click-triggered animations advance with next-slide keys
- Slide counter indicator
- Cross-slide countdown timer with live display and completion sound
- Shell page rendering (above or below slide content)

## Quick Start

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- No build process required

### Running Locally

1. Clone the repository:
```bash
git clone <repository-url>
cd wow3
```

2. Serve the files with any static server:
```bash
# Using Python
python -m http.server 8000

# Or using Node.js
npx http-server

# Or just open the file directly
open index.html
```

3. Start creating presentations.

## Keyboard Shortcuts

### General

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save presentation |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+C` | Copy selected element(s) |
| `Ctrl+X` | Cut selected element(s) |
| `Ctrl+V` | Paste element(s) |
| `Ctrl+D` | Duplicate selected element(s) |
| `Delete/Backspace` | Delete selected element(s) |
| `F5` | Play presentation |
| `Escape` | Exit presentation / Deselect / Exit crop mode |

### Presentation Mode

| Shortcut | Action |
|----------|--------|
| `Arrow Right/Left` | Advance (next animation or slide) |
| `Space` | Advance (next animation or slide) |
| `PageDown` | Advance (next animation or slide) |
| `PageUp` | Previous slide |
| `Home` | First slide |
| `End` | Last slide |
| `Escape` | Stop playback |
| `Click` | Advance (next animation or slide) |

### Element Manipulation

| Shortcut | Action |
|----------|--------|
| `Click` | Select element |
| `Ctrl+Click` | Toggle element in multi-selection |
| `Click+Drag (canvas)` | Marquee selection |
| `Double-click` | Edit text / Enter crop mode (image/video) / Open Media Manager (empty media) |
| `Drag` | Move element(s) |
| `Drag handle` | Resize element |
| `Ctrl+Drag handle` | Maintain aspect ratio while resizing |
| `Shift+Rotate` | Snap to 15-degree increments |

## Project Structure

```
wow3/
├── index.html                          # Main application
├── LICENSE                             # MIT License
├── .gitignore
├── css/
│   ├── main.css                        # Application layout
│   ├── editor.css                      # Canvas and element styles
│   ├── sidebar.css                     # Sidebar styles
│   ├── panels.css                      # Property panel styles
│   ├── components.css                  # Reusable components
│   ├── dialog.css                      # Dialog system
│   ├── animation-editor.css            # Animation editor panel
│   ├── media-manager.css               # Media Manager modal
│   ├── presentation-manager.css        # Presentation Manager modal
│   ├── template-manager.css            # Template Manager modal
│   └── countdown-timer.css             # Countdown timer element
├── js/
│   ├── app.js                          # Application bootstrap
│   ├── index.js                        # Module index
│   ├── animations/                     # WAAPI animation engine
│   │   ├── definitions.js              # Keyframe registry and categories
│   │   ├── AnimationManager.js         # Playback engine
│   │   └── migration.js               # Legacy format converter
│   ├── controllers/
│   │   ├── EditorController.js         # Main coordinator
│   │   ├── SlideController.js          # Slide management
│   │   ├── ElementController.js        # Element CRUD and selection
│   │   ├── PlaybackController.js       # Presentation playback
│   │   └── AnimationEditorController.js # Animation editing UI
│   ├── models/
│   │   ├── Element.js                  # Base element class
│   │   ├── TextElement.js
│   │   ├── ImageElement.js
│   │   ├── VideoElement.js
│   │   ├── AudioElement.js
│   │   ├── ShapeElement.js
│   │   ├── ListElement.js
│   │   ├── LinkElement.js
│   │   ├── CountdownTimerElement.js
│   │   ├── Slide.js                    # Slide model + animationSequence
│   │   └── Presentation.js            # Presentation model + shell
│   ├── panels/                         # Property panels per element type
│   │   ├── TextPanel.js
│   │   ├── ImagePanel.js
│   │   ├── VideoPanel.js
│   │   ├── AudioPanel.js
│   │   └── CountdownTimerPanel.js
│   ├── interactions/
│   │   ├── DragHandler.js              # Element dragging
│   │   ├── ResizeHandler.js            # 8-directional resize
│   │   ├── RotateHandler.js            # Free rotation
│   │   ├── CropHandler.js             # Image/video crop mode
│   │   ├── MarqueeHandler.js          # Rubber-band selection
│   │   ├── CanvasDropHandler.js       # File drag-and-drop
│   │   └── AlignmentGuides.js         # Snap guides
│   ├── views/
│   │   ├── UIManager.js               # UI coordination
│   │   ├── RightSidebar.js            # Property sidebar
│   │   ├── StatusBar.js               # Bottom status bar
│   │   └── ElementsTree.js            # Element list with animation badges
│   └── utils/
│       ├── constants.js                # Enums and configuration
│       ├── dom.js                      # DOM utilities
│       ├── events.js                   # Event emitter
│       ├── storage.js                  # Dual storage (IndexedDB + localStorage)
│       ├── presentations_db.js         # IndexedDB presentation store
│       ├── media_db.js                # IndexedDB media store (with SHA-256 dedup)
│       ├── templates_db.js            # IndexedDB template store
│       ├── presentation_manager.js    # Presentation Manager UI
│       ├── media_manager.js           # Media Manager UI
│       ├── template_manager.js        # Template Manager UI
│       ├── positioning.js             # Positioning and magnetic snapping
│       ├── toasts.js                  # Custom toast notification system
│       ├── dialog.js                  # Custom dialog system
│       ├── i18n.js                    # Internationalization
│       └── panel_utils.js            # Shared panel helpers
├── docs/
│   ├── specifications.md
│   ├── animations.md
│   └── STORAGE.md                     # Storage architecture documentation
├── scripts/
│   └── copy-to-os3.sh
└── .github/
    └── workflows/
        └── deploy.yml                 # GitHub Pages deployment
```

## Animation System (WAAPI)

WOW3 uses the Web Animations API for all animation playback, replacing the original CSS class-based system.

### Animation Categories
- **Build In:** fadeIn, slideIn (top/bottom/left/right), zoomIn, flipInX/Y, bounceIn, rotateIn
- **Build Out:** fadeOut, slideOut (top/bottom/left/right), zoomOut, flipOutX/Y, bounceOut, rotateOut
- **Action:** Emphasis animations applied to visible elements

### Trigger Types
- **onLoad:** Plays automatically when the slide is shown
- **onClick:** Plays when the user advances (click, arrow, space)
- **afterPrevious:** Plays after the previous animation completes
- **withPrevious:** Plays simultaneously with the previous animation

### Animation Controls
- Duration: configurable per animation
- Easing: Linear, Ease, Ease-In, Ease-Out, and more
- Drag-and-drop reordering in the Sequence tab
- Preview playback in the editor

## Storage Architecture

WOW3 uses a dual storage system:

- **IndexedDB** for permanent storage (presentations, media, templates, thumbnails)
- **localStorage** for auto-save snapshots (crash recovery)

### Media Storage
- Media files stored as binary blobs in IndexedDB (no size limits)
- SHA-256 content hashing prevents duplicate uploads
- Elements reference media by ID; blobs loaded on render

### Export Format
- `.wow3` files are ZIP archives containing `presentation.json` and an `assets/` folder with all media
- Legacy `.json` import still supported for backward compatibility

See `docs/STORAGE.md` for full architecture documentation.

## Development

### No Build Process
This project uses native ES6 modules. No webpack, babel, or bundlers required.

### External Dependencies (CDN)
- MaterializeCSS (UI framework)
- html2canvas (thumbnail capture)
- JSZip (ZIP export/import)

### Code Style
- ES6+ features (classes, modules, async/await)
- Arrow functions preferred
- JSDoc comments for all public methods
- Const declarations by default

## Deployment

The project deploys to GitHub Pages via a GitHub Actions workflow on every push to `master`. It can also be triggered manually.

## Contributing

Contributions welcome. Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - Copyright (c) 2026 Fabio "fsoft" Rotondo, OS3 srl. See LICENSE file for details.

## Future Enhancements

- [ ] PDF export
- [ ] More element types (tables, charts, code blocks)
- [ ] Slide transitions
- [ ] Master slides
- [ ] Presenter notes
- [ ] Grid and snap-to-grid
- [ ] Shape library
- [ ] Cloud storage integration
