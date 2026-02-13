/**
 * WOW3 Playback Controller
 * Handles presentation playback mode
 */

import { appEvents, AppEvents } from '../utils/events.js';
import { prepareElementForAnimation } from '../utils/animations.js';
import { toast } from '../utils/toasts.js';

export class PlaybackController {
  /**
   * Create playback controller
   * @param {EditorController} editorController - Editor controller instance
   */
  constructor(editorController) {
    this.editor = editorController;
    this.currentSlideIndex = 0;
    this.isPlaying = false;
    this.presentationView = null;
  }

  /**
   * Initialize playback controller
   */
  async init() {
    console.log('Initializing PlaybackController...');
    this.presentationView = document.getElementById('presentation-view');
    console.log('PlaybackController initialized');
  }

  /**
   * Find the next visible slide index searching forward from `from` (inclusive)
   * @param {number} from - Start index
   * @returns {number} Visible slide index, or -1 if none
   */
  _findVisibleSlide(from) {
    const slides = this.editor.presentation.slides;
    for (let i = from; i < slides.length; i++) {
      if (slides[i].visible) return i;
    }
    return -1;
  }

  /**
   * Find the previous visible slide index searching backward from `from` (inclusive)
   * @param {number} from - Start index
   * @returns {number} Visible slide index, or -1 if none
   */
  _findVisibleSlideReverse(from) {
    const slides = this.editor.presentation.slides;
    for (let i = from; i >= 0; i--) {
      if (slides[i].visible) return i;
    }
    return -1;
  }

  /**
   * Start presentation playback
   * @param {number} fromIndex - Slide index to start from (default 0)
   */
  start(fromIndex = 0) {
    if (!this.presentationView) return;

    this.isPlaying = true;
    this.currentSlideIndex = 0;

    // Show presentation view
    this.presentationView.style.display = 'flex';
    this.presentationView.classList.add('active');

    // Enter fullscreen
    if (this.presentationView.requestFullscreen) {
      this.presentationView.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    }

    // When starting from a specific slide (Shift+Play), show it even if hidden.
    // Otherwise find the first visible slide from the requested index.
    let startSlide;
    if (fromIndex > 0) {
      startSlide = fromIndex;
    } else {
      startSlide = this._findVisibleSlide(0);
    }

    if (startSlide === -1) {
      toast.warning('All slides are hidden');
      this.stop();
      return;
    }
    this.showSlide(startSlide);

    // Setup navigation
    this.setupNavigation();

    appEvents.emit(AppEvents.UI_MODE_CHANGED, 'presentation');
  }

  /**
   * Setup keyboard and click navigation
   */
  setupNavigation() {
    const handleKeydown = (e) => {
      if (!this.isPlaying) {
        document.removeEventListener('keydown', handleKeydown);
        return;
      }

      // Advance: Right arrow, Left arrow, Space, Page Down
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        this.advance();
      }
      // Previous slide: Page Up
      else if (e.key === 'PageUp') {
        e.preventDefault();
        this.previousSlide();
      }
      // First visible slide: Home
      else if (e.key === 'Home') {
        e.preventDefault();
        const first = this._findVisibleSlide(0);
        if (first !== -1) this.showSlide(first);
      }
      // Last visible slide: End
      else if (e.key === 'End') {
        e.preventDefault();
        const last = this._findVisibleSlideReverse(this.editor.presentation.slides.length - 1);
        if (last !== -1) this.showSlide(last);
      }
      // Exit: Escape
      else if (e.key === 'Escape') {
        e.preventDefault();
        this.stop();
      }
    };

    document.addEventListener('keydown', handleKeydown);

    // Click on presentation view to advance
    const handleClick = () => {
      if (!this.isPlaying) return;
      this.advance();
    };

    if (this.presentationView) {
      this.presentationView.addEventListener('click', handleClick);
    }

    // Exit fullscreen handler
    const fullscreenChangeHandler = () => {
      if (!document.fullscreenElement && this.isPlaying) {
        this.stop();
      }
    };

    document.addEventListener('fullscreenchange', fullscreenChangeHandler);

