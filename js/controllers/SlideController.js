/**
 * WOW3 Slide Controller
 * Manages slide operations and rendering
 */

import { appEvents, AppEvents } from '../utils/events.js';
import { toast } from '../utils/toasts.js';
import { CountdownTimerElement } from '../models/CountdownTimerElement.js';

export class SlideController {
  /**
   * Create slide controller
   * @param {EditorController} editorController - Editor controller instance
   */
  constructor(editorController) {
    this.editor = editorController;
    this.draggedSlide = null;

    /** @type {Map<string, string>} Cached thumbnail data URLs keyed by slide id */
    this._thumbCache = new Map();

    /** @type {number|null} Debounce timer for thumbnail capture */
    this._thumbTimer = null;

    /** @type {number} Debounce delay in ms */
    this.THUMB_DEBOUNCE_MS = 2000;
  }

  /**
   * Initialize slide controller
   */
  async init() {
    console.log('Initializing SlideController...');
    this.setupSlideEvents();
    console.log('SlideController initialized');
  }

  /**
   * Load persisted slide thumbnails from IndexedDB into the in-memory cache.
   * Should be called after a presentation is loaded, before renderSlides().
   */
  async loadThumbnailsFromDB() {
    if (!this.editor.presentation) return;

    // Build a map of thumbnailId → slideId for reverse lookup
    const thumbToSlide = new Map();
    for (const slide of this.editor.presentation.slides) {
      if (slide.thumbnailId) thumbToSlide.set(slide.thumbnailId, slide.id);
    }
    // Include shell slides
    for (const shell of this.editor.presentation.shells) {
      if (shell.thumbnailId) {
        thumbToSlide.set(shell.thumbnailId, shell.id);
      }
    }

    const thumbnailIds = [...thumbToSlide.keys()];
    if (thumbnailIds.length === 0) return;

    try {
      const thumbs = await window.MediaDB.loadThumbnails(thumbnailIds);
      for (const [thumbId, dataUrl] of thumbs) {
        const slideId = thumbToSlide.get(thumbId);
        if (slideId) this._thumbCache.set(slideId, dataUrl);
      }
      if (thumbs.size > 0) {
        console.log(`📸 Loaded ${thumbs.size} slide thumbnails from IndexedDB`);
      }
    } catch (err) {
      console.warn('Failed to load thumbnails from IndexedDB:', err);
    }
  }

