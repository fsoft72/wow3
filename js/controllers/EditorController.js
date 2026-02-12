/**
 * WOW3 Editor Controller
 * Main controller coordinating all editor operations
 */

import { Presentation } from '../models/Presentation.js';
import { savePresentation, loadPresentation, exportPresentation, importPresentation } from '../utils/storage.js';
import { appEvents, AppEvents } from '../utils/events.js';

export class EditorController {
  /**
   * Create editor controller
   * @param {UIManager} uiManager - UI manager instance
   */
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.presentation = null;

    // Sub-controllers (will be set externally)
    this.slideController = null;
    this.elementController = null;
    this.animationController = null;
    this.playbackController = null;

    // History management
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = 50;
    this.unsavedChanges = false;

    // Clipboard
    this.clipboard = null;
  }

  /**
   * Initialize editor controller
   */
  async init() {
    console.log('Initializing EditorController...');

    // Setup event listeners
    this.setupEventListeners();

    // Initialize with empty presentation (will be loaded later)
    this.presentation = new Presentation();

    console.log('EditorController initialized');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Toolbar events
    const newBtn = document.getElementById('new-btn');
    if (newBtn) {
      newBtn.addEventListener('click', () => this.createNewPresentation());
    }

    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.savePresentation());
    }

    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportPresentation());
    }

    const importBtn = document.getElementById('import-btn');
    if (importBtn) {
      importBtn.addEventListener('click', () => this.importPresentation());
    }

    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (this.playbackController) {
          this.playbackController.start();
        }
      });
    }

    // Add element buttons
    const addTextBtn = document.getElementById('add-text-btn');
    if (addTextBtn) {
      addTextBtn.addEventListener('click', () => this.addElement('text'));
    }

    const addImageBtn = document.getElementById('add-image-btn');
    if (addImageBtn) {
      addImageBtn.addEventListener('click', () => this.addElement('image'));
    }

    const addVideoBtn = document.getElementById('add-video-btn');
    if (addVideoBtn) {
      addVideoBtn.addEventListener('click', () => this.addElement('video'));
    }

    const addShapeBtn = document.getElementById('add-shape-btn');
    if (addShapeBtn) {
      addShapeBtn.addEventListener('click', () => this.addElement('shape'));
    }

    // Slide background color
    const slideBackground = document.getElementById('slide-background');
    if (slideBackground) {
      slideBackground.addEventListener('change', (e) => {
        const currentSlide = this.presentation.getCurrentSlide();
        currentSlide.setBackground(e.target.value);
        this.recordHistory();
        this.render();
      });
    }

    // Slide title
    const slideTitle = document.getElementById('slide-title');
    if (slideTitle) {
      slideTitle.addEventListener('change', (e) => {
        const currentSlide = this.presentation.getCurrentSlide();
        currentSlide.setTitle(e.target.value);
        this.recordHistory();
      });
    }

    // Listen to presentation changes
    appEvents.on(AppEvents.PRESENTATION_CHANGED, () => {
      this.unsavedChanges = true;
    });
  }

  /**
   * Create new presentation
   */
  async createNewPresentation() {
    if (this.unsavedChanges) {
      const confirmed = confirm('You have unsaved changes. Create new presentation?');
      if (!confirmed) return;
    }

    this.presentation = new Presentation();
    this.resetHistory();
    await this.render();

    M.toast({ html: 'New presentation created', classes: 'green' });
    appEvents.emit(AppEvents.PRESENTATION_CREATED, this.presentation);
  }

  /**
   * Load presentation from data
   * @param {Object} data - Presentation data
   */
  async loadPresentation(data) {
    try {
      this.presentation = Presentation.fromJSON(data);
      this.resetHistory();
      await this.render();

      M.toast({ html: 'Presentation loaded', classes: 'green' });
      appEvents.emit(AppEvents.PRESENTATION_LOADED, this.presentation);
    } catch (error) {
      console.error('Failed to load presentation:', error);
      M.toast({ html: 'Failed to load presentation', classes: 'red' });
    }
  }

  /**
   * Save presentation
   */
  savePresentation() {
    if (!this.presentation) return;

    const success = savePresentation(this.presentation);

    if (success) {
      this.unsavedChanges = false;
      M.toast({ html: 'Presentation saved', classes: 'green' });
      appEvents.emit(AppEvents.PRESENTATION_SAVED, this.presentation);
    } else {
      M.toast({ html: 'Failed to save presentation', classes: 'red' });
    }
  }

  /**
   * Auto-save presentation
   */
  autoSave() {
    if (this.unsavedChanges && this.presentation) {
      console.log('Auto-saving presentation...');
      savePresentation(this.presentation);
    }
  }

  /**
   * Export presentation as JSON
   */
  exportPresentation() {
    if (!this.presentation) return;

    try {
      exportPresentation(this.presentation);
      M.toast({ html: 'Presentation exported', classes: 'green' });
    } catch (error) {
      console.error('Failed to export presentation:', error);
      M.toast({ html: 'Failed to export presentation', classes: 'red' });
    }
  }

  /**
   * Import presentation from JSON file
   */
  async importPresentation() {
    try {
      const data = await importPresentation();
      await this.loadPresentation(data);
    } catch (error) {
      console.error('Failed to import presentation:', error);
      M.toast({ html: 'Failed to import presentation', classes: 'red' });
    }
  }

  /**
   * Render entire presentation
   */
  async render() {
    if (!this.presentation) return;

    // Render slides in left sidebar
    if (this.slideController) {
      await this.slideController.renderSlides();
    }

    // Render current slide in canvas
    if (this.slideController) {
      await this.slideController.renderCurrentSlide();
    }

    // Update UI
    this.updateUI();
  }

  /**
   * Update UI elements
   */
  updateUI() {
    // Update status bar
    const slideCounter = document.getElementById('slide-counter');
    if (slideCounter) {
      slideCounter.textContent = `Slide ${this.presentation.currentSlideIndex + 1} of ${this.presentation.slides.length}`;
    }

    // Update slide properties panel
    const currentSlide = this.presentation.getCurrentSlide();
    const slideTitle = document.getElementById('slide-title');
    if (slideTitle) {
      slideTitle.value = currentSlide.title;
    }

    const slideBackground = document.getElementById('slide-background');
    if (slideBackground) {
      slideBackground.value = currentSlide.background;
    }
  }

  /**
   * Add element to current slide
   * @param {string} type - Element type
   */
  addElement(type) {
    if (this.elementController) {
      this.elementController.createElement(type);
      this.recordHistory();
    }
  }

  /**
   * Delete selected element
   */
  deleteSelectedElement() {
    if (this.elementController && this.elementController.selectedElement) {
      this.elementController.deleteElement(this.elementController.selectedElement.id);
      this.recordHistory();
    }
  }

  /**
   * Add new slide
   */
  addSlide() {
    const slide = this.presentation.addSlide();
    this.recordHistory();
    this.render();
    this.presentation.setCurrentSlide(this.presentation.slides.length - 1);

    appEvents.emit(AppEvents.SLIDE_ADDED, slide);
  }

  /**
   * Delete slide
   * @param {number} index - Slide index
   */
  deleteSlide(index) {
    if (this.presentation.slides.length <= 1) {
      M.toast({ html: 'Cannot delete last slide', classes: 'orange' });
      return;
    }

    const confirmed = confirm('Delete this slide?');
    if (!confirmed) return;

    const success = this.presentation.removeSlide(index);
    if (success) {
      this.recordHistory();
      this.render();
      appEvents.emit(AppEvents.SLIDE_REMOVED, index);
    }
  }

  /**
   * Duplicate slide
   * @param {number} index - Slide index
   */
  duplicateSlide(index) {
    const clonedSlide = this.presentation.duplicateSlide(index);
    if (clonedSlide) {
      this.recordHistory();
      this.render();
      appEvents.emit(AppEvents.SLIDE_ADDED, clonedSlide);
    }
  }

  // ==================== HISTORY MANAGEMENT ====================

  /**
   * Record current state in history
   */
  recordHistory() {
    if (!this.presentation) return;

    const state = JSON.stringify(this.presentation.toJSON());

    // Remove future history if we're in the middle
    this.history = this.history.slice(0, this.historyIndex + 1);

    // Add new state
    this.history.push(state);

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }

    this.unsavedChanges = true;
    appEvents.emit(AppEvents.HISTORY_CHANGED, {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    });
  }

  /**
   * Undo last action
   */
  undo() {
    if (this.canUndo()) {
      this.historyIndex--;
      this.restoreFromHistory();
      appEvents.emit(AppEvents.HISTORY_UNDO);
    }
  }

  /**
   * Redo last undone action
   */
  redo() {
    if (this.canRedo()) {
      this.historyIndex++;
      this.restoreFromHistory();
      appEvents.emit(AppEvents.HISTORY_REDO);
    }
  }

  /**
   * Check if can undo
   * @returns {boolean}
   */
  canUndo() {
    return this.historyIndex > 0;
  }

  /**
   * Check if can redo
   * @returns {boolean}
   */
  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }

  /**
   * Restore presentation from history
   */
  async restoreFromHistory() {
    const state = this.history[this.historyIndex];
    const data = JSON.parse(state);
    this.presentation = Presentation.fromJSON(data);
    await this.render();
  }

  /**
   * Reset history
   */
  resetHistory() {
    this.history = [JSON.stringify(this.presentation.toJSON())];
    this.historyIndex = 0;
    this.unsavedChanges = false;
  }

  /**
   * Check if has unsaved changes
   * @returns {boolean}
   */
  hasUnsavedChanges() {
    return this.unsavedChanges;
  }
}

export default EditorController;
