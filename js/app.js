/**
 * WOW3 Application Bootstrap
 * Main entry point for the application
 */

import { UIManager } from './views/UIManager.js';
import { toast } from './utils/toasts.js';
import {
  EditorController,
  SlideController,
  ElementController,
  AnimationEditorController,
  PlaybackController
} from './controllers/index.js';
import {
  DragHandler,
  ResizeHandler,
  RotateHandler,
  MarqueeHandler,
  CropHandler,
  CanvasDropHandler
} from './interactions/index.js';

class WOW3App {
  constructor() {
    this.editor = null;
    this.uiManager = null;
    this.initialized = false;
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log('Initializing WOW3...');

    try {
      // Initialize MaterializeCSS components
      this.initMaterialize();

      // Initialize UI Manager
      this.uiManager = new UIManager();
      await this.uiManager.init();

      // Initialize Editor Controller
      this.editor = new EditorController(this.uiManager);
      await this.editor.init();

      // Initialize sub-controllers
      this.editor.slideController = new SlideController(this.editor);
      this.editor.elementController = new ElementController(this.editor);
      this.editor.animationEditorController = new AnimationEditorController(this.editor);
      this.editor.playbackController = new PlaybackController(this.editor);

      await this.editor.slideController.init();
      await this.editor.elementController.init();
      await this.editor.animationEditorController.init();
      await this.editor.playbackController.init();

      // Initialize interaction handlers
      this.editor.elementController.dragHandler = new DragHandler(this.editor.elementController);
      this.editor.elementController.resizeHandler = new ResizeHandler(this.editor.elementController);
      this.editor.elementController.rotateHandler = new RotateHandler(this.editor.elementController);
      this.editor.elementController.cropHandler = new CropHandler(this.editor.elementController);

      // Initialize marquee handler
      const marqueeHandler = new MarqueeHandler(this.editor.elementController);
      marqueeHandler.init();

      // Initialize canvas drop handler (drag-and-drop media files)
      const canvasDropHandler = new CanvasDropHandler(this.editor.elementController);
      canvasDropHandler.init();

      // Load or create presentation
      await this.loadPresentation();

      // Setup global event listeners
      this.setupGlobalEvents();

      // Setup keyboard shortcuts
      this.setupKeyboardShortcuts();

      this.initialized = true;
      console.log('WOW3 initialized successfully');

      // Show welcome message
      toast.success('WOW3 Ready!');
    } catch (error) {
      console.error('Failed to initialize WOW3:', error);
      toast.error('Failed to initialize WOW3');
    }
  }

  /**
   * Initialize MaterializeCSS components
   */
  initMaterialize() {
    document.addEventListener('DOMContentLoaded', () => {
      // Initialize all Materialize components
      M.AutoInit();

      // Initialize specific components
      const tabs = document.querySelectorAll('.tabs');
      M.Tabs.init(tabs);

      const modals = document.querySelectorAll('.modal');
      M.Modal.init(modals);

      const selects = document.querySelectorAll('select:not(.browser-default)');
      M.FormSelect.init(selects);

      const dropdowns = document.querySelectorAll('.dropdown-trigger');
      M.Dropdown.init(dropdowns);

      console.log('MaterializeCSS components initialized');
    });
  }

  /**
   * Load or create presentation
   * Priority: 1. localStorage snapshot (current working), 2. IndexedDB (last saved), 3. New
   */
  async loadPresentation() {
    try {
      // Import storage utilities dynamically
      const { loadSnapshot, getAllPresentations } = await import('./utils/storage.js');

      // Try to load snapshot first (current working presentation)
      const snapshot = loadSnapshot();
      if (snapshot) {
        await this.editor.loadPresentation(snapshot);
        console.log('📸 Loaded presentation from snapshot');
        return;
      }

      // Try to load last saved presentation from IndexedDB
      const presentations = await getAllPresentations();
      if (presentations && presentations.length > 0) {
        // Load the most recently modified presentation
        const lastPresentation = presentations[0];
        const { loadPresentation } = await import('./utils/storage.js');
        const data = await loadPresentation(lastPresentation.id);

        if (data) {
          await this.editor.loadPresentation(data);
          console.log('💾 Loaded last saved presentation from IndexedDB');
          return;
        }
      }

      // No saved data, create new presentation
      await this.editor.createNewPresentation();
      console.log('✨ Created new presentation');
    } catch (error) {
      console.error('Failed to load presentation:', error);
      await this.editor.createNewPresentation();
    }
  }

