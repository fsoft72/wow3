# WOW3 Development Changelog

## 2026-02-15

### Fix: Dark Mode Text Contrast

Fixed poor contrast in dark mode where labels and form controls were barely visible.

**Changes:**
- Added dark mode styles for all `.control-group label` elements (changed from `#333` to `#ddd`)
- Added dark mode styles for panel tabs, inputs, sliders, and buttons
- Added dark mode styles for color pickers, upload areas, and section titles
- All form controls now have proper contrast in dark mode with light text on dark backgrounds

**Updated Files:**
- `css/settings.css`: Added comprehensive dark mode overrides for property panels

---

### Offline Mode: CDN Dependencies Removed

Removed all CDN dependencies and moved external libraries to the local `ext/` folder for offline operation.

**Downloaded Libraries:**
- MaterializeCSS v1.0.0 (CSS + JS) → `ext/materialize/`
- Material Icons font (woff2) → `ext/material-icons/`
- JSZip v3.10.1 → `ext/jszip/`
- html2canvas v1.4.1 → `ext/html2canvas/`

**Changes:**
- Created custom Material Icons CSS file with local font reference
- Updated all CDN URLs in `index.html` to point to local files
- App now works completely offline without internet connection

**Updated Files:**
- `index.html`: Replaced all 5 CDN links with local file references
- `ext/material-icons/material-icons.css`: New local font CSS file

**New Directory Structure:**
```
ext/
├── html2canvas/
│   └── html2canvas.min.js
├── jszip/
│   └── jszip.min.js
├── material-icons/
│   ├── MaterialIcons-Regular.woff2
│   └── material-icons.css
└── materialize/
    ├── materialize.min.css
    └── materialize.min.js
```

---

## 2026-02-15

### Settings Window

Added a floating Settings panel with General and Theme tabs, accessible from the status bar.

**General Tab:**
- Autosave interval (5-300 seconds, default 15s) — changes restart the autosave timer immediately

**Theme Tab:**
- Light / Dark mode toggle
- Color pickers for Navbar, Buttons, and Panel headers with hex text input and reset-to-default buttons
- All color changes apply immediately via CSS custom properties

**Dark Mode:**
- Full dark mode support for sidebars, status bar, property panels, tabs, inputs, floating panels
- Slide canvas is NOT affected (keeps per-slide background)

**Persistence:**
- All settings stored in `localStorage` under key `"wow3"`
- Settings restored on page reload, including theme colors and dark mode

**New Files:**
- `js/utils/settings.js`: Settings model with `loadSettings()`, `saveSettings()`, `getSetting()`, `setSetting()`, exposed as `window.WOW3Settings`
- `js/controllers/SettingsController.js`: Floating panel controller with drag, tab switching, theme application
- `css/settings.css`: Panel styles, form controls, dark mode overrides

**Updated Files:**
- `index.html`: Added settings panel HTML, status bar button, CSS link, script tag
- `js/controllers/index.js`: Export `SettingsController`
- `js/app.js`: Import & init SettingsController, refactored autosave to be restartable via `_startAutosave()`, apply theme on startup
- `css/main.css`: Added CSS custom properties (`--primary-nav`, `--primary-button`, `--primary-panel`)
- `css/animation-editor.css`: Replaced hardcoded `#1565c0` with `var(--primary-panel)` in panel header
- `css/sidebar.css`: Replaced hardcoded `#1565C0` with `var(--primary-nav)` in active tab

---

### Multi-Shell Support

Replaced the single-shell model with a multi-shell system. Each slide can now choose which shell (or none) to display, and multiple shells can coexist in a presentation.

**Data Model Changes:**
- `Presentation.js`: Replaced `shell` (single Slide) with `shells[]` (array of Slides) and `defaultShellId`; removed `shellMode` (now per-slide); added `addShell()`, `removeShell(id)`, `hasShells()`, `getShellById(id)`, `getDefaultShell()`, `setDefaultShell(id)`; backward compat migrates old `shell` into `shells[]`
- `Slide.js`: Replaced `hideShell` (boolean) with `shellId` (string|null) and per-slide `shellMode` ('above'|'below'); backward compat maps `hideShell: true` to `shellId: null`

**Left Panel Changes:**
- Added tabbed interface (Slides / Shells) to the left sidebar
- Shells tab: list of shell cards with preview, editable name, star (default) toggle, delete button
- Removed old shell thumbnail from the top of the slide list

**Right Panel Changes:**
- Removed `#hide-shell-field` checkbox and `#shell-settings-section`
- Added shell assignment dropdown (`<select>`) per slide with "None" + all shells
- Added per-slide shell mode dropdown (Above/Below), only visible when a shell is assigned

**Controller Changes:**
- `SlideController.js`: Removed `createShellThumbnail()`, `showShellContextMenu()`; added `renderShells()`, `createShellCard()`, `addShell()`, `deleteShell()`, `toggleDefaultShell()`, `_startShellInlineRename()`; updated shell preview to use slide's `shellId` and `shellMode`
- `EditorController.js`: Added `editingShellId`; `editShell(shellId)` now takes a shell ID; updated `getActiveSlide()`, `updateUI()`, `exitShellEditing()`; replaced old shell event listeners with shell dropdown handlers
- `PlaybackController.js`: Looks up shell via `slide.shellId` instead of `presentation.shell`; uses per-slide `shellMode`
- `ElementController.js`: Updated global timer style sync to walk `shells[]` instead of single `shell`

**Other Changes:**
- `sidebar.css`: Added sidebar tab styles, shell card styles with star/delete/rename
- `template_manager.js`: Replaced `hideShell: false` with `shellId: null` in built-in templates
- `presentation_manager.js`: Updated thumbnail cleanup to iterate `shells[]`
- `storage.js`: Updated media scan and URL rewriting to handle `shells[]` with backward compat for old `shell`

**New Slide Behavior:**
- New slides get `shellId` set to `defaultShellId` (the starred shell)
- Template slides get the default shell if they don't have one assigned
- Duplicated slides keep their original `shellId`
- Deleting a shell sets `shellId = null` on all slides that referenced it

**Updated Files:**
- `js/models/Presentation.js`
- `js/models/Slide.js`
- `index.html`
- `css/sidebar.css`
- `js/controllers/SlideController.js`
- `js/controllers/EditorController.js`
- `js/controllers/PlaybackController.js`
- `js/controllers/ElementController.js`
- `js/utils/template_manager.js`
- `js/utils/presentation_manager.js`
- `js/utils/storage.js`

---

## 2026-02-14

### About Dialog

- ✓ **About dialog**: Clicking the "WOW3" brand logo in the toolbar shows an About dialog with version info, author link, license, and GitHub link
- ✓ **Uses existing Dialog system**: Leverages the custom `Dialog.show()` widget

**Updated Files:**
- `index.html`: Added `id="brand-logo"` to brand logo anchor
- `js/views/UIManager.js`: Added `attachAboutDialog()` method called during `init()`

---

### Elements Control Center (Floating Panel)

Unified the animation editing UI into a single floating "Elements Control Center" panel with three tabs (Sequence, Anim, Elements), replacing the old right sidebar Animations tab and the separate Build Order floating panel.

**Changes:**
- Removed `Animations` tab from right sidebar (3 tabs → 2: Slide, Element)
- Removed `#build-order-panel` and replaced with `#animations-panel` floating panel
- Added status bar "Animations" toggle button to open/close the panel
- Panel has two tabs: **Sequence** (full slide animation sequence) and **Anim** (element-specific animation editor)
- Anim tab auto-enables when an element is selected, auto-disables and switches to Sequence when deselected
- Clicking an element while the panel is open auto-switches to Anim tab
- Animation badge in elements tree opens the panel and switches to Anim tab
- Panel is draggable by its header bar; position resets to center-bottom when closed and reopened
- **Elements** tab lists all elements on the current slide; clicking an item selects it on canvas
- Panel is resizable via a bottom-right corner handle (min 360x200, max 90vw x 80vh)
- Default height: 500px; opens centered on screen on first use
- Fade in/out (300ms) instead of slide animation; remembers last position and size across open/close cycles
- Renamed from "Animations" to "Elements Control Center"

**Updated Files:**
- `index.html`: Removed animation tab + build order panel, added floating panel + status bar button
- `css/animation-editor.css`: Replaced build-order-panel styles with new floating panel styles, added toggle button style
- `js/controllers/AnimationEditorController.js`: New panel/tab management with `togglePanel()`, `showPanel()`, `hidePanel()`, `switchPanelTab()`, `_updateAnimTabState()`
- `js/views/ElementsTree.js`: `openAnimationInspector()` now targets floating panel instead of sidebar tab
- `js/views/RightSidebar.js`: Removed `animationTab` property

---

### Replace Animation System with WAAPI-powered Engine

Replaced the entire CSS class-based animation system with a Web Animations API (WAAPI) engine. Animations are now stored on the **Slide** as an ordered `animationSequence[]` rather than on individual elements.

#### New Files
- `js/animations/definitions.js` — WAAPI keyframe registry with animation categories (buildIn, action, buildOut), trigger types (onLoad, onClick, afterPrevious, withPrevious), easing map, and 20+ animation definitions
- `js/animations/AnimationManager.js` — Pure playback engine using WAAPI with async/await sequencing, transform conflict resolution (preserves element rotation), and skip/cleanup support
- `js/animations/migration.js` — Converts old bitwise `inEffect`/`outEffect` on elements to new `animationSequence[]` format on slides
- `js/controllers/AnimationEditorController.js` — Animation editing UI: category tab bar, effect selector grid, build order panel with drag-and-drop reorder, preview playback
- `css/animation-editor.css` — Styles for animation inspector, effect grid, build order panel, animation badges

