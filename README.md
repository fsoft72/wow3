# WOW3 - Web-based Presentation Software

A powerful, browser-based presentation editor similar to Apple Keynote, built with plain HTML, JavaScript (ES6+), and CSS3.

## 🚀 Features

### Presentation Management
- ✅ Create, save, load presentations
- ✅ Import/export presentations as JSON
- ✅ Auto-save every 30 seconds
- ✅ Undo/redo with 50-state history
- ✅ localStorage persistence

### Slide Operations
- ✅ Add, delete, duplicate slides
- ✅ Drag-drop slide reordering
- ✅ Slide thumbnails with live previews
- ✅ Custom backgrounds
- ✅ Slide navigation

### Element Types
- **Text:** Rich formatting, fonts, colors, alignment
- **Image:** Aspect ratio preservation, object-fit controls
- **Video:** Playback controls, autoplay, loop
- **Audio:** Audio playback with controls
- **Shape:** Rectangle, circle, triangle with fill/stroke
- **List:** Ordered and unordered lists
- **Link:** Clickable buttons with custom styling

### Element Interactions
- ✅ Drag elements with mouse
- ✅ 8-directional resize handles
- ✅ Aspect ratio locking (CTRL or automatic)
- ✅ Free rotation with snap-to-angle (Shift for 15° increments)
- ✅ Real-time alignment guides
- ✅ Copy, paste, duplicate
- ✅ Z-index control (bring to front, send to back)
- ✅ Parent-child relationships (1 level deep)

### Animation System
- ✅ 20+ CSS3 animations
- ✅ Bitwise animation combinations
- ✅ Animation types: Fade, Slide, Zoom, Flip, Bounce, Rotate
- ✅ Custom duration, direction, easing
- ✅ Auto and click-triggered playback
- ✅ IN/OUT effects per element

### Presentation Mode
- ✅ Fullscreen presentation playback
- ✅ Keyboard navigation (arrows, space, home, end)
- ✅ Animation sequencing
- ✅ Slide counter indicator

## 🎯 Quick Start

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- No build process required!

### Running Locally

1. Clone the repository:
```bash
git clone <repository-url>
cd wow3
```

2. Open `index.html` in your browser:
```bash
# Using Python
python -m http.server 8000

# Or using Node.js
npx http-server

# Or just open the file directly
open index.html
```

3. Start creating presentations!

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save presentation |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+C` | Copy selected element |
| `Ctrl+V` | Paste element |
| `Ctrl+D` | Duplicate selected element |
| `Delete/Backspace` | Delete selected element |
| `F5` | Play presentation |
| `Escape` | Exit presentation / Deselect |
| `Arrows` | Navigate slides (in presentation mode) |
| `Space` | Next slide (in presentation mode) |
| `Home` | First slide (in presentation mode) |
| `End` | Last slide (in presentation mode) |

### Element Manipulation

| Shortcut | Action |
|----------|--------|
| `Click` | Select element |
| `Double-click` | Edit text (text elements) |
| `Drag` | Move element |
| `Drag handle` | Resize element |
| `Ctrl+Drag` | Maintain aspect ratio while resizing |
| `Shift+Rotate` | Snap to 15° increments |

## 📁 Project Structure

```
wow3/
├── index.html              # Main application
├── css/
│   ├── animations.css      # WOW3 animation system
│   ├── main.css            # Application layout
│   ├── editor.css          # Editor and canvas styles
│   ├── sidebar.css         # Sidebar styles
│   └── components.css      # Reusable components
├── js/
│   ├── app.js              # Application bootstrap
│   ├── models/             # Data models
│   │   ├── Element.js      # Base element class
│   │   ├── TextElement.js  # Text element
│   │   ├── ImageElement.js # Image element
│   │   ├── ... (more element types)
│   │   ├── Slide.js        # Slide model
│   │   └── Presentation.js # Presentation model
│   ├── controllers/        # Business logic
│   │   ├── EditorController.js
│   │   ├── SlideController.js
│   │   ├── ElementController.js
│   │   ├── AnimationController.js
│   │   └── PlaybackController.js
│   ├── views/              # UI components
│   │   ├── UIManager.js
│   │   ├── RightSidebar.js
│   │   ├── StatusBar.js
│   │   └── ElementsTree.js
│   ├── interactions/       # Interaction handlers
│   │   ├── DragHandler.js
│   │   ├── ResizeHandler.js
│   │   ├── RotateHandler.js
│   │   └── AlignmentGuides.js
│   └── utils/              # Utility functions
│       ├── constants.js
│       ├── dom.js
│       ├── storage.js
│       ├── animations.js
│       ├── positioning.js
│       └── events.js
└── docs/
    ├── specifications.md
    └── animations.md
```

## 🎨 Animation System

WOW3 includes a comprehensive CSS3 animation system:

### Animation Types (Bitwise Combinable)
- **Fade:** `fadeIn`, `fadeOut`
- **Slide:** `slideIn*`, `slideOut*` (top, bottom, left, right)
- **Zoom:** `zoomIn`, `zoomOut`, `zoomInUp`, `zoomInDown`
- **Flip:** `flipInX`, `flipInY`, `flipOutX`, `flipOutY`
- **Bounce:** `bounceIn`, `bounceOut`
- **Rotate:** `rotateIn`, `rotateOut`

### Animation Controls
- **Duration:** 100ms - 3000ms
- **Direction:** Top, Bottom, Left, Right
- **Trigger:** Auto (on slide show) or Click
- **Easing:** Linear, Ease, Ease-In, Ease-Out, etc.

## 💾 Data Persistence

Presentations are stored in browser localStorage:
- Automatic saving every 30 seconds
- Manual save with `Ctrl+S`
- Export/import as JSON files
- Unsaved changes warning

### Storage Format
```json
{
  "id": "presentation_123",
  "title": "My Presentation",
  "slides": [...],
  "metadata": {
    "created": "2026-02-12T...",
    "modified": "2026-02-12T...",
    "author": ""
  }
}
```

## 🏗️ Architecture

### MVC Pattern
- **Models:** Presentation, Slide, Element (+ 7 subtypes)
- **Controllers:** Editor, Slide, Element, Animation, Playback
- **Views:** UIManager, Sidebars, StatusBar, ElementsTree

### Event System
- Global event emitter for app-wide communication
- Events: Slide changed, Element added/updated, Animation played
- Decoupled components

### History Management
- Command pattern for undo/redo
- Snapshot-based state management
- 50-state history limit

## 🎯 Browser Compatibility

Tested on:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 📝 Development

### No Build Process
This project uses native ES6 modules - no webpack, babel, or bundlers required!

### Code Style
- ES6+ features (classes, modules, async/await)
- Arrow functions preferred
- JSDoc comments for all public methods
- Const declarations by default

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- **MaterializeCSS** for the UI framework
- **Modern CSS** for hardware-accelerated animations
- **ES6 Modules** for clean architecture

## 🐛 Known Limitations

- Maximum 2 levels of element nesting (parent-child only)
- localStorage limited to ~5-10MB
- Single-user only (no collaboration)
- No cloud sync

## 🚧 Future Enhancements

- [ ] PDF export
- [ ] More element types (tables, charts, code blocks)
- [ ] Slide transitions
- [ ] Master slides/templates
- [ ] Presenter notes
- [ ] Grid and snap-to-grid
- [ ] Shape library
- [ ] Image upload and management
- [ ] Cloud storage integration

---

**Built with ❤️ using plain HTML, JavaScript, and CSS3**