  /**
   * Setup global event listeners
   */
  setupGlobalEvents() {
    // Auto-save interval
    setInterval(() => {
      if (this.editor && this.editor.hasUnsavedChanges && this.editor.hasUnsavedChanges()) {
        console.log('Auto-saving...');
        this.editor.autoSave();
      }
    }, 30000); // Every 30 seconds

    // Window resize
    window.addEventListener('resize', () => {
      if (this.uiManager && this.uiManager.handleResize) {
        this.uiManager.handleResize();
      }
    });

    // Before unload warning
    window.addEventListener('beforeunload', (e) => {
      if (this.editor && this.editor.hasUnsavedChanges && this.editor.hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    });

    // Click outside to deselect is handled by MarqueeHandler
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // Don't trigger shortcuts when typing in input fields
      if (e.target.tagName === 'INPUT' ||
          e.target.tagName === 'TEXTAREA' ||
          e.target.contentEditable === 'true') {
        // Allow only Ctrl+S in input fields
        if (ctrl && e.key === 's') {
          e.preventDefault();
          if (this.editor && this.editor.savePresentation) {
            this.editor.savePresentation();
          }
        }
        return;
      }

      // Save: Ctrl+S
      if (ctrl && e.key === 's') {
        e.preventDefault();
        if (this.editor && this.editor.savePresentation) {
          this.editor.savePresentation();
        }
      }
      // Undo: Ctrl+Z
      else if (ctrl && e.key === 'z' && !shift) {
        e.preventDefault();
        if (this.editor && this.editor.undo) {
          this.editor.undo();
        }
      }
      // Redo: Ctrl+Y or Ctrl+Shift+Z
      else if ((ctrl && e.key === 'y') || (ctrl && shift && e.key === 'z')) {
        e.preventDefault();
        if (this.editor && this.editor.redo) {
          this.editor.redo();
        }
      }
      // Delete: Delete or Backspace
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (this.editor && this.editor.elementController) {
          this.editor.elementController.deleteSelectedElements();
        }
      }
      // Arrow keys: move selected element(s)
      else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (this.editor && this.editor.elementController && this.editor.elementController.selectedElement) {
          e.preventDefault();
          const step = shift ? 10 : 1;
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          this.editor.elementController.nudgeSelected(dx, dy);
        }
      }
      // Copy: Ctrl+C
      else if (ctrl && e.key === 'c') {
        e.preventDefault();
        if (this.editor && this.editor.elementController) {
          this.editor.elementController.copySelectedElements();
        }
      }
      // Cut: Ctrl+X
      else if (ctrl && e.key === 'x') {
        e.preventDefault();
        if (this.editor && this.editor.elementController) {
          this.editor.elementController.cutSelectedElements();
        }
      }
      // Paste: Ctrl+V
      else if (ctrl && e.key === 'v') {
        e.preventDefault();
        if (this.editor && this.editor.elementController) {
          this.editor.elementController.pasteElements();
        }
      }
      // Duplicate: Ctrl+D
      else if (ctrl && e.key === 'd') {
        e.preventDefault();
        if (this.editor && this.editor.elementController) {
          this.editor.elementController.duplicateSelectedElements();
        }
      }
      // Play: F5
      else if (e.key === 'F5') {
        e.preventDefault();
        if (this.editor && this.editor.playbackController) {
          this.editor.playbackController.start();
        }
      }
      // Escape: Exit play mode, exit crop mode, or deselect
      else if (e.key === 'Escape') {
        if (this.editor && this.editor.playbackController && this.editor.playbackController.isPlaying) {
          this.editor.playbackController.stop();
        } else if (this.editor && this.editor.elementController && this.editor.elementController._cropMode) {
          this.editor.elementController.exitCropMode();
        } else if (this.editor && this.editor.elementController) {
          this.editor.elementController.deselectElement();
        }
      }
    });
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    console.log('Shutting down WOW3...');
    // Cleanup logic here
  }
}

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new WOW3App();
    window.app.init();
  });
} else {
  // DOM is already ready
  window.app = new WOW3App();
  window.app.init();
}

// Make app available globally
export default WOW3App;