#### Modified Files
- `js/models/Slide.js` — Added `animationSequence[]` property, CRUD methods (addAnimation, removeAnimation, updateAnimation, reorderAnimation, getAnimationsForElement, removeAnimationsForElement), auto-migration on load, updated toJSON/clone/removeElement
- `js/models/Element.js` — `inEffect`/`outEffect` kept for backward-compatible deserialization only
- `js/controllers/PlaybackController.js` — Uses AnimationManager instead of AnimationController; creates manager per slide, calls loadSequence/prepareInitialState/play; advance() uses skip/next pattern
- `js/controllers/EditorController.js` — References animationEditorController instead of animationController
- `js/views/ElementsTree.js` — Replaced IN/OUT buttons with animation badge showing count; clicking badge opens animation inspector
- `js/utils/constants.js` — Marked old AnimationType/AnimationTrigger as deprecated, kept for migration
- `js/controllers/index.js` — Exports AnimationEditorController instead of AnimationController
- `js/app.js` — Initializes AnimationEditorController; F5/Escape shortcuts use PlaybackController directly
- `index.html` — Removed old animation modal, added Animations tab to right sidebar, added build order floating panel, replaced animations.css with animation-editor.css

#### Deleted Files
- `js/utils/animations.js` — Old CSS animation utilities (replaced by WAAPI)
- `js/controllers/AnimationController.js` — Old animation controller (replaced by AnimationManager + AnimationEditorController)
- `css/animations.css` — Old CSS @keyframes (replaced by WAAPI keyframes in definitions.js)

#### Key Architecture Changes
- **Data model**: Animations live on the Slide (`animationSequence[]`) not on Elements
- **Playback**: WAAPI `element.animate()` replaces CSS class toggling
- **Triggers**: 4 trigger types (onLoad, onClick, afterPrevious, withPrevious) replace 2 (auto, click)
- **Migration**: Old presentations auto-convert on load; combined bitwise flags decompose into multiple withPrevious-linked entries
- **Transform preservation**: AnimationManager reads element rotation and injects it into animation keyframes

## 2026-02-13

### Unique Thumbnail Keys for Slide Thumbnails
- Slide thumbnails in IndexedDB are now stored with unique `thumb_<timestamp>` keys instead of being keyed by slide ID
- Added `thumbnailId` property to Slide model, serialized in `toJSON()` and cleared in `clone()`
- `_captureCurrentSlideThumbnail()` generates a new unique key on each capture, deletes the old entry, and updates the slide's `thumbnailId`
- `loadThumbnailsFromDB()` maps thumbnail IDs back to slide IDs for the in-memory sidebar cache
- Slide deletion, shell removal, and presentation deletion all use `thumbnailId` to clean up from IndexedDB
- `MediaDB.deleteThumbnail()` now guards against null/undefined IDs

**Updated Files:**
- `js/models/Slide.js`: Added `thumbnailId` property, included in `toJSON()`, cleared in `clone()`
- `js/utils/media_db.js`: Updated JSDoc param names; added null guard to `deleteThumbnail()`
- `js/controllers/SlideController.js`: Updated `loadThumbnailsFromDB()`, `_captureCurrentSlideThumbnail()`, and shell context menu deletion
- `js/controllers/EditorController.js`: Updated `deleteSlide()` and remove-shell button to use `thumbnailId`
- `js/utils/presentation_manager.js`: Updated `deletePresentation()` to collect `thumbnailId` from slides/shell

### Shell Preview Toggle in Editor
- Added a toggle button in the status bar to show/hide shell slide elements while editing a regular slide
- Shell elements are rendered as a read-only overlay with 30% opacity (`pointer-events: none`)
- Respects `shellMode` (below/above) for proper layering relative to slide elements
- Respects per-slide `hideShell` setting — preview won't show if the slide has shell hidden
- Button only visible when a shell exists and the user is not in shell editing mode
- Purple highlight on button when active; layers/layers_clear icon toggles with state

**Updated Files:**
- `js/controllers/EditorController.js`: Added `showShellPreview` state, toggle button event listener, button visibility in `updateUI()`
- `js/controllers/SlideController.js`: Added `_renderShellPreview()` method called from `renderCurrentSlide()`
- `index.html`: Added `#shell-preview-btn` toggle button in status bar
- `css/editor.css`: Added `.shell-preview-overlay` and `.shell-preview-toggle` styles

### Inline Slide Rename
- Click on the slide name label (shown on thumbnail hover) to edit the name in place
- Press Enter or click away to confirm, Escape to cancel
- Right-sidebar title input stays in sync with inline edits

## 2026-02-12

### Initial Setup
- Created project structure with directories: css/, js/, assets/, docs/
- Created PLAN.md with complete implementation roadmap

### Phase 1: Foundation and Core Structure
- ✓ Created index.html with complete application structure
  - Top navigation bar with toolbar
  - Left sidebar for slide list
  - Main canvas area
  - Right sidebar with tabs (Slide, Element, Animation)
  - Bottom status bar
  - Animation modal
- ✓ Created complete CSS foundation:
  - animations.css: Full WOW3 animation system with 20+ animations
  - main.css: Application layout and base styles
  - editor.css: Canvas and element interaction styles
  - sidebar.css: Sidebar components and property panels
  - components.css: Reusable UI components
- ✓ Created complete JavaScript architecture:
  - constants.js: All application constants, enums, and configuration
  - dom.js: DOM manipulation and helper utilities
  - storage.js: localStorage persistence functions
  - animations.js: Animation application and management
  - positioning.js: Element positioning and alignment utilities
  - events.js: Event emitter and event handling utilities
  - app.js: Main application bootstrap with MaterializeCSS integration

**Phase 1 Complete!** Foundation is ready for building data models and controllers.

### Phase 2: Data Models
- ✓ Created base Element class with common functionality:
  - Position, rotation, and size management
  - Parent-child relationships (max 1 level deep)
  - Animation effects (in/out)
  - JSON serialization and cloning
- ✓ Created all specific element types:
  - TextElement: Rich text with formatting options
  - ImageElement: Images with aspect ratio preservation
  - VideoElement: Video playback with controls
  - AudioElement: Audio playback
  - ShapeElement: SVG shapes (rectangle, circle, triangle, line)
  - ListElement: Ordered and unordered lists
  - LinkElement: Clickable links/buttons
- ✓ Created Slide model:
  - Element management (add, remove, reorder)
  - Z-index control (bring to front, send to back)
  - Background and title properties
  - Clone functionality
- ✓ Created Presentation model:
  - Slide management with full CRUD operations
  - Navigation (next, previous, first, last)
  - Metadata tracking (author, created, modified)
  - Statistics and analytics

**Phase 2 Complete!** All data models ready for controller implementation.

### Phase 3: Controllers (Batch 1 - Core Controllers)
- ✓ Created EditorController (main coordinator):
  - Presentation lifecycle management (new, load, save, import, export)
  - History management with undo/redo (50 state limit)
  - Event coordination and toolbar handlers
  - Auto-save functionality
  - Unsaved changes tracking
- ✓ Created SlideController:
  - Slide rendering in sidebar with thumbnails
  - Drag-drop slide reordering
  - Current slide canvas rendering
  - Context menu (duplicate, delete)
  - Slide selection and navigation
  - Element preview in thumbnails

### Phase 3: Controllers (Batch 2 - Interaction & Playback)
- ✓ Created ElementController:
  - Element creation and deletion
  - Element selection and deselection
  - Copy, paste, and duplicate operations
  - Z-index management (bring to front, send to back)
  - Text editing mode
  - Property updates with live preview
  - Interaction handler attachment
- ✓ Created AnimationController:
  - Animation modal UI integration
  - Animation configuration (type, duration, direction, trigger, easing)
  - Bitwise animation type combinations
  - Auto and click-triggered animation playback
  - Element animation sequencing
  - Animation preview system
- ✓ Created PlaybackController:
  - Fullscreen presentation mode
  - Keyboard navigation (arrows, space, home, end, escape)
  - Slide rendering in presentation view
  - Animation playback integration
  - Slide counter indicator
  - Fullscreen enter/exit handling

**Phase 3 Complete!** All controllers implemented and ready for integration.

### Phase 4: Interaction Handlers
- ✓ Created DragHandler:
  - Mouse-based element dragging
  - Canvas boundary constraints
  - Alignment guide integration during drag
  - Drag start/end event handling
  - Visual feedback (dragging cursor)
- ✓ Created ResizeHandler:
  - 8-directional resize handles (corners and edges)
  - Aspect ratio preservation (CTRL key or automatic for images/videos)
  - Minimum size constraints
  - Canvas boundary awareness
  - Real-time DOM updates
- ✓ Created RotateHandler:
  - Free rotation around center point
  - Snap-to-angle (15° increments with Shift key)
  - Angle normalization (0-360°)
  - Visual feedback with cursor changes
  - Angle calculation using atan2
- ✓ Created AlignmentGuides:
  - Real-time alignment detection
  - Horizontal and vertical guide rendering
  - Smart guide positioning
  - Visual guide cleanup on drag end
  - Integration with positioning utilities

**Phase 4 Complete!** All interaction handlers ready for UI integration.

### Phase 5: View Components & Application Integration
- ✓ Created UIManager:
  - Centralized UI component coordination
  - MaterializeCSS tab initialization
  - Play mode / editor mode switching
  - Loading overlay system
  - Toast notification wrapper
  - Window resize handling
- ✓ Created RightSidebar:
  - Dynamic property panels based on element type
  - Position & size controls (X, Y, Width, Height, Rotation)
  - Text properties (font, size, color, alignment)
  - Media properties (URL input)
  - Shape properties (type, fill, stroke)
  - Link and list properties
  - Live property updates with callbacks
- ✓ Created StatusBar:
  - Slide counter display
  - Zoom level display
  - Simple status updates
- ✓ Created ElementsTree:
  - Hierarchical element list
  - IN/OUT animation buttons per element
  - Element icons and names
  - Click to select elements
  - Animation modal integration
- ✓ Updated app.js - Full Application Integration:
  - Complete initialization sequence
  - All controllers instantiated and wired together
  - Interaction handlers attached to ElementController
  - Auto-save, keyboard shortcuts, global events
  - Presentation loading from localStorage

