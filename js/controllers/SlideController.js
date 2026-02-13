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
   * Setup slide-related event listeners
   */
  setupSlideEvents() {
    const slideList = document.getElementById('slide-list');
    if (!slideList) return;

    // Add slide button
    const addSlideBtn = document.getElementById('add-slide-btn');
    if (addSlideBtn) {
      addSlideBtn.addEventListener('click', () => {
        this.editor.addSlide();
      });
    }

    // Drag and drop for reordering (skip shell thumbnail)
    slideList.addEventListener('dragstart', (e) => {
      if (e.target.classList.contains('slide-thumbnail') && !e.target.classList.contains('shell-thumbnail')) {
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
    const thumbnails = document.querySelectorAll('.slide-thumbnail:not(.shell-thumbnail)');
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

    // Shell thumbnail (always shown at the top)
    const shellThumb = this.createShellThumbnail();
    slideList.appendChild(shellThumb);

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
   * Create the shell thumbnail element for the sidebar
   * @returns {HTMLElement} Shell thumbnail
   */
  createShellThumbnail() {
    const hasShell = this.editor.presentation.hasShell();
    const div = document.createElement('div');
    div.className = 'slide-thumbnail shell-thumbnail';
    if (this.editor.isEditingShell) {
      div.classList.add('active');
    }
    div.draggable = false;

    // Label — layers icon instead of number
    const label = document.createElement('div');
    label.className = 'slide-number shell-label';
    label.innerHTML = '<i class="material-icons" style="font-size:12px;vertical-align:middle;">layers</i>';
    div.appendChild(label);

    // Preview area
    const preview = document.createElement('div');
    preview.className = 'slide-preview';

    if (hasShell) {
      // Checkerboard background to represent transparency
      preview.style.cssText = `
        width: 100%; height: 100%; position: relative; overflow: hidden;
        background: repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 16px 16px;
      `;

      // Render element previews
      this.editor.presentation.shell.elements.forEach((element, idx) => {
        const elementPreview = this.createElementPreview(element, idx);
        if (elementPreview) {
          preview.appendChild(elementPreview);
        }
      });
    } else {
      // Empty state — "+" icon to create shell
      preview.style.cssText = `
        width: 100%; height: 100%; position: relative; overflow: hidden;
        background: #f5f5f5;
        display: flex; align-items: center; justify-content: center;
      `;
      const addIcon = document.createElement('i');
      addIcon.className = 'material-icons';
      addIcon.style.cssText = 'font-size: 32px; color: #9C27B0; opacity: 0.6;';
      addIcon.textContent = 'add_circle_outline';
      preview.appendChild(addIcon);
    }

    div.appendChild(preview);

    // Click handler
    div.addEventListener('click', () => {
      this.editor.editShell();
    });

    // Right-click context menu (only if shell exists)
    if (hasShell) {
      div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showShellContextMenu(e);
      });
    }

    return div;
  }

  /**
   * Show context menu for the shell thumbnail
   * @param {MouseEvent} e - Mouse event
   */
  showShellContextMenu(e) {
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.cssText = `
      position: fixed; left: ${e.clientX}px; top: ${e.clientY}px;
      background: white; border: 1px solid #ccc; border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 10000; min-width: 150px;
    `;

    const item = document.createElement('div');
    item.className = 'context-menu-item';
    item.innerHTML = '<i class="material-icons" style="font-size:18px;margin-right:8px;">delete</i><span>Remove Shell</span>';
    item.style.cssText = 'padding: 8px 16px; cursor: pointer; display: flex; align-items: center;';

    item.addEventListener('mouseenter', () => { item.style.background = '#f5f5f5'; });
    item.addEventListener('mouseleave', () => { item.style.background = 'white'; });
    item.addEventListener('click', () => {
      this.editor.presentation.removeShell();
      this.editor.exitShellEditing();
      this.editor.recordHistory();
      menu.remove();
    });

    menu.appendChild(item);
    document.body.appendChild(menu);

    setTimeout(() => {
      const closeMenu = (ev) => {
        if (!menu.contains(ev.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      document.addEventListener('click', closeMenu);
    }, 0);
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
      this._thumbCache.set(slideId, dataUrl);

      // Update the thumbnail in the sidebar without a full re-render
      this._updateThumbnailDOM(slideId, dataUrl);
    } catch (err) {
      console.warn('Thumbnail capture failed:', err);
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

    // Click → materialize a real element copying position + style from the inherited one
    ghost.addEventListener('click', (e) => {
      e.stopPropagation();

      const newTimer = new CountdownTimerElement({
        position: { ...inherited.position },
        properties: JSON.parse(JSON.stringify(inherited.properties))
      });
      activeSlide.addElement(newTimer);

      this.renderCurrentSlide();
      this.editor.elementController.selectElement(newTimer);
      this.editor.recordHistory();
    });

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
