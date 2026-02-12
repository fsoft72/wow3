/**
 * WOW3 Editor Controller
 * Main controller coordinating all editor operations
 */

import { Presentation } from '../models/Presentation.js';
import { Slide } from '../models/Slide.js';
import {
  savePresentation,
  loadPresentation,
  saveSnapshot,
  loadSnapshot,
  exportPresentation,
  importPresentation,
  clearSnapshot
} from '../utils/storage.js';
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

    // Shell editing state
    this.isEditingShell = false;

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
    // Presentation title input
    const titleInput = document.getElementById('presentation-title-input');
    if (titleInput) {
      titleInput.addEventListener('change', (e) => {
        if (this.presentation) {
          this.presentation.title = e.target.value || 'Untitled Presentation';
          this.presentation.updateModified();
          this.unsavedChanges = true;
        }
      });
    }

    // Toolbar events
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
      playBtn.addEventListener('click', (e) => {
        if (this.playbackController) {
          const fromIndex = e.shiftKey ? this.presentation.currentSlideIndex : 0;
          this.playbackController.start(fromIndex);
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

    const addAudioBtn = document.getElementById('add-audio-btn');
    if (addAudioBtn) {
      addAudioBtn.addEventListener('click', () => this.addElement('audio'));
    }

    // Slide background color
    const slideBackground = document.getElementById('slide-background');
    if (slideBackground) {
      slideBackground.addEventListener('change', (e) => {
        const activeSlide = this.getActiveSlide();
        activeSlide.setBackground(e.target.value);
        this.recordHistory();
        this.render();
      });
    }

    // Slide title
    const slideTitle = document.getElementById('slide-title');
    if (slideTitle) {
      slideTitle.addEventListener('change', (e) => {
        const activeSlide = this.getActiveSlide();
        activeSlide.setTitle(e.target.value);
        this.recordHistory();
      });
    }

    // Hide shell on this slide
    const slideHideShell = document.getElementById('slide-hide-shell');
    if (slideHideShell) {
      slideHideShell.addEventListener('change', (e) => {
        const activeSlide = this.getActiveSlide();
        activeSlide.hideShell = e.target.checked;
        this.recordHistory();
      });
    }

    // Shell mode select
    const shellModeSelect = document.getElementById('shell-mode-select');
    if (shellModeSelect) {
      shellModeSelect.addEventListener('change', (e) => {
        this.presentation.shellMode = e.target.value;
        this.recordHistory();
      });
    }

    // Remove shell button
    const removeShellBtn = document.getElementById('remove-shell-btn');
    if (removeShellBtn) {
      removeShellBtn.addEventListener('click', () => {
        this.presentation.removeShell();
        this.exitShellEditing();
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
    // Show confirmation dialog
    const message = this.unsavedChanges
      ? 'You have unsaved changes. Creating a new presentation will discard all current work and clear the canvas. Continue?'
      : 'This will clear the canvas and create a new presentation. Continue?';

    const confirmed = await Dialog.confirm(message, 'New Presentation');
    if (!confirmed) return;

    // Clear localStorage snapshots
    clearSnapshot();

    // Deselect any selected element
    if (this.elementController) {
      this.elementController.deselectElement();
    }

    // Create new presentation
    this.presentation = new Presentation();
    this.resetHistory();
    this.unsavedChanges = false;

    // Completely clear the canvas
    const canvas = document.getElementById('slide-canvas');
    if (canvas) {
      canvas.innerHTML = '';
    }

    // Re-render the new presentation
    await this.render();

    // Save snapshot of new presentation
    saveSnapshot(this.presentation);

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

      // Update localStorage snapshot to reflect the newly loaded presentation
      saveSnapshot(this.presentation);

      M.toast({ html: 'Presentation loaded', classes: 'green' });
      appEvents.emit(AppEvents.PRESENTATION_LOADED, this.presentation);
    } catch (error) {
      console.error('Failed to load presentation:', error);
      M.toast({ html: 'Failed to load presentation', classes: 'red' });
    }
  }

  /**
   * Save presentation to IndexedDB (permanent storage)
   * Called when user explicitly clicks "Save" button or Ctrl+S
   */
  async savePresentation() {
    if (!this.presentation) return;

    try {
      // Save current slide index
      const currentSlideIndex = this.presentation.currentSlideIndex;

      // Temporarily switch to first slide for thumbnail capture
      if (currentSlideIndex !== 0 && this.presentation.slides.length > 0) {
        this.presentation.setCurrentSlide(0);
        await this.slideController.renderCurrentSlide();
        // Wait for render to complete
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Save presentation (will generate thumbnail from first slide)
      const success = await savePresentation(this.presentation);

      // Restore original slide
      if (currentSlideIndex !== 0) {
        this.presentation.setCurrentSlide(currentSlideIndex);
        await this.slideController.renderCurrentSlide();
      }

      if (success) {
        this.unsavedChanges = false;
        M.toast({ html: '💾 Presentation saved to IndexedDB', classes: 'green' });
        appEvents.emit(AppEvents.PRESENTATION_SAVED, this.presentation);
      } else {
        M.toast({ html: '❌ Failed to save presentation', classes: 'red' });
      }
    } catch (error) {
      console.error('Save error:', error);
      M.toast({ html: '❌ Failed to save presentation', classes: 'red' });
    }
  }

  /**
   * Auto-save presentation to localStorage (snapshot for crash recovery)
   * Called every 30 seconds automatically
   */
  autoSave() {
    if (this.unsavedChanges && this.presentation) {
      console.log('📸 Auto-saving snapshot to localStorage...');
      saveSnapshot(this.presentation);
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
    // Update presentation title input
    const titleInput = document.getElementById('presentation-title-input');
    if (titleInput && this.presentation) {
      titleInput.value = this.presentation.title;
    }

    // Update status bar
    const slideCounter = document.getElementById('slide-counter');
    if (slideCounter) {
      if (this.isEditingShell) {
        slideCounter.textContent = 'Editing Shell';
      } else {
        slideCounter.textContent = `Slide ${this.presentation.currentSlideIndex + 1} of ${this.presentation.slides.length}`;
      }
    }

    // Update slide properties panel using the active slide
    const activeSlide = this.getActiveSlide();
    const slideTitle = document.getElementById('slide-title');
    if (slideTitle) {
      slideTitle.value = activeSlide.title;
    }

    const slideBackground = document.getElementById('slide-background');
    if (slideBackground) {
      slideBackground.value = activeSlide.background;
    }

    // Shell settings section visibility
    const shellSection = document.getElementById('shell-settings-section');
    if (shellSection) {
      shellSection.style.display = this.presentation.hasShell() ? 'block' : 'none';
    }

    const shellModeSelect = document.getElementById('shell-mode-select');
    if (shellModeSelect) {
      shellModeSelect.value = this.presentation.shellMode;
    }

    // Hide-shell-per-slide checkbox (only visible when shell exists and not editing the shell itself)
    const hasShell = this.presentation.hasShell();
    const hideShellField = document.getElementById('hide-shell-field');
    if (hideShellField) {
      hideShellField.style.display = hasShell && !this.isEditingShell ? 'block' : 'none';
    }
    const slideHideShell = document.getElementById('slide-hide-shell');
    if (slideHideShell) {
      slideHideShell.checked = activeSlide.hideShell || false;
    }
  }

  /**
   * Get the slide currently being edited (shell or normal slide)
   * @returns {Slide} Active slide
   */
  getActiveSlide() {
    if (this.isEditingShell && this.presentation.shell) {
      return this.presentation.shell;
    }
    return this.presentation.getCurrentSlide();
  }

  /**
   * Enter shell editing mode (creates shell if needed)
   */
  editShell() {
    this.presentation.createShell();
    this.isEditingShell = true;

    if (this.elementController) {
      this.elementController.deselectAll();
    }

    this.render();
  }

  /**
   * Exit shell editing mode and return to normal slide editing
   */
  exitShellEditing() {
    this.isEditingShell = false;

    if (this.elementController) {
      this.elementController.deselectAll();
    }

    this.render();
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
   * Delete selected element(s)
   */
  deleteSelectedElement() {
    if (this.elementController) {
      this.elementController.deleteSelectedElements();
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
   * Add a new slide from a template's slide data
   * @param {Object} slideData - Slide JSON data from a template
   */
  addSlideFromTemplate(slideData) {
    const tempSlide = Slide.fromJSON(slideData);
    const newSlide = tempSlide.clone();

    const insertIndex = this.presentation.currentSlideIndex + 1;
    this.presentation.addSlide(newSlide, insertIndex);
    this.presentation.setCurrentSlide(insertIndex);

    this.recordHistory();
    this.render();

    M.toast({ html: 'Slide created from template', classes: 'green' });
    appEvents.emit(AppEvents.SLIDE_ADDED, newSlide);
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
    this.isEditingShell = false;
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