**Phase 5 Complete!** Fully integrated application ready for testing.

---

## Implementation Summary

### ✅ All Phases Complete!

**Statistics:**
- **Total Files Created:** 50+
- **Lines of Code:** ~8,000+
- **Git Commits:** 6 clean commits
- **Implementation Time:** Single session

**Architecture:**
1. **Foundation (Phase 1):** HTML structure, complete CSS system, utility modules
2. **Data Layer (Phase 2):** 10 model classes with full JSON serialization
3. **Business Logic (Phase 3):** 5 controllers coordinating all operations
4. **Interactions (Phase 4):** Drag, resize, rotate handlers with alignment guides
5. **Presentation (Phase 5):** UI components and full application integration

**Key Features Implemented:**
- ✓ Complete presentation editor with slide management
- ✓ 7 element types with full property controls
- ✓ Drag-drop-resize-rotate interactions
- ✓ CSS3 animation system with 20+ animations
- ✓ Bitwise animation combinations
- ✓ Auto and click-triggered playback
- ✓ Fullscreen presentation mode
- ✓ Undo/redo with 50-state history
- ✓ Auto-save and localStorage persistence
- ✓ Import/export JSON functionality
- ✓ Complete keyboard shortcut system
- ✓ Parent-child element relationships
- ✓ Real-time alignment guides
- ✓ Responsive MaterializeCSS UI

**Ready for:** Browser testing and user feedback!

---

## Storage System Migration (IndexedDB + localStorage)

### Major Update: Dual Storage System
- ✓ **IndexedDB** for permanent storage (user clicks "Save")
- ✓ **localStorage** for snapshots/auto-save (crash recovery)

**New Files:**
- `presentations_db.js`: Complete IndexedDB manager
- Updated `storage.js`: Dual storage with snapshots

**Key Changes:**
- Save button → IndexedDB (permanent)
- Auto-save (30s) → localStorage snapshot
- Load priority: snapshot → IndexedDB → new
- Keeps last 3 snapshots for recovery
- No more 5-10MB localStorage limit issues!

---

## Media Storage Integration (IndexedDB)

### Complete Media Management System
- ✓ **MediaDB Integration**: All media elements now use IndexedDB
- ✓ **File Upload System**: Upload images, videos, audio to IndexedDB
- ✓ **Binary Storage**: Media stored as Blob objects (not base64)
- ✓ **Export/Import**: Media exported as data URLs in JSON

**Updated Files:**
- `index.html`: Added media_db.js script tag
- `ImageElement.js`: Integrated with MediaDB
  - Stores media IDs instead of URLs
  - Loads from IndexedDB when rendering
  - Exports as data URL for JSON portability
  - Imports from data URL on JSON import
- `VideoElement.js`: Same MediaDB integration as images
- `AudioElement.js`: Same MediaDB integration as images
- `RightSidebar.js`: Added file upload buttons
  - Upload button with file picker
  - Shows IndexedDB storage indicator
  - Handles image/video/audio uploads
- `ElementController.js`: Added `updateMediaUrl()` method
  - Handles File objects and URLs
  - Updates element and re-renders

**New Documentation:**
- `STORAGE.md`: Complete storage system guide
  - Architecture overview with diagrams
  - IndexedDB schema documentation
  - Media management workflows
  - Import/export system explanation
  - API reference for all storage functions
  - Code examples and troubleshooting

**How It Works:**
1. User uploads file via properties panel
2. File stored in IndexedDB as Blob (binary)
3. Element stores media ID (`media_123_abc`)
4. On render, loads from IndexedDB as data URL
5. On export, embeds data URL in JSON
6. On import, restores to IndexedDB from data URL

**Benefits:**
- No localStorage size limits
- Binary storage (efficient)
- Portable JSON exports
- Fast loading from IndexedDB
- Crash recovery with snapshots

---

## Media Manager UI

### New Component: Media Library Manager
- ✓ **MediaManager Component**: Complete media library management interface
- ✓ **Accessible from Right Sidebar**: Media Library button at bottom of right panel
- ✓ **Media Grid View**: Visual grid layout with thumbnails for all media types
- ✓ **Preview Support**:
  - Images: Thumbnail preview
  - Videos: Thumbnail with play icon overlay
  - Audio: Audio icon display
- ✓ **File Information Display**:
  - File name with ellipsis overflow
  - File size (formatted: B, KB, MB, GB)
  - Upload date
- ✓ **Delete Functionality**:
  - Hover-to-show delete button
  - Confirmation dialog before deletion
  - Auto-refresh after deletion
  - Re-renders current slide to update affected elements
- ✓ **Modal Interface**:
  - Large modal (90% width, 1200px max)
  - Fixed footer with close button
  - Responsive grid layout
  - Empty state message
  - Loading indicator

**Updated Files:**
- `MediaManager.js`: New view component for media library
- `UIManager.js`: Initialize MediaManager and attach button handler
- `index.html`: Added media manager modal and button in right sidebar
- `components.css`: Media manager styles (grid, cards, actions)
- `main.css`: Added padding to right sidebar for button placement
- `views/index.js`: Export MediaManager

**Features:**
- View all media stored in IndexedDB
- Visual previews for images and videos
- File metadata display
- Easy deletion with confirmation
- Automatic UI updates after operations

---

## Property Panel Optimization

### Fix: Preserve Active Tab When Updating Properties
- ✓ **Prevent unnecessary panel re-renders**: RightSidebar now tracks currently displayed element
- ✓ **Element ID tracking**: Added `currentElementId` property to track which element's properties are shown
- ✓ **Smart update logic**: `updateProperties()` now checks if element has changed before re-rendering
- ✓ **Tab preservation**: Active tab (Content, Style, etc.) is now preserved when updating element properties
- ✓ **Performance improvement**: Eliminates flickering and tab switching when adjusting properties

**How It Works:**
1. When `updateProperties(element)` is called, it compares `element.id` with `currentElementId`
2. If the element hasn't changed, the method returns early without re-rendering
3. Only when selecting a different element does the panel re-render
4. Property updates on the same element no longer trigger panel re-renders
5. The active tab stays active, providing a smooth editing experience

**Updated Files:**
- `RightSidebar.js`: Added element tracking and conditional rendering logic

---

## New Presentation Enhancement

### Improved New Presentation Dialog and Cleanup
- ✓ **Dialog confirmation**: Replaced native `confirm()` with custom Dialog system
- ✓ **Clear messaging**: Shows different messages based on whether there are unsaved changes
- ✓ **Complete localStorage cleanup**: Clears all localStorage snapshots when creating new presentation
- ✓ **Canvas cleanup**: Explicitly clears the canvas DOM before rendering new presentation
- ✓ **Element deselection**: Ensures any selected element is deselected before cleanup
- ✓ **Better UX**: User is clearly informed that all work will be discarded

**Dialog Messages:**
- With unsaved changes: "You have unsaved changes. Creating a new presentation will discard all current work and clear the canvas. Continue?"
- Without changes: "This will clear the canvas and create a new presentation. Continue?"

**Cleanup Process:**
1. Shows confirmation dialog with appropriate message
2. Clears localStorage snapshots (`clearSnapshot()`)
3. Deselects any selected elements
4. Creates new empty Presentation object
5. Resets history and unsaved changes flag
6. Explicitly clears canvas DOM
7. Re-renders the new presentation

**Updated Files:**
- `EditorController.js`: Enhanced `createNewPresentation()` method with Dialog and complete cleanup

---

## Text Element UI Fix

### Fix: Remove overflow scrollbars from text elements
- ✓ **No more scrollbars**: Changed text content overflow from `auto` to `hidden`
- ✓ **Cleaner appearance**: Text elements now display without scrollbars
- ✓ **Better UX**: Text elements look cleaner and more professional

**Change:**
- Before: `overflow: auto;` (showed scrollbars when text content exceeded bounds)
- After: `overflow: hidden;` (hides overflow without scrollbars)

**Updated Files:**
- `TextElement.js`: Changed overflow style in text content rendering

---

## Presentation Manager System

### New: Complete Presentation Management Interface
- ✓ **Presentation Manager**: New modal interface similar to Media Manager for browsing presentations
- ✓ **Thumbnail Generation**: Automatically generates and saves thumbnails of first slide when saving
- ✓ **Browse Presentations**: View all saved presentations with thumbnails and metadata
- ✓ **Search Functionality**: Search presentations by title
- ✓ **Delete Presentations**: Remove unwanted presentations with confirmation
- ✓ **Open Presentations**: Click to load any saved presentation
- ✓ **Create New**: Quick button to create new presentation from manager
- ✓ **Date Grouping**: Presentations grouped by Today, Yesterday, and Older
- ✓ **Rich Metadata**: Shows slide count, modification date, and time

**Features:**
1. **Thumbnail Generation**:
   - Captures first slide content as 400x300 thumbnail
   - Stored as data URL in presentation metadata
   - Falls back to background color if capture fails

2. **Presentation Manager Interface**:
   - Dark theme matching Media Manager style
   - Grid layout with card-based presentation display
   - Hover actions (Open button)
   - Delete button with confirmation
   - Search bar for filtering by title
   - Context menu (right-click) for actions

3. **Access Points**:
   - Click "Open Presentation" button (folder icon) in toolbar
   - Opens modal overlay with all saved presentations

**New Files:**
- `presentation_manager.js`: Complete presentation manager logic
- `presentation-manager.css`: Styling for presentation manager UI

**Updated Files:**
- `storage.js`: Added `generateThumbnail()` function and updated `savePresentation()` to save thumbnails
- `i18n.js`: Added translations for presentation manager
- `UIManager.js`: Initialize and attach PresentationManager
- `index.html`: Added presentation-manager CSS and JS includes

---

## Thumbnail Generation Fix

### Fix: Proper thumbnail capture from first slide
- ✓ **Improved thumbnail rendering**: Now properly captures elements (text, images, shapes)
- ✓ **First slide capture**: Temporarily switches to first slide before generating thumbnail
- ✓ **Element rendering**: Draws text with proper styling, images, and shapes onto thumbnail
- ✓ **Background preservation**: Uses actual slide background color
- ✓ **Scale calculation**: Properly scales canvas content to fit 400×300 thumbnail

