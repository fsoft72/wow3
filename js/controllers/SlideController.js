/**
 * WOW3 Slide Controller
 * Manages slide operations and rendering
 */

import { appEvents, AppEvents } from '../utils/events.js';

export class SlideController {
  /**
   * Create slide controller
   * @param {EditorController} editorController - Editor controller instance
   */
  constructor(editorController) {
    this.editor = editorController;
    this.draggedSlide = null;
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
    div.dataset.slideIndex = index;
    div.draggable = true;

    // Slide number
    const number = document.createElement('div');
    number.className = 'slide-number';
    number.textContent = index + 1;
    div.appendChild(number);

    // Thumbnail preview
    const preview = document.createElement('div');
    preview.className = 'slide-preview';
    preview.style.cssText = `
      width: 100%;
      height: 100%;
      background: ${slide.background};
      position: relative;
      overflow: hidden;
    `;

    // Render simplified version of elements
    slide.elements.forEach((element, idx) => {
      const elementPreview = this.createElementPreview(element, idx);
      if (elementPreview) {
        preview.appendChild(elementPreview);
      }
    });

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

    const currentSlide = this.editor.presentation.getCurrentSlide();
    canvas.style.background = currentSlide.background;

    // Render all elements with proper z-index
    currentSlide.elements.forEach((element, index) => {
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

    // Update elements tree in right sidebar
    if (this.editor.uiManager && this.editor.uiManager.elementsTree) {
      this.editor.uiManager.elementsTree.render(currentSlide.elements);
    }

    appEvents.emit(AppEvents.SLIDE_CHANGED, currentSlide);
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
    const options = [
      {
        label: 'Duplicate',
        icon: 'content_copy',
        action: () => this.duplicateSlide(index)
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
    M.toast({ html: 'Slide duplicated', classes: 'green' });
  }

  /**
   * Delete slide
   * @param {number} index - Slide index
   */
  deleteSlide(index) {
    this.editor.deleteSlide(index);
  }
}

export default SlideController;