    // Store handlers for cleanup
    this._keydownHandler = handleKeydown;
    this._presentationClickHandler = handleClick;
    this._fullscreenHandler = fullscreenChangeHandler;
  }

  /**
   * Show slide at index
   * @param {number} index - Slide index
   */
  async showSlide(index) {
    const slide = this.editor.presentation.slides[index];
    if (!slide) return;

    // Clean up any ongoing animations from the previous slide
    if (this.editor.animationController) {
      this.editor.animationController.cleanup();
    }

    this.currentSlideIndex = index;

    // Clear presentation view
    this.presentationView.innerHTML = '';

    // Create slide container
    const slideContainer = document.createElement('div');
    slideContainer.style.cssText = `
      width: 1280px;
      height: 720px;
      background: ${slide.background};
      position: relative;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    `;

    // Create shell and slide layers
    const shell = this.editor.presentation.shell;
    const shellMode = this.editor.presentation.shellMode;

    const shellLayer = document.createElement('div');
    shellLayer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';

    const slideLayer = document.createElement('div');
    slideLayer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';

    // Append layers in correct order based on shellMode
    if (shellMode === 'below') {
      slideContainer.appendChild(shellLayer);
      slideContainer.appendChild(slideLayer);
    } else {
      slideContainer.appendChild(slideLayer);
      slideContainer.appendChild(shellLayer);
    }

    // Render shell elements (static, no animations) — skip if slide hides shell
    if (shell && !slide.hideShell) {
      shell.elements.forEach((element, idx) => {
        const elementDOM = element.render(idx);
        shellLayer.appendChild(elementDOM);

        element.children.forEach((child, childIndex) => {
          const childDOM = child.render(idx * 100 + childIndex + 1);
          elementDOM.appendChild(childDOM);
        });
      });
    }

    // Render slide elements with proper z-index
    slide.elements.forEach((element, index) => {
      const elementDOM = element.render(index);

      // Initially hide elements with inEffect
      if (element.inEffect) {
        prepareElementForAnimation(elementDOM);
      }

      slideLayer.appendChild(elementDOM);

      // Render children with higher z-index than parent
      element.children.forEach((child, childIndex) => {
        const childDOM = child.render(index * 100 + childIndex + 1);
        if (child.inEffect) {
          prepareElementForAnimation(childDOM);
        }
        elementDOM.appendChild(childDOM);
      });
    });

    // Replace text placeholders in rendered DOM
    this._replacePlaceholders(slideContainer, index);

    this.presentationView.appendChild(slideContainer);

    // Add slide number indicator
    const indicator = document.createElement('div');
    indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 1000;
    `;
    const visibleSlides = this.editor.presentation.slides.filter(s => s.visible);
    const visiblePos = visibleSlides.indexOf(slide) + 1;
    indicator.textContent = `${visiblePos} / ${visibleSlides.length}`;
    this.presentationView.appendChild(indicator);

    // Play animations (pass container so lookups are scoped to the presentation view)
    if (this.editor.animationController) {
      await this.editor.animationController.playSlideAnimations(slide, slideContainer);
    }

    appEvents.emit(AppEvents.SLIDE_SELECTED, index);
  }

  /**
   * Replace text placeholders inside rendered DOM nodes
   * @param {HTMLElement} container - Slide container
   * @param {number} slideIndex - Current slide index
   */
  _replacePlaceholders(container, slideIndex) {
    const slide = this.editor.presentation.slides[slideIndex];
    const visibleSlides = this.editor.presentation.slides.filter(s => s.visible);
    const visiblePos = visibleSlides.indexOf(slide);

    const nextIdx = this._findVisibleSlide(slideIndex + 1);
    const nextTitle = nextIdx !== -1
      ? this.editor.presentation.slides[nextIdx].title
      : '';

    const replacements = {
      '#NEXT_SLIDE#': nextTitle,
      '#SLIDE_TITLE#': slide.title,
      '#SLIDE_NUMBER#': String(visiblePos !== -1 ? visiblePos + 1 : slideIndex + 1),
      '#SLIDE_TOTAL#': String(visibleSlides.length)
    };

    container.querySelectorAll('.text-content').forEach((node) => {
      let text = node.textContent;
      for (const [placeholder, value] of Object.entries(replacements)) {
        if (text.includes(placeholder)) {
          text = text.replaceAll(placeholder, value);
        }
      }
      if (text !== node.textContent) {
        node.textContent = text;
      }
    });
  }

  /**
   * Unified advance action: skip current animation → advance click queue → next slide.
   * Handles ArrowRight, ArrowLeft, Space, PageDown, and mouse click.
   */
  advance() {
    const anim = this.editor.animationController;

    // 1. If an auto animation is currently playing, skip it
    if (anim && anim.isAnimating) {
      anim.skipCurrentAnimation();
      return;
    }

    // 2. If click-triggered animations are queued, advance them
    if (anim && anim.hasPendingClickAnimations) {
      anim.advanceClickAnimation();
      return;
    }

    // 3. Go to next slide
    this.nextSlide();
  }

  /**
   * Navigate to next visible slide
   */
  nextSlide() {
    const next = this._findVisibleSlide(this.currentSlideIndex + 1);
    if (next !== -1) {
      this.showSlide(next);
    } else {
      toast.info('End of presentation');
    }
  }

  /**
   * Navigate to previous visible slide
   */
  previousSlide() {
    const prev = this._findVisibleSlideReverse(this.currentSlideIndex - 1);
    if (prev !== -1) {
      this.showSlide(prev);
    }
  }

  /**
   * Stop presentation playback
   */
  stop() {
    this.isPlaying = false;

    // Clean up animation state
    if (this.editor.animationController) {
      this.editor.animationController.cleanup();
    }

    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => {
        console.warn('Exit fullscreen failed:', err);
      });
    }

    // Hide presentation view
    if (this.presentationView) {
      this.presentationView.style.display = 'none';
      this.presentationView.classList.remove('active');
      this.presentationView.innerHTML = '';
    }

    // Cleanup event listeners
    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler);
      this._keydownHandler = null;
    }

    if (this._presentationClickHandler && this.presentationView) {
      this.presentationView.removeEventListener('click', this._presentationClickHandler);
      this._presentationClickHandler = null;
    }

    if (this._fullscreenHandler) {
      document.removeEventListener('fullscreenchange', this._fullscreenHandler);
      this._fullscreenHandler = null;
    }

    appEvents.emit(AppEvents.UI_MODE_CHANGED, 'editor');
  }

  /**
   * Toggle playback
   */
  toggle() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
  }
}

export default PlaybackController;