**How It Works:**
1. When saving, temporarily switch to first slide
2. Render first slide to canvas
3. Iterate through all elements and draw them to thumbnail canvas
4. Capture as PNG data URL
5. Restore original slide

**Updated Files:**
- `storage.js`: Enhanced `generateThumbnail()` to render actual elements
- `EditorController.js`: Temporarily switches to first slide during save for thumbnail capture

---

## Auto-Select Element Tab

### Feature: Automatically switch to Element tab when selecting an element
- ✓ **Auto tab switching**: Clicking on any element now automatically switches to the "Element" tab
- ✓ **Better UX**: Users can immediately see and edit element properties without manually switching tabs
- ✓ **Smooth workflow**: Eliminates extra click when selecting elements

**How It Works:**
1. User clicks on an element in the canvas
2. Element is selected and highlighted
3. Right sidebar automatically switches to "Element" tab
4. Properties panel displays element properties

**Updated Files:**
- `ElementController.js`: Added `switchToElementTab()` method and integrated into `selectElement()`

---

## UI Cleanup: Remove New Presentation Button

### Change: Removed "+" New Presentation button from toolbar
- ✓ **Streamlined toolbar**: Removed redundant "+" button
- ✓ **Single entry point**: Use Presentation Manager (folder icon) for all presentation management
- ✓ **Cleaner UI**: Less clutter in the top toolbar

**Rationale:**
The Presentation Manager now provides a dedicated "New Presentation" button, making the toolbar "+" button redundant. Users can create, open, browse, and delete presentations all from one unified interface.

**Updated Files:**
- `index.html`: Removed new-btn from toolbar
- `EditorController.js`: Removed new-btn event listener

---

## Real-Time Property Updates

### Feature: Live position updates while dragging, resizing, and rotating
- ✓ **Real-time coordinates**: X, Y values update live while dragging elements
- ✓ **Real-time dimensions**: Width, Height update live while resizing
- ✓ **Real-time rotation**: Rotation angle updates live while rotating
- ✓ **No panel flicker**: Updates only the input values without re-rendering the entire panel
- ✓ **Better feedback**: Users can see exact values while transforming elements

**How It Works:**
1. Added `updatePositionValues()` method to RightSidebar
2. Method updates only the position input fields without full panel re-render
3. Called during drag, resize, and rotate operations
4. Values are rounded to nearest integer for clean display

**Updated Files:**
- `RightSidebar.js`: Added `updatePositionValues()` method
- `DragHandler.js`: Calls updatePositionValues during drag
- `ResizeHandler.js`: Calls updatePositionValues during resize
- `RotateHandler.js`: Calls updatePositionValues during rotate

---

## Fix: Rotation as Integer

### Fix: Ensure rotation values are always integers
- ✓ **Integer rotation**: Rotation values now always stored and displayed as integers
- ✓ **Clean values**: No more floating point decimals in rotation
- ✓ **Consistent**: Applied both on creation and during updates

**Changes:**
- Rotation values are rounded to nearest integer in constructor
- Rotation values are rounded when updating position
- Cleaner display in properties panel

**Updated Files:**
- `Element.js`: Round rotation values in constructor and updatePosition method

---

## Presentation Title Management

### Feature: Editable presentation title with rename functionality
- ✓ **Title input field**: Added text input next to WOW3 logo for presentation name
- ✓ **Auto-save title**: Title automatically saved when changed
- ✓ **Display in manager**: Presentation name shown in Presentation Manager
- ✓ **Rename function**: Right-click context menu option to rename presentations
- ✓ **Auto-update**: Title input updates when loading different presentations
- ✓ **Visual feedback**: Input highlights on focus with smooth transitions

**Features:**
1. **Title Input in Navbar**:
   - Located next to WOW3 logo
   - 300px width with semi-transparent background
   - Updates in real-time when typing
   - Marks presentation as unsaved when changed

2. **Rename in Presentation Manager**:
   - Right-click on any presentation
   - Select "Rename" from context menu
   - Dialog prompts for new name
   - Updates presentation and refreshes display

3. **Auto-Sync**:
   - Title input updates when creating new presentation
   - Title input updates when loading presentation
   - Title saved with presentation to IndexedDB

**Updated Files:**
- `index.html`: Added presentation-title-input field in navbar
- `EditorController.js`: Added title input event handler and updateUI enhancement
- `presentation_manager.js`: Added renamePresentation() method and context menu option
- `main.css`: Added styling for title input with focus states

---

## Debug Logging for Animations

### Added: Comprehensive debug logging for animation system
- ✓ **AnimationController logs**: Save, play, and element animation tracking
- ✓ **PlaybackController logs**: Slide animation triggering
- ✓ **Animation utility logs**: CSS class application and timing
- ✓ **Detailed output**: Element IDs, animation objects, classes, and events

**Console Output:**
- 🎬 AnimationController events
- 🎮 PlaybackController events
- 🎨 Animation utility events
- Shows animation data, element states, and CSS classes applied

**Purpose:**
Help diagnose why animations are not working by showing:
- If animations are saved to elements
- If playback is triggered
- If CSS classes are applied
- If animation events fire

**Updated Files:**
- `AnimationController.js`: Added logging to save and play methods
- `PlaybackController.js`: Added logging to slide display
- `animations.js`: Added logging to applyAnimation function

---

## UI Reorganization: Animation Controls

### Change: Moved animation controls to Slide tab
- ✓ **Removed Animation tab**: Simplified right sidebar to 2 tabs (Slide, Element)
- ✓ **Integrated into Slide tab**: Page Elements & Animations now at bottom of Slide tab
- ✓ **Better organization**: Animations logically belong with slide content
- ✓ **Cleaner UI**: Fewer tabs, more focused interface

**Before:**
- 3 tabs: Slide, Element, Animation
- Animation tab separate from slide context

**After:**
- 2 tabs: Slide, Element
- "Page Elements & Animations" section at bottom of Slide tab
- All slide-related controls in one place

**Updated Files:**
- `index.html`: Removed Animation tab, moved elements tree to Slide tab

---

## Fix: LocalStorage Snapshot Sync

### Fix: Update localStorage snapshot when opening presentations
- ✓ **Snapshot sync on load**: Opening a presentation now updates localStorage snapshot
- ✓ **Snapshot sync on new**: Creating new presentation saves snapshot of new presentation
- ✓ **Crash recovery**: Browser refresh/crash now recovers the correct presentation
- ✓ **Consistent state**: localStorage always reflects current working presentation

**Issue Before:**
- Open presentation A
- Open presentation B
- localStorage still contained presentation A
- Browser refresh would load presentation A instead of B

**Fix:**
- `loadPresentation()` now calls `saveSnapshot()` after loading
- `createNewPresentation()` now calls `saveSnapshot()` after creation
- localStorage always in sync with current presentation

**Updated Files:**
- `EditorController.js`: Added saveSnapshot() calls to loadPresentation() and createNewPresentation()

---

## Fix: Elements Stay Visible After Animations

### Fix: Ensure elements remain visible after animation completes
- ✓ **Explicit visibility preservation**: After animation, explicitly set opacity: 1 and visibility: visible
- ✓ **Cleanup without hiding**: removeAnimation() no longer clears opacity/visibility
- ✓ **Both completion paths**: Fixed for both animationend event and timeout fallback
- ✓ **More logging**: Added logs showing final state after animation cleanup

**Issue:**
- Elements were prepared with opacity: 0, visibility: hidden
- Animation would play correctly
- After animation completed, element would not stay visible
- Shapes and other elements would disappear after fade-in

**Fix:**
- After animation completes (both via event and timeout):
  1. Set opacity: '1' and visibility: 'visible'
  2. Remove animation classes
  3. Set opacity and visibility again to ensure they stick
- removeAnimation() now preserves opacity and visibility

**Updated Files:**
- `animations.js`: Enhanced animation completion handlers and removeAnimation()

---

## Fix: Force Element Visibility with !important

### Critical Fix: Use !important to prevent style override
- ✓ **!important flag**: Opacity and visibility now set with !important priority
- ✓ **Prevents override**: Something was reverting opacity back to 0 after animation
- ✓ **All code paths**: Applied to initial visibility, animationend, and timeout handlers
- ✓ **Guaranteed visibility**: Inline styles can no longer be overridden

**Root Cause Found:**
- Debug showed element had `opacity: 0; visibility: hidden` in DOM
- Even though code set `opacity: 1; visibility: visible`
- Something was overriding the inline styles after animation
- Solution: Use `setProperty(property, value, 'important')`

**Fix Applied to:**
1. Initial element visibility (when animation starts)
2. animationend event handler
3. Timeout fallback handler

**Updated Files:**
- `animations.js`: Changed all opacity/visibility sets to use setProperty with !important

---

## Smart Video Source Handling

### Feature: Improved video component with multi-source support
- ✓ **Smart URL parsing**: Automatically detects YouTube URLs, YouTube IDs, and internal MediaDB links
- ✓ **YouTube Embed Integration**: Uses `youtube-nocookie.com` for privacy-friendly YouTube embeds
- ✓ **Automatic iFrame switching**: Switches between `<video>` and `<iframe>` based on source type
- ✓ **YouTube parameter support**:
  - Autoplay (with mute for browser compatibility)
  - Loop (using YouTube playlist parameter)
  - Show/Hide controls
- ✓ **Aspect ratio preservation**: Automatically defaults to 16:9 for YouTube videos
- ✓ **Internal link support**: Handles both `media_` IDs and `local://` prefixed links
- ✓ **UI Feedback**: Updated properties panel placeholder to reflect new supported formats

