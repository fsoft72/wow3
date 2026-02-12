/**
 * WOW3 Playback Controller
 * Handles presentation playback mode
 */

import { appEvents, AppEvents } from '../utils/events.js';
import { prepareElementForAnimation } from '../utils/animations.js';

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
   * Start presentation playback
   */
  start() {
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

    // Show first slide
    this.showSlide(0);

    // Setup navigation
    this.setupNavigation();

    appEvents.emit(AppEvents.UI_MODE_CHANGED, 'presentation');
  }

  /**
   * Setup keyboard navigation
   */
  setupNavigation() {
    const handleKeydown = (e) => {
      if (!this.isPlaying) {
        document.removeEventListener('keydown', handleKeydown);
        return;
      }

      // Next slide: Right arrow, Space, Page Down
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        this.nextSlide();
      }
      // Previous slide: Left arrow, Page Up
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        this.previousSlide();
      }
      // First slide: Home
      else if (e.key === 'Home') {
        e.preventDefault();
        this.showSlide(0);
      }
      // Last slide: End
      else if (e.key === 'End') {
        e.preventDefault();
        this.showSlide(this.editor.presentation.slides.length - 1);
      }
      // Exit: Escape
      else if (e.key === 'Escape') {
        e.preventDefault();
        this.stop();
      }
    };

    document.addEventListener('keydown', handleKeydown);

    // Exit fullscreen handler
    const fullscreenChangeHandler = () => {
      if (!document.fullscreenElement && this.isPlaying) {
        this.stop();
      }
    };

    document.addEventListener('fullscreenchange', fullscreenChangeHandler);

    // Store handlers for cleanup
    this._keydownHandler = handleKeydown;
    this._fullscreenHandler = fullscreenChangeHandler;
  }

  /**
   * Show slide at index
   * @param {number} index - Slide index
   */
  async showSlide(index) {
    const slide = this.editor.presentation.slides[index];
    if (!slide) return;

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

    // Render all elements with proper z-index
    slide.elements.forEach((element, index) => {
      // Use index as z-index to ensure proper stacking
      const elementDOM = element.render(index);

      // Initially hide elements with inEffect
      if (element.inEffect) {
        prepareElementForAnimation(elementDOM);
      }

      slideContainer.appendChild(elementDOM);

      // Render children with higher z-index than parent
      element.children.forEach((child, childIndex) => {
        const childDOM = child.render(index * 100 + childIndex + 1);
        if (child.inEffect) {
          prepareElementForAnimation(childDOM);
        }
        elementDOM.appendChild(childDOM);
      });
    });

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
    indicator.textContent = `${index + 1} / ${this.editor.presentation.slides.length}`;
    this.presentationView.appendChild(indicator);

    // Play animations (pass container so lookups are scoped to the presentation view)
    if (this.editor.animationController) {
      await this.editor.animationController.playSlideAnimations(slide, slideContainer);
    }

    appEvents.emit(AppEvents.SLIDE_SELECTED, index);
  }

  /**
   * Navigate to next slide, or advance pending click animation first
   */
  nextSlide() {
    // If click-triggered animations are still queued, advance them instead
    if (this.editor.animationController && this.editor.animationController.hasPendingClickAnimations) {
      this.editor.animationController.advanceClickAnimation();
      return;
    }

    if (this.currentSlideIndex < this.editor.presentation.slides.length - 1) {
      this.showSlide(this.currentSlideIndex + 1);
    } else {
      // End of presentation
      M.toast({ html: 'End of presentation', classes: 'blue' });
    }
  }

  /**
   * Navigate to previous slide
   */
  previousSlide() {
    if (this.currentSlideIndex > 0) {
      this.showSlide(this.currentSlideIndex - 1);
    }
  }

  /**
   * Stop presentation playback
   */
  stop() {
    this.isPlaying = false;

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
