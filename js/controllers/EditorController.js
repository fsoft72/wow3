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
import { toast } from '../utils/toasts.js';

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
    this.animationEditorController = null;
    this.playbackController = null;

    // History management
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = 50;
    this.unsavedChanges = false;

    // Shell editing state
    this.isEditingShell = false;
    this.editingShellId = null;

    // Shell preview overlay while editing a regular slide
    this.showShellPreview = false;
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

    const addCountdownBtn = document.getElementById('add-countdown-btn');
    if (addCountdownBtn) {
      addCountdownBtn.addEventListener('click', () => this.addElement('countdown_timer'));
    }

    const addEmptyBtn = document.getElementById('add-empty-btn');
    if (addEmptyBtn) {
      addEmptyBtn.addEventListener('click', () => this.addElement('empty'));
    }

    // Slide background gradient selector
    if ( window.GradientManager && window.GradientSelector ) {
      GradientManager.init();
      this._bgSelector = new GradientSelector('slide-background-gradient-selector', {
        value: '#ffffff',
        animationSpeed: 0,
        animationType: 'pingpong',
        onChange: (cssValue, animationSpeed, animationType) => {
          const activeSlide = this.getActiveSlide();
          activeSlide.setBackground(cssValue, animationSpeed, animationType);
          this.recordHistory();
          this.render();
        }
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

    // Shell assignment dropdown (per-slide)
    const slideShellSelect = document.getElementById('slide-shell-select');
    if (slideShellSelect) {
      slideShellSelect.addEventListener('change', (e) => {
        const activeSlide = this.getActiveSlide();
        activeSlide.shellId = e.target.value || null;
        this.recordHistory();
        this.updateUI();
        if (this.slideController) {
          this.slideController.renderCurrentSlide();
        }
      });
    }

    // Shell mode dropdown (per-slide)
    const slideShellMode = document.getElementById('slide-shell-mode');
    if (slideShellMode) {
      slideShellMode.addEventListener('change', (e) => {
        const activeSlide = this.getActiveSlide();
        activeSlide.shellMode = e.target.value;
        this.recordHistory();
        if (this.slideController) {
          this.slideController.renderCurrentSlide();
        }
      });
    }

    // Shell preview toggle button
    const shellPreviewBtn = document.getElementById('shell-preview-btn');
    if (shellPreviewBtn) {
      shellPreviewBtn.addEventListener('click', () => {
        this.showShellPreview = !this.showShellPreview;
        this.updateUI();
        if (this.slideController) {
          this.slideController.renderCurrentSlide();
        }
      });
    }

    // Listen to presentation changes
    appEvents.on(AppEvents.PRESENTATION_CHANGED, () => {
      this.unsavedChanges = true;
    });
  }

  /**
   * Create new presentation
   * @param {boolean} [skipConfirm=false] - Skip confirmation dialog (used at startup)
   */
  async createNewPresentation(skipConfirm = false) {
    if (!skipConfirm) {
      // Show confirmation dialog
      const message = this.unsavedChanges
        ? 'You have unsaved changes. Creating a new presentation will discard all current work and clear the canvas. Continue?'
        : 'This will clear the canvas and create a new presentation. Continue?';

      const confirmed = await Dialog.confirm(message, 'New Presentation');
      if (!confirmed) return;
    }

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

    // Clear in-memory thumbnail cache for the old presentation
    if (this.slideController) {
      this.slideController._thumbCache.clear();
    }

    // Completely clear the canvas
    const canvas = document.getElementById('slide-canvas');
    if (canvas) {
      canvas.innerHTML = '';
    }

    // Re-render the new presentation
    await this.render();

    // Save snapshot of new presentation
    saveSnapshot(this.presentation);

    toast.success('New presentation created');
    appEvents.emit(AppEvents.PRESENTATION_CREATED, this.presentation);
  }

  /**
   * Load presentation from data
   * @param {Object} data - Presentation data
   */
  async loadPresentation(data) {
    try {
      // Clear old thumbnail cache before loading new presentation
      if (this.slideController) {
        this.slideController._thumbCache.clear();
      }

      this.presentation = Presentation.fromJSON(data);
      this.resetHistory();
      await this.render();

      // Update localStorage snapshot to reflect the newly loaded presentation
      saveSnapshot(this.presentation);

      toast.success('Presentation loaded');
      appEvents.emit(AppEvents.PRESENTATION_LOADED, this.presentation);
    } catch (error) {
      console.error('Failed to load presentation:', error);
      toast.error('Failed to load presentation');
    }
  }

  /**
   * Save presentation to IndexedDB (permanent storage)
   * Called when user explicitly clicks "Save" button or Ctrl+S
   */
  async savePresentation() {
    if (!this.presentation) return;

    try {
      // Reuse the html2canvas thumbnail already cached for the first slide
      const firstSlide = this.presentation.slides[0];
      let thumbnail = firstSlide
        ? this.slideController._thumbCache.get(firstSlide.id)
        : null;

      // If no cached thumbnail yet, capture it now via html2canvas
      if (!thumbnail && firstSlide) {
        thumbnail = await this._captureSlideThumb(firstSlide);
      }

      const success = await savePresentation(this.presentation, thumbnail);

      if (success) {
        this.unsavedChanges = false;
        toast.success('Presentation saved');
        appEvents.emit(AppEvents.PRESENTATION_SAVED, this.presentation);
      } else {
        toast.error('Failed to save presentation');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save presentation');
    }
  }

  /**
   * Capture a slide thumbnail via html2canvas when no cache is available.
   * Temporarily switches to the target slide, captures, then restores.
   * @param {Slide} slide - The slide to capture
   * @returns {Promise<string|null>} PNG data URL or null
   * @private
   */
  async _captureSlideThumb(slide) {
    if (typeof html2canvas === 'undefined') return null;

    const canvas = document.getElementById('slide-canvas');
    if (!canvas) return null;

    const originalIndex = this.presentation.currentSlideIndex;
    const targetIndex = this.presentation.slides.indexOf(slide);
    const needsSwitch = targetIndex !== -1 && targetIndex !== originalIndex;

    try {
      if (needsSwitch) {
        this.presentation.setCurrentSlide(targetIndex);
        await this.slideController.renderCurrentSlide();
        await new Promise(r => setTimeout(r, 200));
      }

      const handles = canvas.querySelectorAll('.resize-handle, .rotate-handle, .crop-handle, .crop-corner');
      const selectedEls = canvas.querySelectorAll('.element.selected');
      selectedEls.forEach(el => el.classList.add('_thumb-hide-outline'));
      handles.forEach(h => { h.style.display = 'none'; });

      const captured = await html2canvas(canvas, {
        scale: 0.25,
        useCORS: true,
        logging: false,
        backgroundColor: null,
      });

      handles.forEach(h => { h.style.display = ''; });
      selectedEls.forEach(el => el.classList.remove('_thumb-hide-outline'));

      const dataUrl = captured.toDataURL('image/png');

      // Cache for future sidebar use
      this.slideController._thumbCache.set(slide.id, dataUrl);

      return dataUrl;
    } catch (err) {
      console.warn('Thumbnail capture failed:', err);
      return null;
    } finally {
      if (needsSwitch) {
        this.presentation.setCurrentSlide(originalIndex);
        await this.slideController.renderCurrentSlide();
      }
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
   * Export presentation as .wow3 ZIP
   */
  async exportPresentation() {
    if (!this.presentation) return;

    try {
      await exportPresentation(this.presentation);
      toast.success('Presentation exported');
    } catch (error) {
      console.error('Failed to export presentation:', error);
      toast.error('Failed to export presentation');
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
      toast.error('Failed to import presentation');
    }
  }

  /**
   * Render entire presentation
   */
  async render() {
    if (!this.presentation) return;

    // Load persisted thumbnails before rendering sidebar
    if (this.slideController) {
      await this.slideController.loadThumbnailsFromDB();
    }

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

    if ( this._bgSelector ) {
      this._bgSelector.update(activeSlide.background, activeSlide.backgroundAnimationSpeed, activeSlide.backgroundAnimationType);
    }

    // Shell dropdown — populate with available shells
    const hasShells = this.presentation.hasShells();
    const slideShellField = document.getElementById('slide-shell-field');
    const slideShellSelect = document.getElementById('slide-shell-select');
    if (slideShellField && slideShellSelect) {
      slideShellField.style.display = hasShells && !this.isEditingShell ? 'block' : 'none';

      if (hasShells && !this.isEditingShell) {
        // Rebuild options
        slideShellSelect.innerHTML = '<option value="">None</option>';
        for (const shell of this.presentation.shells) {
          const option = document.createElement('option');
          option.value = shell.id;
          option.textContent = shell.title;
          if (activeSlide.shellId === shell.id) {
            option.selected = true;
          }
          slideShellSelect.appendChild(option);
        }
      }
    }

    // Shell mode dropdown — visible only when a shell is selected
    const slideShellModeField = document.getElementById('slide-shell-mode-field');
    const slideShellModeSelect = document.getElementById('slide-shell-mode');
    if (slideShellModeField && slideShellModeSelect) {
      const showMode = hasShells && !this.isEditingShell && activeSlide.shellId;
      slideShellModeField.style.display = showMode ? 'block' : 'none';
      if (showMode) {
        slideShellModeSelect.value = activeSlide.shellMode || 'above';
      }
    }

    // Shell preview toggle button — visible when slide has a shell assigned and not editing shell
    const shellPreviewBtn = document.getElementById('shell-preview-btn');
    if (shellPreviewBtn) {
      const showBtn = !this.isEditingShell && activeSlide.shellId;
      shellPreviewBtn.style.display = showBtn ? 'inline-flex' : 'none';
      shellPreviewBtn.classList.toggle('active', this.showShellPreview);
      const icon = shellPreviewBtn.querySelector('i');
      if (icon) {
        icon.textContent = this.showShellPreview ? 'layers' : 'layers_clear';
      }
    }
  }

  /**
   * Get the slide currently being edited (shell or normal slide)
   * @returns {Slide} Active slide
   */
  getActiveSlide() {
    if (this.isEditingShell && this.editingShellId) {
      const shell = this.presentation.getShellById(this.editingShellId);
      if (shell) return shell;
    }
    return this.presentation.getCurrentSlide();
  }

  /**
   * Enter shell editing mode for a specific shell
   * @param {string} shellId - Shell ID to edit
   */
  editShell(shellId) {
    if (!shellId) return;

    const shell = this.presentation.getShellById(shellId);
    if (!shell) return;

    // Flush any pending thumbnail capture before switching to shell
    if (this.slideController) {
      this.slideController.flushThumbnailCapture();
    }

    this.isEditingShell = true;
    this.editingShellId = shellId;

    if (this.elementController) {
      this.elementController.deselectAll();
    }

    this.render();

    // Update shells tab if visible
    if (this.slideController) {
      this.slideController.renderShells();
    }
  }

  /**
   * Exit shell editing mode and return to normal slide editing
   */
  exitShellEditing() {
    this.isEditingShell = false;
    this.editingShellId = null;

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

    // Assign default shell if the template doesn't have a specific shell
    if (!newSlide.shellId && this.presentation.defaultShellId) {
      newSlide.shellId = this.presentation.defaultShellId;
    }

    const insertIndex = this.presentation.currentSlideIndex + 1;
    this.presentation.addSlide(newSlide, insertIndex);
    this.presentation.setCurrentSlide(insertIndex);

    this.recordHistory();
    this.render();

    toast.success('Slide created from template');
    appEvents.emit(AppEvents.SLIDE_ADDED, newSlide);
  }

  /**
   * Delete slide
   * @param {number} index - Slide index
   */
  async deleteSlide(index) {
    if (this.presentation.slides.length <= 1) {
      toast.warning('Cannot delete last slide');
      return;
    }

    const confirmed = await Dialog.confirm('Delete this slide?', 'Delete Slide');
    if (!confirmed) return;

    const slide = this.presentation.slides[index];
    const slideId = slide?.id;
    const thumbId = slide?.thumbnailId;
    const success = this.presentation.removeSlide(index);
    if (success) {
      // Clean up persisted thumbnail
      if (slideId) {
        this.slideController._thumbCache.delete(slideId);
      }
      if (thumbId) {
        window.MediaDB.deleteThumbnail(thumbId).catch(() => {});
      }

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

    // Schedule debounced thumbnail capture for the active slide
    if (this.slideController) {
      this.slideController.scheduleThumbnailCapture();
    }
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
    this.editingShellId = null;
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