**Supported Formats:**
1. **Complete YouTube URLs**: e.g., `https://youtu.be/u31qwQUeGuM?si=uh--jmUBUlH-6c5P`
2. **YouTube Video IDs**: e.g., `u31qwQUeGum`
3. **Internal MediaDB links**: e.g., `media_123456789` or `local://media_123456789`
4. **Direct Video URLs**: e.g., `https://example.com/video.mp4`

**Updated Files:**
- `VideoElement.js`: Implemented parsing and rendering logic for multiple sources
- `VideoPanel.js`: Updated UI placeholder for better user guidance

### Root Cause: `document.getElementById()` was finding editor elements instead of presentation elements

**Problem:**
- The editor canvas (`#slide-canvas`) and presentation view both render elements using `element.render()`, which creates DOM nodes with `el.id = this.id`
- Both sets of elements exist in the DOM simultaneously (editor is behind the fullscreen presentation overlay)
- `AnimationController` used `document.getElementById(element.id)` to find elements to animate
- `document.getElementById()` returns the **first** match in DOM order — the **editor** element, not the presentation element
- Animations were applied to the hidden editor elements; presentation elements stayed `opacity: 0; visibility: hidden`

**Fix:**
- `PlaybackController.showSlide()` now passes the `slideContainer` reference to `playSlideAnimations()`
- `AnimationController.playSlideAnimations()`, `playElementAnimation()`, and `playClickAnimations()` now accept a `container` parameter
- All element lookups use `container.querySelector('#id')` instead of `document.getElementById()`, scoping to the presentation container
- Also simplified `applyAnimation()`:
  - Removed inline `opacity` before animation starts (let CSS keyframes + fill-mode handle it)
  - Added `void element.offsetWidth` reflow to ensure animation triggers reliably
  - Consolidated completion handler into single `finalise()` function

**Updated Files:**
- `PlaybackController.js`: Pass slideContainer to animation system
- `AnimationController.js`: Scoped element lookups to container
- `animations.js`: Simplified and hardened applyAnimation()

---

## Magnetic Snap Rulers

### Feature: Magnetic snapping with visual snap guides when dragging elements
- ✓ **Magnetic snapping**: Elements now magnetically snap to alignment targets within 5px threshold
- ✓ **Canvas border snapping**: Snaps to left (0), right (1280), top (0), bottom (720) canvas edges
- ✓ **Canvas center snapping**: Snaps to horizontal (640) and vertical (360) canvas center
- ✓ **Element-to-element snapping**: Snaps to other elements' left, right, center, top, bottom, middle edges
- ✓ **Visual snap guides**: Blue lines for element alignment, orange lines for canvas border/center guides
- ✓ **Smart guide display**: Guides only shown when snap is active and not overridden by canvas constraints

**How It Works:**
1. During drag, `snapPosition()` calculates the closest snap target for each axis
2. Checks all edge combinations (left, right, center of dragged element vs all targets)
3. Picks the closest snap within threshold and applies the position adjustment
4. Shows colored guide lines at snap positions (blue = element, orange = canvas)
5. Canvas constraint is applied after snap to ensure element stays within bounds
6. Guides are hidden if the constraint overrides the snap position

**Updated Files:**
- `positioning.js`: Added `snapPosition()` function with canvas border and element snapping
- `DragHandler.js`: Integrated magnetic snapping into drag flow
- `AlignmentGuides.js`: Rewritten to support typed guides (element vs canvas) with `showGuides()` method
- `editor.css`: Added orange styling for canvas snap guides

---

## Multi-Element Selection

### Feature: Marquee selection, Ctrl+Click, multi-drag, multi-delete
- ✓ **Marquee selection**: Click-drag on canvas background draws a blue dashed rectangle; all elements within it become selected
- ✓ **Ctrl+Click toggle**: Hold Ctrl/Cmd and click individual elements to add/remove them from selection
- ✓ **Multi-element drag**: When multiple elements are selected, dragging one moves all of them together
- ✓ **Multi-element delete**: Press Delete/Backspace to remove all selected elements at once
- ✓ **Selection UI**: Multi-selected elements show blue outline but no resize/rotate handles; single selection retains full handles
- ✓ **Right sidebar info**: Shows "N elements selected" message when multiple elements are selected
- ✓ **Slide change cleanup**: Changing slides deselects all elements

**Updated Files:**
- `ElementController.js`: Replaced `selectedElement` with `Set`-based `_selectedElements`, added multi-selection methods (`addToSelection`, `removeFromSelection`, `toggleSelection`, `deselectAll`, `deleteSelectedElements`, `_updateSelectionUI`), backward-compatible getter/setter
- `DragHandler.js`: Multi-element drag support with `_multiDragStarts` Map; single drag retains snap+guides, multi drag uses raw dx/dy
- `MarqueeHandler.js`: New file — rubber-band rectangle selection on canvas background using `rectsIntersect()`
- `interactions/index.js`: Export `MarqueeHandler`
- `app.js`: Import and init `MarqueeHandler`, remove click-to-deselect listener, route Delete key to `deleteSelectedElements()`
- `RightSidebar.js`: Added `showMultiSelectionInfo(count)` method
- `SlideController.js`: Call `deselectAll()` at start of `selectSlide()`
- `EditorController.js`: Updated `deleteSelectedElement()` to delegate to `deleteSelectedElements()`

---

## Click Animations Advance with "Next" Key

### Feature: Arrow-right / Space / PageDown now advance click-triggered animations
- ✓ **Keyboard advancement**: Click-triggered animations can now be advanced with the same "next" keys used for slide navigation (ArrowRight, Space, PageDown)
- ✓ **Smart routing**: When click animations are pending, "next" advances the animation queue; once all are played, "next" moves to the next slide
- ✓ **Refactored AnimationController**: Click animation queue is now managed via `_clickAnimQueue` with public `hasPendingClickAnimations` getter and `advanceClickAnimation()` method
- ✓ **Proper cleanup**: `_cleanupClickListeners()` ensures all event handlers and state are reset on slide change or Escape

**Updated Files:**
- `AnimationController.js`: Refactored `playClickAnimations()` into queue-based system with `advanceClickAnimation()`, `hasPendingClickAnimations`, and `_cleanupClickListeners()`
- `PlaybackController.js`: `nextSlide()` checks for pending click animations before advancing

---

## Add Audio Element to Toolbar

### Feature: Audio element can now be added from the toolbar
- ✓ **Toolbar button**: Added "Add Audio" button (audiotrack icon) to the element toolbar
- ✓ **Settings panel**: AudioPanel already has Autoplay, Loop, Muted, and Show Controls checkboxes

**Updated Files:**
- `index.html`: Added `add-audio-btn` toolbar item
- `EditorController.js`: Wired up click handler for `add-audio-btn`

---

## Fix: Video/Image/Audio Elements Lost on Reload

### Critical Bug Fix: async toJSON() corrupting serialized data
- ✓ **Root cause**: `VideoElement.toJSON()`, `ImageElement.toJSON()`, and `AudioElement.toJSON()` were `async`, returning a Promise instead of an object when called synchronously by `saveSnapshot()` / `savePresentation()` / `JSON.stringify()`
- ✓ **Effect**: `JSON.stringify(promise)` produces `{}` — the entire element data (type, url, position) was silently lost; on reload, `{}` with no `type` became a text element
- ✓ **Fix**: Removed `async toJSON()` and `async fromJSON()` overrides from all three media element classes — the base `Element.toJSON()` already serializes all properties including `url`

### Secondary Fix: Element.getElementClass() always returned base Element
- ✓ **Root cause**: `getElementClass()` in `Element.js` had dynamic imports that were never used, always falling back to `return Element`
- ✓ **Effect**: `Element.clone()` (copy/paste/duplicate) and child element loading always created base `Element` instances instead of the correct subclass
- ✓ **Fix**: Replaced with a class registry pattern — each subclass calls `Element.registerClass(type, Class)` on load, avoiding circular imports

**Updated Files:**
- `Element.js`: Replaced broken `getElementClass()` with `Element._classRegistry` + `Element.registerClass()` pattern
- `VideoElement.js`: Removed `async toJSON()` and `async fromJSON()`, added `Element.registerClass('video', VideoElement)`
- `ImageElement.js`: Same — removed async overrides, added registration
- `AudioElement.js`: Same — removed async overrides, added registration
- `TextElement.js`, `ShapeElement.js`, `ListElement.js`, `LinkElement.js`: Added `Element.registerClass()` calls

---

## Shell Page Feature

### Feature: Persistent shell layer rendered on every slide during playback
- ✓ **Shell slide**: A special Slide stored as `Presentation.shell` (not in `slides[]` array) — avoids polluting slide numbering and navigation
- ✓ **Shell mode**: Configurable via `shellMode` — `'below'` (background) or `'above'` (overlay)
- ✓ **Shell editing**: Click the shell thumbnail in the sidebar to enter shell editing mode; canvas shows checkerboard for transparency
- ✓ **Shell thumbnail**: Purple dashed-border thumbnail at top of slide list; shows "+" icon when no shell exists, element previews when it does
- ✓ **Context menu**: Right-click shell thumbnail → "Remove Shell"
- ✓ **Shell settings panel**: Shell Mode dropdown and Remove Shell button in the Slide tab
- ✓ **Playback rendering**: Shell elements rendered in a separate DOM layer (above or below slide content) on every slide
- ✓ **Persistence**: Shell serialized in `toJSON()` / `fromJSON()`, backward-compatible (missing shell defaults to `null`)
- ✓ **Undo/redo**: Shell editing integrates with existing history system; `restoreFromHistory()` resets shell editing mode

**Use Cases:**
- Persistent branding, logos, watermarks
- Background decorations across all slides
- Persistent navigation or UI elements