  /**
   * Setup slide-related event listeners
   */
  setupSlideEvents() {
    const slideList = document.getElementById('slide-list');
    if (!slideList) return;

    // Sidebar tab switching
    const sidebarTabs = document.querySelectorAll('.sidebar-tab');
    sidebarTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.sidebarTab;
        sidebarTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.sidebar-tab-content').forEach(c => {
          c.classList.remove('active');
          c.style.display = 'none';
        });

        const targetContent = document.getElementById(`sidebar-tab-${targetTab}`);
        if (targetContent) {
          targetContent.classList.add('active');
          targetContent.style.display = 'block';
        }

        // Re-render shells when switching to shells tab
        if (targetTab === 'shells') {
          this.renderShells();
        }
      });
    });

    // Add slide button
    const addSlideBtn = document.getElementById('add-slide-btn');
    if (addSlideBtn) {
      addSlideBtn.addEventListener('click', () => {
        this.editor.addSlide();
      });
    }

    // Add shell button
    const addShellBtn = document.getElementById('add-shell-btn');
    if (addShellBtn) {
      addShellBtn.addEventListener('click', () => {
        this.addShell();
      });
    }

    // Drag and drop for reordering
    slideList.addEventListener('dragstart', (e) => {
      if (e.target.classList.contains('slide-thumbnail')) {
        this.draggedSlide = e.target;
        e.dataTransfer.effectAllowed = 'move';
        e.target.classList.add('dragging');
      }
    });

    slideList.addEventListener('dragend', (e) => {
      if (e.target.classList.contains('slide-thumbnail')) {
        e.target.classList.remove('dragging');
        this.draggedSlide = null;
      }
    });

    slideList.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const afterElement = this.getDragAfterElement(slideList, e.clientY);
      const dragging = document.querySelector('.slide-thumbnail.dragging');

      if (dragging) {
        if (afterElement == null) {
          slideList.appendChild(dragging);
        } else {
          slideList.insertBefore(dragging, afterElement);
        }
      }
    });

    slideList.addEventListener('drop', (e) => {
      e.preventDefault();
      this.handleSlideReorder();
    });
  }

  /**
   * Get element to insert dragged slide before
   * @param {HTMLElement} container - Container element
   * @param {number} y - Y coordinate
   * @returns {HTMLElement|null} Element or null
   */
  getDragAfterElement(container, y) {
    const draggableElements = [
      ...container.querySelectorAll('.slide-thumbnail:not(.dragging)')
    ];

    return draggableElements.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY }
    ).element;
  }

  /**
   * Handle slide reordering after drag-drop
   */
  handleSlideReorder() {
    const thumbnails = document.querySelectorAll('.slide-thumbnail');
    const newOrder = Array.from(thumbnails).map((thumb) =>
      parseInt(thumb.dataset.slideIndex)
    );

    // Reorder slides in presentation model
    const newSlides = newOrder.map(
      (index) => this.editor.presentation.slides[index]
    );

    // Update presentation
    this.editor.presentation.slides = newSlides;

    // Update current slide index
    const currentSlideId = this.editor.presentation.getCurrentSlide().id;
    const newIndex = newSlides.findIndex((slide) => slide.id === currentSlideId);
    this.editor.presentation.currentSlideIndex = newIndex;

    this.editor.recordHistory();
    this.renderSlides();
  }

  /**
   * Render all slides in the sidebar
   */
  async renderSlides() {
    const slideList = document.getElementById('slide-list');
    if (!slideList) return;

    slideList.innerHTML = '';

    this.editor.presentation.slides.forEach((slide, index) => {
      const thumbnail = this.createSlideThumbnail(slide, index);
      slideList.appendChild(thumbnail);
    });
  }

  /**
   * Create slide thumbnail element
   * @param {Slide} slide - Slide object
   * @param {number} index - Slide index
   * @returns {HTMLElement} Thumbnail element
   */
  createSlideThumbnail(slide, index) {
    const div = document.createElement('div');
    div.className = 'slide-thumbnail';
    if (index === this.editor.presentation.currentSlideIndex) {
      div.classList.add('active');
    }
    if (!slide.visible) {
      div.classList.add('slide-hidden');
    }
    div.dataset.slideIndex = index;
    div.draggable = true;

    // Slide number
    const number = document.createElement('div');
    number.className = 'slide-number';
    number.textContent = index + 1;
    div.appendChild(number);

    // Visibility toggle (eye icon)
    const eyeBtn = document.createElement('div');
    eyeBtn.className = 'slide-visibility-btn';
    eyeBtn.title = slide.visible ? 'Hide slide' : 'Show slide';
    eyeBtn.innerHTML = `<i class="material-icons">${slide.visible ? 'visibility' : 'visibility_off'}</i>`;
    eyeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      slide.visible = !slide.visible;
      this.editor.recordHistory();
      this.renderSlides();
    });
    div.appendChild(eyeBtn);

    // Thumbnail preview
    const preview = document.createElement('div');
    preview.className = 'slide-preview';
    preview.dataset.slideId = slide.id;
    preview.style.cssText = `
      width: 100%;
      height: 100%;
      background: ${slide.background};
      position: relative;
      overflow: hidden;
    `;

    // Use cached html2canvas thumbnail if available, otherwise simplified preview
    const cachedThumb = this._thumbCache.get(slide.id);
    if (cachedThumb) {
      const img = document.createElement('img');
      img.src = cachedThumb;
      img.style.cssText = 'width:100%;height:100%;object-fit:fill;display:block;';
      preview.appendChild(img);
    } else {
      // Simplified fallback
      slide.elements.forEach((element, idx) => {
        const elementPreview = this.createElementPreview(element, idx);
        if (elementPreview) {
          preview.appendChild(elementPreview);
        }
      });
    }

    div.appendChild(preview);

    // Slide name label (shown on hover, click to edit)
    const nameLabel = document.createElement('div');
    nameLabel.className = 'slide-name-label';
    nameLabel.textContent = slide.title || 'Untitled Slide';
    nameLabel.addEventListener('click', (e) => {
      e.stopPropagation();
      this._startInlineRename(div, slide, nameLabel);
    });
    div.appendChild(nameLabel);

    // Click to select slide
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

  /**
   * Start inline renaming of a slide directly on its thumbnail
   * @param {HTMLElement} thumbnailDiv - The thumbnail container element
   * @param {Slide} slide - The slide being renamed
   * @param {HTMLElement} nameLabel - The label element to replace with input
   */
  _startInlineRename(thumbnailDiv, slide, nameLabel) {
    // Prevent opening multiple inputs
    if (thumbnailDiv.querySelector('.slide-name-input')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'slide-name-input';
    input.value = slide.title || '';

    /** Commit the rename and restore the label */
    const commit = () => {
      const newTitle = input.value.trim() || 'Untitled Slide';
      slide.setTitle(newTitle);
      nameLabel.textContent = newTitle;
      input.replaceWith(nameLabel);

      // Keep the right-sidebar title input in sync
      const slideTitleInput = document.getElementById('slide-title');
      if (slideTitleInput && this.editor.presentation.getCurrentSlide() === slide) {
        slideTitleInput.value = newTitle;
      }

      this.editor.recordHistory();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
      if (e.key === 'Escape') {
        // Restore original value and cancel
        input.value = slide.title || 'Untitled Slide';
        input.blur();
      }
    });

    // Prevent thumbnail click / drag while editing
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('mousedown', (e) => e.stopPropagation());

    nameLabel.replaceWith(input);
    input.focus();
    input.select();
  }


  // ==================== SHELLS TAB ====================

  /**
   * Render all shell cards in the Shells tab
   */
  renderShells() {
    const shellList = document.getElementById('shell-list');
    if (!shellList) return;

    shellList.innerHTML = '';

    const shells = this.editor.presentation.shells;
    if (shells.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'shell-list-empty';
      empty.innerHTML = '<i class="material-icons">layers</i><p>No shells yet.<br>Click "New Shell" to create one.</p>';
      shellList.appendChild(empty);
      return;
    }

    shells.forEach((shell, index) => {
      const card = this.createShellCard(shell, index);
      shellList.appendChild(card);
    });
  }

  /**
   * Create a shell card element for the Shells tab
   * @param {Slide} shell - Shell slide object
   * @param {number} index - Shell index
   * @returns {HTMLElement} Shell card element
   */
  createShellCard(shell, index) {
    const isDefault = this.editor.presentation.defaultShellId === shell.id;
    const isEditing = this.editor.isEditingShell && this.editor.editingShellId === shell.id;

    const div = document.createElement('div');
    div.className = 'shell-card';
    if (isEditing) div.classList.add('active');
    div.dataset.shellId = shell.id;

    // Number badge
    const number = document.createElement('div');
    number.className = 'shell-card-number';
    number.textContent = index + 1;
    div.appendChild(number);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'shell-card-actions';

    // Star (default) button
    const starBtn = document.createElement('button');
    starBtn.className = `shell-card-action star-btn${isDefault ? ' is-default' : ''}`;
    starBtn.title = isDefault ? 'Default shell' : 'Set as default';
    starBtn.innerHTML = `<i class="material-icons">${isDefault ? 'star' : 'star_border'}</i>`;
    starBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDefaultShell(shell.id);
    });
    actions.appendChild(starBtn);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'shell-card-action';
    deleteBtn.title = 'Delete shell';
    deleteBtn.innerHTML = '<i class="material-icons">delete</i>';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteShell(shell.id);
    });
    actions.appendChild(deleteBtn);

    div.appendChild(actions);

    // Preview area
    const preview = document.createElement('div');
    preview.className = 'slide-preview';
    preview.dataset.slideId = shell.id;
    preview.style.cssText = `
      width: 100%; height: 100%; position: relative; overflow: hidden;
      background: repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 16px 16px;
    `;

    const cachedThumb = this._thumbCache.get(shell.id);
    if (cachedThumb) {
      const img = document.createElement('img');
      img.src = cachedThumb;
      img.style.cssText = 'width:100%;height:100%;object-fit:fill;display:block;';
      preview.appendChild(img);
    } else {
      shell.elements.forEach((element, idx) => {
        const elementPreview = this.createElementPreview(element, idx);
        if (elementPreview) preview.appendChild(elementPreview);
      });
    }

    div.appendChild(preview);

    // Name label
    const nameLabel = document.createElement('div');
    nameLabel.className = 'shell-name-label';
    nameLabel.textContent = shell.title || `Shell ${index + 1}`;
    nameLabel.addEventListener('click', (e) => {
      e.stopPropagation();
      this._startShellInlineRename(div, shell, nameLabel);
    });
    div.appendChild(nameLabel);

    // Click to edit shell
    div.addEventListener('click', () => {
      this.editor.editShell(shell.id);
    });

    return div;
  }

  /**
   * Add a new shell to the presentation
   */
  addShell() {
    const shell = this.editor.presentation.addShell();
    this.editor.recordHistory();
    this.renderShells();
    // Auto-enter editing mode for the new shell
    this.editor.editShell(shell.id);
  }

  /**
   * Delete a shell by ID
   * @param {string} shellId - Shell ID to delete
   */
  async deleteShell(shellId) {
    const confirmed = await Dialog.confirm('Delete this shell? Slides using it will revert to "None".', 'Delete Shell');
    if (!confirmed) return;

    const shell = this.editor.presentation.getShellById(shellId);
    const thumbId = shell?.thumbnailId;

    this.editor.presentation.removeShell(shellId);

    // Exit shell editing if we were editing this shell
    if (this.editor.isEditingShell && this.editor.editingShellId === shellId) {
      this.editor.exitShellEditing();
    }

    this._thumbCache.delete(shellId);
    if (thumbId) {
      window.MediaDB.deleteThumbnail(thumbId).catch(() => {});
    }

    this.editor.recordHistory();
    this.renderShells();
  }

  /**
   * Toggle default (starred) shell
   * @param {string} shellId - Shell ID
   */
  toggleDefaultShell(shellId) {
    const current = this.editor.presentation.defaultShellId;
    if (current === shellId) {
      this.editor.presentation.setDefaultShell(null);
    } else {
      this.editor.presentation.setDefaultShell(shellId);
    }
    this.editor.recordHistory();
    this.renderShells();
  }

  /**
   * Start inline renaming of a shell card
   * @param {HTMLElement} cardDiv - The shell card element
   * @param {Slide} shell - The shell being renamed
   * @param {HTMLElement} nameLabel - The label element to replace
   */
  _startShellInlineRename(cardDiv, shell, nameLabel) {
    if (cardDiv.querySelector('.shell-name-input')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'shell-name-input';
    input.value = shell.title || '';

    const commit = () => {
      const newTitle = input.value.trim() || 'Untitled Shell';
      shell.setTitle(newTitle);
      nameLabel.textContent = newTitle;
      input.replaceWith(nameLabel);
      this.editor.recordHistory();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = shell.title || 'Untitled Shell'; input.blur(); }
    });
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('mousedown', (e) => e.stopPropagation());

    nameLabel.replaceWith(input);
    input.focus();
    input.select();
  }

  /**
   * Create simplified element preview for thumbnail
   * @param {Element} element - Element object
   * @param {number} zIndex - Z-index for layering
   * @returns {HTMLElement|null} Preview element
   */
  createElementPreview(element, zIndex = 0) {
    const scale = 0.15; // Scale down for thumbnail
    const preview = document.createElement('div');
    preview.style.cssText = `
      position: absolute;
      left: ${element.position.x * scale}px;
      top: ${element.position.y * scale}px;
      width: ${element.position.width * scale}px;
      height: ${element.position.height * scale}px;
      transform: rotate(${element.position.rotation}deg);
      background: ${element.type === 'shape' ? element.properties.fillColor : '#ddd'};
      border: 1px solid #999;
      overflow: hidden;
      font-size: ${(element.properties.font?.size || 16) * scale}px;
      z-index: ${zIndex};
    `;

    // Add type indicator
    if (element.type === 'text' && element.properties.text) {
      preview.textContent = element.properties.text.substring(0, 20);
      preview.style.color = element.properties.font.color;
    }

    return preview;
  }

  /**
   * Select slide
   * @param {number} index - Slide index
   */
  selectSlide(index) {
    // Flush any pending thumbnail capture before leaving the current slide
    this.flushThumbnailCapture();

    // Exit shell editing when switching to a regular slide
    this.editor.isEditingShell = false;

    // Clear stale element selection on slide change
    if (this.editor.elementController) {
      this.editor.elementController.deselectAll();
    }

    this.editor.presentation.setCurrentSlide(index);
    this.renderCurrentSlide();
    this.renderSlides(); // Update active state
    this.editor.updateUI();

    appEvents.emit(AppEvents.SLIDE_SELECTED, index);
  }

  /**
   * Render current slide in the canvas
   */
  async renderCurrentSlide() {
    const canvas = document.getElementById('slide-canvas');
    if (!canvas) return;

    canvas.innerHTML = '';

    const activeSlide = this.editor.getActiveSlide();

    // Show checkerboard for transparent backgrounds (e.g. shell editing)
    if (activeSlide.background === 'transparent') {
      canvas.style.background = 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 24px 24px';
    } else {
      canvas.style.background = activeSlide.background;
    }

    // Render all elements with proper z-index
    activeSlide.elements.forEach((element, index) => {
      const elementDOM = element.render(index);
      canvas.appendChild(elementDOM);

      // Attach interaction handlers
      if (this.editor.elementController) {
        this.editor.elementController.attachHandlers(elementDOM, element);
      }

      // Render children with higher z-index than parent
      element.children.forEach((child, childIndex) => {
        const childDOM = child.render(index * 100 + childIndex + 1);
        elementDOM.appendChild(childDOM);

        if (this.editor.elementController) {
          this.editor.elementController.attachHandlers(childDOM, child);
        }
      });
    });

    // Render shell preview overlay when toggled on (only for regular slides)
    if (!this.editor.isEditingShell) {
      this._renderShellPreview(canvas, activeSlide);
    }

    // Render ghost countdown timer if current slide doesn't have one
    if (!this.editor.isEditingShell) {
      this._renderCountdownGhost(canvas, activeSlide);
    }

    // Update elements tree in right sidebar
    if (this.editor.uiManager && this.editor.uiManager.elementsTree) {
      this.editor.uiManager.elementsTree.render(activeSlide.elements);
    }

    appEvents.emit(AppEvents.SLIDE_CHANGED, activeSlide);

    // Capture thumbnail shortly after render (allow images to load)
    if (!this._thumbCache.has(activeSlide.id)) {
      setTimeout(() => this._captureCurrentSlideThumbnail(), 500);
    }
  }

  /**
   * Show slide context menu
   * @param {MouseEvent} e - Mouse event
   * @param {number} index - Slide index
   */
  showSlideContextMenu(e, index) {
    // Remove existing context menu
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

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
      min-width: 150px;
    `;

    // Menu options
    const slide = this.editor.presentation.slides[index];
    const options = [
      {
        label: slide.visible ? 'Hide Slide' : 'Show Slide',
        icon: slide.visible ? 'visibility_off' : 'visibility',
        action: () => {
          slide.visible = !slide.visible;
          this.editor.recordHistory();
          this.renderSlides();
        }
      },
      {
        label: 'Duplicate',
        icon: 'content_copy',
        action: () => this.duplicateSlide(index)
      },
      {
        label: 'Save as Template',
        icon: 'dashboard_customize',
        action: () => {
          if (window.TemplateManager) TemplateManager.saveSlideAsTemplate(index);
        }
      },
      {
        label: 'Delete',
        icon: 'delete',
        action: () => this.deleteSlide(index),
        disabled: this.editor.presentation.slides.length <= 1
      }
    ];

    options.forEach((opt) => {
      const item = document.createElement('div');
      item.className = 'context-menu-item';
      item.innerHTML = `
        <i class="material-icons" style="font-size:18px;margin-right:8px;">${opt.icon}</i>
        <span>${opt.label}</span>
      `;
      item.style.cssText = `
        padding: 8px 16px;
        cursor: ${opt.disabled ? 'not-allowed' : 'pointer'};
        display: flex;
        align-items: center;
        opacity: ${opt.disabled ? '0.5' : '1'};
      `;

      if (!opt.disabled) {
        item.addEventListener('mouseenter', () => {
          item.style.background = '#f5f5f5';
        });

        item.addEventListener('mouseleave', () => {
          item.style.background = 'white';
        });

        item.addEventListener('click', () => {
          opt.action();
          menu.remove();
        });
      }

      menu.appendChild(item);
    });

    document.body.appendChild(menu);

    // Remove menu on click outside
    setTimeout(() => {
      const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      document.addEventListener('click', closeMenu);
    }, 0);
  }

  /**
   * Duplicate slide
   * @param {number} index - Slide index
   */
  duplicateSlide(index) {
    this.editor.duplicateSlide(index);
    toast.success('Slide duplicated');
  }

  /**
   * Delete slide
   * @param {number} index - Slide index
   */
  deleteSlide(index) {
    this.editor.deleteSlide(index);
  }

  /**
   * Schedule a debounced thumbnail capture for the current slide.
   * Resets the timer on every call so only the last edit within the
   * debounce window triggers a capture.
   */
  scheduleThumbnailCapture() {
    if (this._thumbTimer) clearTimeout(this._thumbTimer);

    this._thumbTimer = setTimeout(() => {
      this._thumbTimer = null;
      this._captureCurrentSlideThumbnail();
    }, this.THUMB_DEBOUNCE_MS);
  }

  /**
   * If a thumbnail capture is pending (debounce timer running), fire it
   * immediately so the current slide's thumbnail is up-to-date before
   * navigating away.
   */
  flushThumbnailCapture() {
    if (!this._thumbTimer) return;
    clearTimeout(this._thumbTimer);
    this._thumbTimer = null;
    this._captureCurrentSlideThumbnail();
  }

  /**
   * Capture the current slide canvas as a thumbnail using html2canvas
   * and update the sidebar preview.
   * @private
   */
  async _captureCurrentSlideThumbnail() {
    const canvas = document.getElementById('slide-canvas');
    if (!canvas) return;
    if (typeof html2canvas === 'undefined') return;

    const activeSlide = this.editor.getActiveSlide();
    if (!activeSlide) return;

    // Remember which slide we are capturing (it might change before the async returns)
    const slideId = activeSlide.id;

    try {
      // Temporarily hide selection handles so they don't appear in the thumbnail
      const handles = canvas.querySelectorAll(
        '.resize-handle, .rotate-handle, .crop-handle, .crop-corner'
      );
      const selectedEls = canvas.querySelectorAll('.element.selected');
      selectedEls.forEach(el => el.classList.add('_thumb-hide-outline'));
      handles.forEach(h => { h.style.display = 'none'; });

      const captured = await html2canvas(canvas, {
        scale: 0.25,
        useCORS: true,
        logging: false,
        backgroundColor: null
      });

      // Restore handles
      handles.forEach(h => { h.style.display = ''; });
      selectedEls.forEach(el => el.classList.remove('_thumb-hide-outline'));

      const dataUrl = captured.toDataURL('image/png');

      // Generate a unique thumbnail key and persist to IndexedDB
      const newThumbId = 'thumb_' + Date.now();

      window.MediaDB.saveThumbnail(newThumbId, dataUrl).catch(
        err => console.warn('Failed to persist thumbnail:', err)
      );

      // Delete old thumbnail if the slide had one
      const oldThumbId = activeSlide.thumbnailId;
      if (oldThumbId) {
        window.MediaDB.deleteThumbnail(oldThumbId).catch(() => {});
      }

      // Update slide reference
      activeSlide.thumbnailId = newThumbId;

      // Update in-memory cache (keyed by slideId for sidebar lookup)
      this._thumbCache.set(slideId, dataUrl);

      // Update the thumbnail in the sidebar without a full re-render
      this._updateThumbnailDOM(slideId, dataUrl);
    } catch (err) {
      console.warn('Thumbnail capture failed:', err);
    }
  }

  /**
   * Render a read-only, semi-transparent overlay of shell elements on the canvas.
   * Only shown when `showShellPreview` is on, a shell exists, and the current
   * slide doesn't have a shell assigned.
   * @param {HTMLElement} canvas - Slide canvas element
   * @param {import('../models/Slide.js').Slide} activeSlide - Current slide
   * @private
   */
  _renderShellPreview(canvas, activeSlide) {
    if (!this.editor.showShellPreview) return;
    if (!activeSlide.shellId) return;

    const shell = this.editor.presentation.getShellById(activeSlide.shellId);
    if (!shell) return;

    const shellMode = activeSlide.shellMode;

    // Container for all shell preview elements
    const overlay = document.createElement('div');
    overlay.className = 'shell-preview-overlay';

    // Render shell elements inside the overlay
    shell.elements.forEach((element, index) => {
      const elementDOM = element.render(index);
      overlay.appendChild(elementDOM);

      // Render children
      element.children.forEach((child, childIndex) => {
        const childDOM = child.render(index * 100 + childIndex + 1);
        elementDOM.appendChild(childDOM);
      });
    });

    // Insert based on shell mode
    if (shellMode === 'below') {
      canvas.insertBefore(overlay, canvas.firstChild);
    } else {
      canvas.appendChild(overlay);
    }
  }

  /**
   * Walk backward from the given slide index to find an inherited countdown timer.
   * Returns the element if found (without clear), or null if cleared or none exists.
   * @param {number} slideIndex - Current slide index
   * @returns {import('../models/CountdownTimerElement.js').CountdownTimerElement|null}
   * @private
   */
  _findInheritedCountdownTimer(slideIndex) {
    const slides = this.editor.presentation.slides;
    for (let i = slideIndex - 1; i >= 0; i--) {
      const timer = slides[i].elements.find(el => el.type === 'countdown_timer');
      if (!timer) continue;
      if (timer.properties.clear) return null;
      return timer;
    }
    return null;
  }

  /**
   * Render a ghost countdown timer on the canvas if the current slide inherits one.
   * Clicking the ghost materializes a real CountdownTimerElement on this slide.
   * @param {HTMLElement} canvas - Slide canvas element
   * @param {import('../models/Slide.js').Slide} activeSlide - Current slide
   * @private
   */
  _renderCountdownGhost(canvas, activeSlide) {
    // Skip if the current slide already defines its own countdown timer
    const hasOwn = activeSlide.elements.some(el => el.type === 'countdown_timer');
    if (hasOwn) return;

    const currentIndex = this.editor.presentation.currentSlideIndex;
    const inherited = this._findInheritedCountdownTimer(currentIndex);
    if (!inherited) return;

    // Build ghost DOM
    const ghost = document.createElement('div');
    ghost.className = 'countdown-timer-ghost';
    ghost.style.left = `${inherited.position.x}px`;
    ghost.style.top = `${inherited.position.y}px`;
    ghost.style.width = `${inherited.position.width}px`;
    ghost.style.height = `${inherited.position.height}px`;
    ghost.style.transform = `rotate(${inherited.position.rotation}deg)`;
    ghost.style.background = inherited.properties.background;
    ghost.style.borderRadius = `${inherited.properties.borderRadius}px`;
    ghost.style.zIndex = 9999;
    ghost.title = 'Click to create a countdown timer on this slide';

    const display = document.createElement('div');
    display.className = 'timer-display';
    display.style.fontFamily = inherited.properties.font.family;
    display.style.fontSize = `${inherited.properties.font.size}px`;
    display.style.color = inherited.properties.font.color;
    display.textContent = CountdownTimerElement.formatTime(inherited.properties.duration);
    ghost.appendChild(display);

    // --- Drag + click logic ---
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let ghostX = inherited.position.x;
    let ghostY = inherited.position.y;

    const onMouseDown = (e) => {
      e.stopPropagation();
      e.preventDefault();
      isDragging = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;

      // Compute canvas scale so mouse deltas map to canvas coordinates
      const canvasRect = canvas.getBoundingClientRect();
      const scaleX = canvas.offsetWidth / canvasRect.width;
      const scaleY = canvas.offsetHeight / canvasRect.height;

      const onMouseMove = (ev) => {
        const dx = (ev.clientX - dragStartX) * scaleX;
        const dy = (ev.clientY - dragStartY) * scaleY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging = true;
        ghost.style.left = `${ghostX + dx}px`;
        ghost.style.top = `${ghostY + dy}px`;
      };

      const onMouseUp = (ev) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        if (isDragging) {
          // Commit the new position
          const canvasRect2 = canvas.getBoundingClientRect();
          const sx = canvas.offsetWidth / canvasRect2.width;
          const sy = canvas.offsetHeight / canvasRect2.height;
          ghostX += (ev.clientX - dragStartX) * sx;
          ghostY += (ev.clientY - dragStartY) * sy;
        } else {
          // Click (no significant drag) → materialize a real element
          const newTimer = new CountdownTimerElement({
            position: {
              ...inherited.position,
              x: ghostX,
              y: ghostY
            },
            properties: JSON.parse(JSON.stringify(inherited.properties))
          });
          activeSlide.addElement(newTimer);

          this.renderCurrentSlide();
          this.editor.elementController.selectElement(newTimer);
          this.editor.recordHistory();
        }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    ghost.addEventListener('mousedown', onMouseDown);

    canvas.appendChild(ghost);
  }

  /**
   * Update a single slide thumbnail in the sidebar DOM with a captured image
   * @param {string} slideId - Slide id
   * @param {string} dataUrl - PNG data URL
   * @private
   */
  _updateThumbnailDOM(slideId, dataUrl) {
    const preview = document.querySelector(`.slide-preview[data-slide-id="${slideId}"]`);
    if (!preview) return;

    preview.innerHTML = '';
    const img = document.createElement('img');
    img.src = dataUrl;
    img.style.cssText = 'width:100%;height:100%;object-fit:fill;display:block;';
    preview.appendChild(img);
  }
}

export default SlideController;