**Updated Files:**
- `Presentation.js`: Added `shell`, `shellMode`, `createShell()`, `removeShell()`, `hasShell()`, updated `toJSON()`
- `EditorController.js`: Added `isEditingShell`, `getActiveSlide()`, `editShell()`, `exitShellEditing()`; updated `setupEventListeners()`, `updateUI()`, `restoreFromHistory()`
- `ElementController.js`: Replaced all `getCurrentSlide()` calls with `getActiveSlide()`
- `SlideController.js`: Added `createShellThumbnail()`, `showShellContextMenu()`; updated `renderSlides()`, `selectSlide()`, `renderCurrentSlide()`, drag guard
- `PlaybackController.js`: Shell/slide layer rendering in `showSlide()` with shellMode ordering
- `index.html`: Added shell settings section in right sidebar
- `sidebar.css`: Shell thumbnail styles (purple dashed border, shell label)

---

## Template Manager

### Feature: Create new slides from pre-designed layouts or user-saved templates
- ✓ **Built-in templates**: 6 pre-designed slide layouts (Blank, Title Slide, Title + Content, Section Divider, Two Column, Image Focus)
- ✓ **User templates**: Save any slide as a reusable template via "+" button or right-click context menu
- ✓ **Template Manager modal**: Dark-theme modal with grid view, search, and context menu
- ✓ **IndexedDB persistence**: User templates stored permanently in IndexedDB (`wow3_templates`)
- ✓ **Template operations**: Use, rename, delete user templates
- ✓ **Slide preview**: Miniature slide previews in template cards with positioned elements
- ✓ **Fresh IDs**: Templates use `Slide.clone()` to generate new IDs for slide and all elements
- ✓ **Search**: Filter both built-in and user templates by name
- ✓ **Undo support**: Template-created slides integrate with history system

**Access Points:**
1. Green dashboard icon button next to "New Slide" in left sidebar header
2. "+" button on slide thumbnails (top-left, hover reveal)
3. Right-click slide thumbnail → "Save as Template"

**New Files:**
- `js/utils/templates_db.js`: IndexedDB CRUD for user templates
- `js/utils/template_manager.js`: Template Manager modal UI + built-in templates
- `css/template-manager.css`: Dark-theme modal styling

**Updated Files:**
- `index.html`: Added CSS/script tags, Templates button in left sidebar header
- `js/controllers/SlideController.js`: Added "+" save-as-template button on thumbnails + context menu entry
- `js/controllers/EditorController.js`: Added `addSlideFromTemplate(slideData)` method + Slide import
- `js/views/UIManager.js`: Initialize TemplateManager + attach button handler

---

## Unified Playback Navigation

### Fix: Consistent advance behavior for all navigation inputs
- ✓ **ArrowLeft = advance**: ArrowLeft now advances forward (same as ArrowRight/Space/Click) instead of going backward
- ✓ **Mouse click = advance**: Clicking on the presentation view advances to the next animation or slide
- ✓ **Skip in-progress animations**: Pressing advance during an auto animation completes it immediately
- ✓ **Unified advance() method**: Single entry point handles: skip auto animation → advance click queue → next slide
- ✓ **Animation abort signal**: `applyAnimation()` now supports AbortSignal for instant skip
- ✓ **Proper cleanup on slide change**: Switching slides cancels all pending animations from the previous slide
- ✓ **Proper cleanup on stop**: Stopping playback resets all animation state

**Navigation mapping:**
- ArrowRight, ArrowLeft, Space, PageDown, Click → `advance()` (forward)
- PageUp → Previous slide
- Home → First slide, End → Last slide
- Escape → Stop playback

**Updated Files:**
- `js/utils/animations.js`: Added abort signal support to `applyAnimation()` with guard against double-resolve
- `js/controllers/AnimationController.js`: Added `isAnimating`, `skipCurrentAnimation()`, `cleanup()`, per-element AbortController, `_cancelled` flag for loop termination; removed click/escape handlers from `playClickAnimations` (PlaybackController now drives advancement)
- `js/controllers/PlaybackController.js`: Added unified `advance()`, ArrowLeft mapped to advance, click handler on presentation view, animation cleanup in `showSlide`/`stop`/`previousSlide`

---

## Shape Panel UI Fix

### Fix: Remove duplicate dropdown and inline color/stroke controls
- ✓ **Removed duplicate dropdown**: Shape Type `<select>` was rendered twice (native + MaterializeCSS overlay) because sidebar CSS forced `display: block` on native selects; removed `M.FormSelect.init()` from `createSelect()` helper
- ✓ **Inline Fill/Stroke/Width**: Fill Color, Stroke Color, and Stroke Width now displayed on a single row using `property-row three-col` grid

**Updated Files:**
- `js/views/RightSidebar.js`: Refactored `addShapeProperties()` to use three-col row; removed MaterializeCSS FormSelect initialization from `createSelect()`

---

## Self-Contained .wow3 ZIP Export/Import

### Feature: Export and import presentations as portable .wow3 ZIP files
- ✓ **ZIP export**: Export produces a `.wow3` file (ZIP) containing `presentation.json` + `assets/` folder with all referenced media blobs
- ✓ **ZIP import**: Import extracts assets, ingests them into MediaDB with new IDs, and rewrites paths back to media references
- ✓ **Legacy support**: `.json` / `.wow3.json` files still imported via the original plain-JSON path
- ✓ **Smart media collection**: Traverses slides, shell, and nested children to find all `media_*` and `local://media_*` references
- ✓ **External URLs preserved**: HTTP(S), YouTube, and data URLs are left untouched during export
- ✓ **Graceful missing media**: If a referenced media item no longer exists in IndexedDB, its URL is left unchanged with a console warning
- ✓ **Duplicate filename handling**: Assets with the same filename get `_1`, `_2` suffixes
- ✓ **MIME type restoration**: On import, MIME types are inferred from file extension (jpg, png, mp4, mp3, etc.)

**Updated Files:**
- `index.html`: Added JSZip CDN (`jszip/3.10.1`); renamed button tooltips to "Export Presentation" / "Import Presentation"
- `js/utils/storage.js`: Rewrote `exportPresentation()` (async, ZIP-based) and `importPresentation()` (ZIP + legacy JSON); added helpers `collectMediaIds()`, `rewriteMediaUrls()`, `importZip()`, `mimeFromFilename()`
- `js/controllers/EditorController.js`: Made `exportPresentation()` async to await the storage function

---

## Crop Mode for Image/Video Elements

### Feature: Double-click to crop images and videos
- ✓ **Double-click to enter crop mode**: Double-click on an image or video to enter crop mode with orange dashed outline
- ✓ **Side crop handles**: 4 side handles (top, right, bottom, left) resize the visible wrapper area
- ✓ **Content panning**: Drag the media content to reposition it within the crop frame
- ✓ **Content scaling**: 4 corner handles scale the content while keeping the wrapper size
- ✓ **Click-outside to exit**: Click outside the element or press Escape to exit crop mode
- ✓ **Proportional resize**: Resizing a cropped element in transform mode scales crop proportionally
- ✓ **Reset crop**: "Reset Crop" button in Image/Video panels to clear crop state
- ✓ **Persistence**: Crop state serialized automatically via toJSON()
- ✓ **YouTube excluded**: YouTube videos (iframes) cannot be cropped

**Data Model:**
- `crop: null` = no crop (normal rendering with object-fit)
- `crop: { contentWidth, contentHeight, contentLeft, contentTop }` = cropped state

**New Files:**
- `js/interactions/CropHandler.js`: New handler for crop mode interactions

**Updated Files:**
- `js/models/ImageElement.js`: Added crop property and cropped rendering
- `js/models/VideoElement.js`: Added crop property and cropped rendering
- `js/interactions/ResizeHandler.js`: Proportional crop scaling during transform resize
- `js/interactions/DragHandler.js`: Skip drag when in crop mode
- `js/interactions/index.js`: Export CropHandler
- `js/controllers/ElementController.js`: Crop mode management (enter/exit, double-click binding)
- `js/app.js`: CropHandler initialization and Escape key handling
- `js/panels/ImagePanel.js`: Reset Crop button
- `js/panels/VideoPanel.js`: Reset Crop button
- `css/editor.css`: Crop mode styles, crop handle styles, crop corner styles

---

## html2canvas Slide Thumbnails

### Feature: Auto-capture slide thumbnails using html2canvas with 5s debounce
- ✓ **html2canvas integration**: Slide thumbnails in the sidebar are now captured from the actual canvas
- ✓ **Debounced capture**: Thumbnail regeneration is debounced at 5 seconds after the last edit
- ✓ **Per-slide caching**: Thumbnails are cached by slide ID for instant display
- ✓ **Graceful fallback**: Simplified DOM-based previews shown until first capture completes
- ✓ **Clean captures**: Selection handles and outlines hidden during capture
- ✓ **Initial capture**: Thumbnails captured on first slide render with a 500ms delay for image loading

**Updated Files:**
- `index.html`: Added html2canvas CDN (v1.4.1)
- `js/controllers/SlideController.js`: Added `_thumbCache`, `scheduleThumbnailCapture()`, `_captureCurrentSlideThumbnail()`, `_updateThumbnailDOM()`; modified `createSlideThumbnail()` to use cached images
- `js/controllers/EditorController.js`: Call `scheduleThumbnailCapture()` from `recordHistory()`
- `css/editor.css`: Added `._thumb-hide-outline` class for clean captures

---

## Custom Toast Notification System

### Feature: Replace MaterializeCSS toasts with custom standalone system
- ✓ **New toast module**: `js/utils/toasts.js` — zero-dependency ES6 module
- ✓ **4 toast types**: `toast.success()`, `toast.error()`, `toast.warning()`, `toast.info()`
- ✓ **Rich animations**: Slide-in/slide-out with CSS keyframes, height collapse on exit
- ✓ **Progress bar**: Shows remaining time, pauses on hover
- ✓ **Hover pause**: Hovering a toast pauses auto-dismiss timer and progress bar
- ✓ **Close button**: Dismissible via × button with smooth animation
- ✓ **Stacking**: Multiple toasts stack with gap, bottom positions stack upward
- ✓ **6 positions**: TL, TC, TR, BL, BC, BR (default: bottom-right)
- ✓ **SVG icons**: Inline per-type icons (checkmark, X-circle, triangle, info-circle)
- ✓ **Self-contained CSS**: Styles injected lazily on first use, scoped with `.wow3-toast-*` prefix
- ✓ **Global access**: Exposed as `window.toast` for non-module scripts

**New Files:**
- `js/utils/toasts.js`: Complete toast notification system

**Updated Files (M.toast → toast.*):**
- `js/app.js`: Import toast, replaced 2 calls
- `js/views/UIManager.js`: Import toast, rewrote `showToast()` with color→type mapping
- `js/views/RightSidebar.js`: Import toast, replaced 3 calls
- `js/controllers/EditorController.js`: Import toast, replaced 10 calls
- `js/controllers/SlideController.js`: Import toast, replaced 1 call
- `js/controllers/ElementController.js`: Import toast, replaced 8 calls
- `js/controllers/PlaybackController.js`: Import toast, replaced 2 calls
- `js/controllers/AnimationController.js`: Import toast, replaced 1 call
- `js/panels/ImagePanel.js`: Import toast, replaced 6 calls
- `js/panels/VideoPanel.js`: Import toast, replaced 6 calls
- `js/panels/AudioPanel.js`: Import toast, replaced 6 calls
- `js/utils/template_manager.js`: Uses `window.toast`, replaced 6 calls
- `js/utils/presentation_manager.js`: Uses `window.toast`, replaced 5 calls
- `css/components.css`: Removed old `#toast-container` and `.toast` CSS overrides

---

## Fix: Presentation Manager Thumbnail Matches Sidebar

### Fix: Use html2canvas thumbnail for saved presentations
- ✓ **Consistent thumbnails**: Presentation Manager now shows the exact same thumbnail as the sidebar
- ✓ **Reuse cached thumbnail**: Grabs the first slide's html2canvas thumbnail from `SlideController._thumbCache`
- ✓ **Fallback capture**: If cache is empty, captures a fresh html2canvas thumbnail (switches to first slide, captures, restores)
- ✓ **No more manual canvas drawing**: Removed reliance on the limited `generateThumbnail()` that only supported text/image/shape
- ✓ **No slide-switching flicker**: When a cached thumbnail exists, no slide switching is needed at all

**Before:** `generateThumbnail()` manually drew elements onto a 400×300 canvas (skipping video, audio, complex elements)
**After:** Reuses the html2canvas capture already done for the sidebar, pixel-for-pixel match

**Updated Files:**
- `js/controllers/EditorController.js`: Rewrote `savePresentation()` to pass cached thumbnail; added `_captureSlideThumb()` fallback

---

## Countdown Timer Element

### Feature: Cross-slide countdown timer with live playback
- **CountdownTimerElement**: New element type that displays a countdown timer on slides
- **Cross-slide persistence**: Timer starts on the slide that defines it and continues running across subsequent slides, regardless of navigation direction
- **Inheritance rules**: Slides without a timer inherit the active one; slides with a new timer replace the old; slides with `clear=true` stop and hide the timer
- **Display format**: `>= 2 min` shows `"X m"`, `60-119s` shows `"1:SS"`, `< 60s` shows `"SS"`, `0` shows `"00"`
- **Completion sound**: Configurable sound from Media Library plays when timer reaches zero
- **Ghost rendering**: In the editor, slides that inherit a timer show a semi-transparent ghost at the same position; clicking the ghost materializes a real timer element on that slide
- **Clear variant**: Timer elements with `clear=true` display a red diagonal cross overlay
- **Properties panel**: Content tab (duration minutes/seconds, completion sound, clear checkbox) + Style tab (font family/size/color, background, border color/width/radius)

**New Files:**
- `js/models/CountdownTimerElement.js`: Element subclass with duration, soundId, clear, background, border properties
- `js/panels/CountdownTimerPanel.js`: Content + Style tab property panel
- `css/countdown-timer.css`: Styles for timer element, clear cross, ghost, and playback overlay

**Updated Files:**
- `js/utils/constants.js`: Added `COUNTDOWN_TIMER` to `ElementType` and `DEFAULT_SIZE`
- `js/models/index.js`: Added `CountdownTimerElement` export
- `js/panels/index.js`: Added `CountdownTimerPanel` export
- `js/controllers/ElementController.js`: Added `CountdownTimerElement` to class map
- `js/views/RightSidebar.js`: Added `countdown_timer` case to `updateProperties()` switch
- `index.html`: Added toolbar button (timer icon) and CSS link
- `js/controllers/EditorController.js`: Added click handler for `#add-countdown-btn`
- `js/controllers/SlideController.js`: Added `_findInheritedCountdownTimer()` and `_renderCountdownGhost()` for ghost rendering in `renderCurrentSlide()`
- `js/controllers/PlaybackController.js`: Added `_activeCountdown` state, `_resolveCountdownForSlide()`, `_startCountdown()`, `_stopCountdown()`, `_renderCountdownDOM()`, `_playCompletionSound()` for live countdown during playback

---

## Global Countdown Timer Style

### Feature: Timer style settings are shared across all timers in the presentation
- Changing any style property (font family, font size, font color, background, border color/width/radius) on one countdown timer automatically propagates the change to all other countdown timer elements in the presentation
- Content properties (duration, sound, clear) remain per-element
- Style tab controls in the panel now call `syncCountdownTimerStyle()` which walks all slides (and shell) to update every timer

**Updated Files:**
- `js/controllers/ElementController.js`: Added `syncCountdownTimerStyle(property, value)` method
- `js/panels/CountdownTimerPanel.js`: Style controls now use `updateStyleProperty()` which calls both `updateElementProperty()` and `syncCountdownTimerStyle()`

---

## Fix: Countdown Timer Playback Bugs

### Fix: Timer no longer resets when revisiting the defining slide
- `_resolveCountdownForSlide()` now checks if the active countdown is already from the same element (by ID) and returns `'inherit'` instead of `'new'`, preventing stop+restart
- Navigating backward/forward through the defining slide keeps the timer counting uninterrupted

### Fix: Hide static timer element during playback
- Countdown timer elements rendered by `slide.elements.forEach()` are now hidden during playback (`display: none`)
- The live `playback-countdown` overlay is the sole visible timer, eliminating initial-time flash and double rendering

**Updated Files:**
- `js/controllers/PlaybackController.js`: Fixed `_resolveCountdownForSlide()` same-element check; added static `.countdown-timer-element` hiding in `showSlide()`

---

## Fix: Countdown Timer Lost on Reload

### Fix: Timer elements properly deserialized from saved presentations
- `Slide.js` had its own `getElementClass()` function (separate from `Element._classRegistry`) that did not include `countdown_timer`
- On reload, timer elements were deserialized as base `Element` instances, losing their custom rendering and behavior
- The `type` string was preserved (`'countdown_timer'`), so ghost inheritance detection still worked, causing ghosts to appear without a visible timer
- Added `CountdownTimerElement` import and entry to the `getElementClass` map in `Slide.js`

**Updated Files:**
- `js/models/Slide.js`: Added `CountdownTimerElement` import and `countdown_timer` entry to `getElementClass()`

---

## Multi-Element Copy / Cut / Paste / Duplicate

### Feature: Clipboard operations now work with single and multi-element selections
- ✓ **Multi-element copy (Ctrl+C)**: Copies all selected elements with their relative positions preserved via bounding-box tracking
- ✓ **Cut (Ctrl+X)**: New shortcut — copies selected elements to clipboard, then removes them from the slide
- ✓ **Multi-element paste (Ctrl+V)**: Pastes all clipboard elements with fresh IDs (parent + children), offset +20px from original position
- ✓ **Cascading paste offset**: Successive pastes cascade at +20px increments (+20, +40, +60...)
- ✓ **Multi-element duplicate (Ctrl+D)**: Duplicates all selected elements at once with +20px offset
- ✓ **Cross-slide paste**: Clipboard persists on ElementController across slide navigations
- ✓ **Cross-presentation paste**: Clipboard persists across presentation loads (same session)
- ✓ **Selection after paste/duplicate**: All pasted/duplicated elements are auto-selected (single → selectElement, multi → addToSelection loop)

**Clipboard data format:**
```js
{ elements: Object[] /* toJSON snapshots */, boundingBox: { x, y, width, height } }
```

**Updated Files:**
- `js/controllers/ElementController.js`: Added `Element` and `generateId` imports; added `_computeBoundingBox()` helper; replaced `copySelectedElement()` → `copySelectedElements()`, `pasteElement()` → `pasteElements()`, `duplicateSelectedElement()` → `duplicateSelectedElements()`; added `cutSelectedElements()`
- `js/app.js`: Renamed method calls for Ctrl+C/V/D; added Ctrl+X shortcut for cut
- `js/controllers/EditorController.js`: Removed unused `this.clipboard = null`

---

## Drag-and-Drop Media Files onto Canvas

### Feature: Drag files from the file system directly onto the canvas
- ✓ **HTML5 drag-and-drop**: Drag image, video, or audio files from the file system onto the canvas
- ✓ **Auto-detect type**: MIME type prefix (`image/`, `video/`, `audio/`) determines element type
- ✓ **Drop position**: Element centered on the drop point, clamped to canvas bounds
- ✓ **MediaDB upload**: Files automatically uploaded to IndexedDB via existing `updateMediaUrl()` pipeline
- ✓ **Multi-file drop**: Dropping multiple files creates one element per file
- ✓ **Visual feedback**: Blue dashed outline on canvas while dragging files over it
- ✓ **Non-media ignored**: Unsupported file types (e.g. .txt) are silently ignored

**New Files:**
- `js/interactions/CanvasDropHandler.js`: HTML5 drag-and-drop handler for external files

**Updated Files:**
- `js/controllers/ElementController.js`: Added `createMediaElement(type, file, dropPosition)` method; imported `CANVAS` constants
- `js/interactions/index.js`: Export `CanvasDropHandler`
- `js/app.js`: Import and initialize `CanvasDropHandler` after MarqueeHandler
- `css/editor.css`: Added `.canvas-drop-active` style for drag-over visual feedback

---

## Media Deduplication via Content Hash

### Feature: Avoid duplicate media files in MediaDB using SHA-256 content hashing
- ✓ **SHA-256 hashing**: Every file uploaded to MediaDB gets a content hash via Web Crypto API
- ✓ **Deduplication**: `addMedia()` checks for an existing item with the same hash before inserting
- ✓ **Reuse existing**: If a duplicate is found, the existing media item is returned (no new entry created)
- ✓ **Hash index**: New `hash` index on the `media_items` store for fast lookups (DB version 2→3)
- ✓ **Backward compatible**: Falls back to cursor scan if the hash index doesn't exist yet
- ✓ **Transparent**: Works for all upload paths (drag-and-drop, file picker, import) since dedup lives in `addMedia()`

**Updated Files:**
- `js/utils/media_db.js`: Bumped DB version to 3; added `hash` index; added `_computeHash()` and `findByHash()` methods; modified `addMedia()` to hash-and-deduplicate

---

## Auto-Resize Image Elements to Actual Dimensions

### Feature: Image elements automatically resize to match the actual image size
- ✓ **Auto-resize on drop**: Dragging an image file onto the canvas creates an element sized to the image's natural dimensions
- ✓ **Auto-resize on assign**: Selecting an image from Media Manager or uploading via the panel resizes the element to match
- ✓ **Scale to fit canvas**: Images larger than 1280x720 are scaled down proportionally to fit within the canvas
- ✓ **Small images kept as-is**: Images smaller than the canvas use their natural dimensions (no upscaling)
- ✓ **Aspect ratio stored**: `properties.aspectRatio` is set from the actual image dimensions
- ✓ **Position clamped**: After resize, element position is clamped so it stays within canvas bounds
- ✓ **Drop centering preserved**: Drag-and-drop path resizes before positioning, so the element is centered on the drop point at its actual size

**Updated Files:**
- `js/controllers/ElementController.js`: Added `_resolveImageSize()` and `_autoResizeImage()` helpers; integrated auto-resize into `updateMediaUrl()` and `createMediaElement()`

---

## Double-Click Empty Image/Video Opens Media Manager

### Feature: Double-click on empty image or video element opens Media Manager
- ✓ **Empty element detection**: Checks `element.properties.url` to determine if element has media assigned
- ✓ **Media Manager opens**: Double-clicking an empty image or video element opens the Media Manager with a selection callback
- ✓ **Media assigned on pick**: Selecting a media item assigns it to the element via `updateMediaUrl()` (auto-resize included)
- ✓ **Crop mode preserved**: Double-clicking an image/video that already has media still enters crop mode as before

**Updated Files:**
- `js/controllers/ElementController.js`: Modified `attachHandlers()` double-click logic for image/video/audio; added `_openMediaManagerFor()` method

---

## Persist Slide Thumbnails in IndexedDB

### Fix: Slide thumbnails no longer lost on reload
- ✓ **IndexedDB persistence**: Thumbnails saved to `slide_thumbnails` store in MediaDB (version 4)
- ✓ **Save on capture**: Every html2canvas capture is persisted asynchronously to IndexedDB
- ✓ **Load on startup**: `loadThumbnailsFromDB()` hydrates the in-memory cache from IndexedDB before rendering the sidebar
- ✓ **Cache cleared on switch**: Loading a different presentation or creating a new one clears the old thumbnail cache
- ✓ **Instant sidebar**: On reload, previously captured thumbnails appear immediately instead of falling back to simplified previews

**Updated Files:**
- `js/utils/media_db.js`: Bumped version to 4; added `slide_thumbnails` store; added `saveThumbnail()`, `loadThumbnails()`, `deleteThumbnail()`, `clearAllThumbnails()` methods
- `js/controllers/SlideController.js`: Added `loadThumbnailsFromDB()`; persist thumbnail in `_captureCurrentSlideThumbnail()`
- `js/controllers/EditorController.js`: Call `loadThumbnailsFromDB()` in `render()` before `renderSlides()`; clear thumb cache in `createNewPresentation()` and `loadPresentation()`; delete thumbnail from cache and IndexedDB in `deleteSlide()` and remove-shell button
- `js/controllers/SlideController.js`: Added `loadThumbnailsFromDB()`; persist thumbnail in `_captureCurrentSlideThumbnail()`; delete shell thumbnail in context menu "Remove Shell"
- `js/utils/presentation_manager.js`: Delete all slide thumbnails from IndexedDB when a presentation is deleted

---

## GitHub Pages Deployment

### Feature: Deploy to GitHub Pages via GitHub Actions
- ✓ **GitHub Actions workflow**: Deploys the static site on every push to `master`
- ✓ **Manual trigger**: Can also be triggered manually via `workflow_dispatch`
- ✓ **No build step**: Deploys the repo root directly (static site)
- ✓ **`.gitignore`**: Added to exclude `.claude/`, swap files, `node_modules/`, `TODO.md`

**New Files:**
- `.github/workflows/deploy.yml`: GitHub Pages deployment workflow
- `.gitignore`: Exclude dev-only files from the repository

---

## Slide Name on Thumbnail Hover

### Feature: Show slide title on hover over thumbnail
- ✓ **Hover reveal**: Slide title appears at the bottom of the thumbnail when hovering
- ✓ **Solid background**: Dark semi-transparent background for readability
- ✓ **Text overflow**: Long titles are truncated with ellipsis
- ✓ **Smooth transition**: 150ms fade-in/out transition

**Updated Files:**
- `js/controllers/SlideController.js`: Added `.slide-name-label` element in `createSlideThumbnail()`
- `css/sidebar.css`: Added `.slide-name-label` styles with hover reveal via `.slide-thumbnail:hover`

---

## Clip Shapes for Image and Video Elements

### Feature: Crop images and videos to geometric shapes
- ✓ **Shape types**: Circle and Rectangle clip shapes for image and video elements
- ✓ **Circle clipping**: `clip-path: circle(closest-side at center)` clips media to a true circle inscribed in the element, without forcing the element to be square
- ✓ **Rectangle clipping**: Clips with optional border-radius for rounded rectangles
- ✓ **Shape border**: Configurable border width (0-20px) and color on the shape outline; circle borders use a separate overlay element since clip-path clips borders
- ✓ **Content scaling**: Media inside the shape can be scaled (50-200%) for zoom control
- ✓ **Works with crops**: Shape wrapper sits outside the crop clipper, both features compose correctly
- ✓ **YouTube support**: YouTube video iframes also clip to shapes
- ✓ **Persistence**: All properties serialized automatically via existing `toJSON()`/`fromJSON()`
- ✓ **Playback**: Shapes render identically in presentation mode (same `render()` method)

**New Properties (ImageElement + VideoElement):**
- `clipShape`: `'none'` | `'circle'` | `'rectangle'` (default: `'none'`)
- `shapeBorderWidth`: Border width in px (default: `0`)
- `shapeBorderColor`: Border color hex (default: `'#000000'`)
- `shapeScale`: Content scale percentage (default: `100`)

**Updated Files:**
- `js/models/ImageElement.js`: Added clip shape properties; added `_createShapeWrapper()`, `_createCircleBorder()`, and `_createScaleContainer()` helpers; modified `render()` to wrap content in shape wrapper when active
- `js/models/VideoElement.js`: Same additions as ImageElement; YouTube overlay placed outside shape wrapper
- `js/panels/ImagePanel.js`: Added Clip Shape section to Style tab (shape selector, border width/color, content scale); force panel re-render on shape change
- `js/panels/VideoPanel.js`: Added Clip Shape section to Settings tab with same controls
- `js/interactions/ResizeHandler.js`: Circle clip no longer forces 1:1 aspect ratio; uses image's natural aspect ratio instead
- `css/editor.css`: Added `.clip-shape-wrapper` and `.clip-shape-content` CSS classes

---

## Fix: Circle Clip Shape No Longer Forces Square

### Fix: Rectangular images keep their dimensions when clipped to circle
- ✓ **No square enforcement**: Selecting circle clip shape no longer resizes the element to a square
- ✓ **True circle clipping**: Uses `clip-path: circle(closest-side at center)` instead of `border-radius: 50%`, which creates a true circle inscribed in the shorter dimension (not an ellipse)
- ✓ **Natural aspect ratio preserved**: Resize handler uses the image's natural aspect ratio, not a forced 1:1
- ✓ **Border overlay**: Circle borders use a separate positioned element (`_createCircleBorder()`) since `clip-path` clips CSS borders; the border element uses `aspect-ratio: 1; max-height: 100%` to stay circular and responsive during resize
- ✓ **Applied to both Image and Video elements**

**Updated Files:**
- `js/models/ImageElement.js`: Changed `_createShapeWrapper()` to use `clip-path: circle()` for circles; added `_createCircleBorder()` method; updated `render()` to append border element
- `js/models/VideoElement.js`: Same changes as ImageElement
- `js/panels/ImagePanel.js`: Removed square enforcement from clip shape change handler
- `js/panels/VideoPanel.js`: Removed square enforcement from clip shape change handler
- `js/interactions/ResizeHandler.js`: Removed circle-specific 1:1 aspect ratio lock

---

## Fix: Prevent Element Duplication on Re-render

### Fix: Defensive cleanup in element re-render paths
- ✓ **Remove all stale nodes**: `updateElementProperty` now uses `querySelectorAll` to remove ALL DOM nodes with the element's ID before appending the new one, preventing duplicate elements from accumulating
- ✓ **Validate nextSibling**: Checks that `nextSibling` is still a child of the canvas before using `insertBefore`, falling back to `appendChild` if the reference is stale
- ✓ **CropHandler hardened**: Same defensive cleanup applied to `_reRenderElement` in CropHandler, which is vulnerable to stale DOM references if the element was re-rendered while crop mode was active

**Updated Files:**
- `js/controllers/ElementController.js`: Defensive `querySelectorAll` cleanup + `nextSibling` validation in `updateElementProperty`
- `js/interactions/CropHandler.js`: Same defensive cleanup in `_reRenderElement`
