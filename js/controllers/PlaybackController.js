/**
 * WOW3 Playback Controller
 * Handles presentation playback mode
 */

import { appEvents, AppEvents } from '../utils/events.js';
import { toast } from '../utils/toasts.js';
import { CountdownTimerElement } from '../models/CountdownTimerElement.js';
import { AnimationManager } from '../animations/AnimationManager.js';

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

    /** @type {AnimationManager|null} */
    this._animationManager = null;

    /** @type {{ element: Object, startedAt: number, duration: number, remaining: number, intervalId: number|null, audioElement: HTMLAudioElement|null }|null} */
    this._activeCountdown = null;
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

    // Stop any playing audio from editor with smooth fade-out
    if (window.AudioManager) {
      window.AudioManager.stopAll(true);
    }

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
    if (this._animationManager) {
      this._animationManager.cleanup();
      this._animationManager = null;
    }

    this.currentSlideIndex = index;

    // Get continuing audio ID before clearing
    const continuingAudioId = window.AudioManager?.getContinuingAudio();
    console.log('[PlaybackController] Continuing audio ID:', continuingAudioId);

    // Clear presentation view, but preserve continuing audio element
    // First, detach the continuing audio element if it exists
    // IMPORTANT: Search within presentation view only, not entire document
    // (there may be another element with same ID in the editor)
    let continuingAudioElement = null;
    if (continuingAudioId) {
      continuingAudioElement = this.presentationView.querySelector(`#${continuingAudioId}`);
      console.log('[PlaybackController] Found continuing audio element:', continuingAudioElement);
      console.log('[PlaybackController] Continuing audio element parent:', continuingAudioElement?.parentElement?.className);
      console.log('[PlaybackController] Is audio playing?', continuingAudioElement?.querySelector('audio')?.paused === false);

      if (continuingAudioElement) {
        console.log('[PlaybackController] Detaching continuing audio element:', continuingAudioId);
        continuingAudioElement.remove(); // Detach but keep reference
        console.log('[PlaybackController] After detach - is audio still playing?', continuingAudioElement?.querySelector('audio')?.paused === false);
      }
    }

    // Remove all children (slide containers, indicators, etc.)
    console.log('[PlaybackController] Presentation view children before clearing:', this.presentationView.children.length);
    Array.from(this.presentationView.children).forEach(child => {
      console.log('[PlaybackController] Removing child:', child.id || child.className);
      child.remove();
    });
    console.log('[PlaybackController] Presentation view children after clearing:', this.presentationView.children.length);

    // Create slide container at design dimensions
    const slideContainer = document.createElement('div');

    // Calculate scale to fit screen while maintaining aspect ratio
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scaleX = viewportWidth / 1280;
    const scaleY = viewportHeight / 720;
    const scale = Math.min(scaleX, scaleY);

    slideContainer.style.cssText = `
      width: 1280px;
      height: 720px;
      background: ${slide.background};
      position: relative;
      transform: scale(${scale});
      transform-origin: center;
    `;

    // Create shell and slide layers
    const shell = slide.shellId ? this.editor.presentation.getShellById(slide.shellId) : null;
    const shellMode = slide.shellMode || 'above';

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

    // Render shell elements (static, no animations)
    if (shell) {
      shell.elements.forEach((element, idx) => {
        const elementDOM = element.render(idx);
        shellLayer.appendChild(elementDOM);

        element.children.forEach((child, childIndex) => {
          const childDOM = child.render(idx * 100 + childIndex + 1);
          elementDOM.appendChild(childDOM);
        });
      });
    }

    // Render all slide elements normally (no prepareElementForAnimation)
    slide.elements.forEach((element, idx) => {
      const elementDOM = element.render(idx);
      slideLayer.appendChild(elementDOM);

      element.children.forEach((child, childIndex) => {
        const childDOM = child.render(idx * 100 + childIndex + 1);
        elementDOM.appendChild(childDOM);
      });
    });

    // Hide static countdown_timer elements — the live playback overlay replaces them
    slideLayer.querySelectorAll('.countdown-timer-element').forEach(el => {
      el.style.display = 'none';
    });

    // Replace text placeholders in rendered DOM
    this._replacePlaceholders(slideContainer, index);

    this.presentationView.appendChild(slideContainer);

    // --- Countdown timer cross-slide logic ---
    const countdownResolution = this._resolveCountdownForSlide(index);

    if (countdownResolution.action === 'clear') {
      this._stopCountdown();
    } else if (countdownResolution.action === 'new') {
      this._stopCountdown();
      this._startCountdown(countdownResolution.element, slideContainer);
    } else if (countdownResolution.action === 'inherit' && this._activeCountdown) {
      // Re-render the active countdown DOM on the new slide container
      this._renderCountdownDOM(this._activeCountdown.element, slideContainer, this._activeCountdown.remaining);
    }

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

    // Play animations using AnimationManager (WAAPI)
    if (slide.animationSequence && slide.animationSequence.length > 0) {
      this._animationManager = new AnimationManager(slideContainer);
      this._animationManager.loadSequence(slide.animationSequence);
      this._animationManager.prepareInitialState();
      await this._animationManager.play();
    }

    // Re-attach continuing audio element if it should continue
    if (continuingAudioElement) {
      // Check if the continuing audio is on this slide
      const continuingAudioOnThisSlide = slide.elements &&
        slide.elements.some(el => el.id === continuingAudioId);

      // Check if slide has competing autoplay audio
      const hasCompetingAutoplayAudio = slide.elements && slide.elements.some(
        el => el.type === 'audio' &&
             el.properties &&
             el.properties.autoplay &&
             el.id !== continuingAudioId
      );

      console.log('[PlaybackController] Continuing audio on this slide:', continuingAudioOnThisSlide);
      console.log('[PlaybackController] Has competing autoplay audio:', hasCompetingAutoplayAudio);

      if (!continuingAudioOnThisSlide && !hasCompetingAutoplayAudio) {
        // Re-attach to the new slide container
        console.log('[PlaybackController] Re-attaching continuing audio to new slide');
        console.log('[PlaybackController] Before re-attach - is audio playing?', continuingAudioElement?.querySelector('audio')?.paused === false);
        slideContainer.appendChild(continuingAudioElement);
        console.log('[PlaybackController] After re-attach - is audio playing?', continuingAudioElement?.querySelector('audio')?.paused === false);
        console.log('[PlaybackController] Audio element parent after re-attach:', continuingAudioElement?.parentElement?.className);
      } else if (hasCompetingAutoplayAudio) {
        console.log('[PlaybackController] Not re-attaching - competing audio will fade it out');
        // Don't re-attach - AudioManager will fade it out
      } else {
        console.log('[PlaybackController] Not re-attaching - audio is on this slide (will be rendered)');
        // Don't re-attach - the audio will be rendered as part of this slide
      }
    }

    // Notify AudioManager of slide change
    if (window.AudioManager) {
      window.AudioManager.onSlideChange(slide);
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
    const mgr = this._animationManager;

    // 1. If animations are playing, skip the current one
    if (mgr && mgr.isPlaying && !mgr._waitingForClick) {
      mgr.skip();
      return;
    }

    // 2. If waiting on a click trigger, advance to next step
    if (mgr && mgr.hasPendingSteps) {
      mgr.next();
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
      this._showEndSlide();
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
   * Show end-of-presentation slide
   */
  _showEndSlide() {
    if (!this.presentationView) return;

    // Clean up countdown timer
    this._stopCountdown();

    // Clean up animation state
    if (this._animationManager) {
      this._animationManager.cleanup();
      this._animationManager = null;
    }

    // Clear and create end slide
    this.presentationView.innerHTML = '';

    // Calculate scale to fit screen while maintaining aspect ratio
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scaleX = viewportWidth / 1280;
    const scaleY = viewportHeight / 720;
    const scale = Math.min(scaleX, scaleY);

    const endSlide = document.createElement('div');
    endSlide.style.cssText = `
      width: 1280px;
      height: 720px;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: scale(${scale});
      transform-origin: center;
    `;

    const text = document.createElement('div');
    text.textContent = 'Presentation ended';
    text.style.cssText = `
      color: #fff;
      font-size: 48px;
      font-weight: 300;
    `;

    endSlide.appendChild(text);
    this.presentationView.appendChild(endSlide);
  }

  /**
   * Stop presentation playback
   */
  stop() {
    this.isPlaying = false;

    // Stop all audio with smooth fade-out
    if (window.AudioManager) {
      window.AudioManager.stopAll(true);
    }

    // Clean up active countdown timer
    this._stopCountdown();

    // Clean up animation state
    if (this._animationManager) {
      this._animationManager.cleanup();
      this._animationManager = null;
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

  // ==================== COUNTDOWN TIMER ====================

  /**
   * Determine what countdown action to take for a given slide index.
   * @param {number} slideIndex - Slide index
   * @returns {{ action: 'new'|'clear'|'inherit', element?: Object }}
   * @private
   */
  _resolveCountdownForSlide(slideIndex) {
    const slide = this.editor.presentation.slides[slideIndex];
    if (!slide) return { action: 'inherit' };

    const timer = slide.elements.find(el => el.type === 'countdown_timer');
    if (!timer) return { action: 'inherit' };
    if (timer.properties.clear) return { action: 'clear' };

    // If the active countdown is already from this same element, keep it running
    if (this._activeCountdown && this._activeCountdown.element.id === timer.id) {
      return { action: 'inherit' };
    }

    return { action: 'new', element: timer };
  }

  /**
   * Start a new countdown from the given element and render it on a container.
   * @param {Object} element - CountdownTimerElement model
   * @param {HTMLElement} container - Slide container to append the countdown DOM to
   * @private
   */
  _startCountdown(element, container) {
    const remaining = element.properties.duration;
    const domEl = this._renderCountdownDOM(element, container, remaining);

    this._activeCountdown = {
      element,
      startedAt: Date.now(),
      duration: element.properties.duration,
      remaining,
      intervalId: null,
      audioElement: null
    };

    this._activeCountdown.intervalId = setInterval(() => {
      if (!this._activeCountdown) return;

      this._activeCountdown.remaining--;
      const r = this._activeCountdown.remaining;

      // Update displayed text in whatever container is currently showing it
      const display = this.presentationView?.querySelector('.playback-countdown .timer-display');
      if (display) {
        display.textContent = CountdownTimerElement.formatTime(r);
      }

      if (r <= 0) {
        clearInterval(this._activeCountdown.intervalId);
        this._activeCountdown.intervalId = null;
        this._playCompletionSound(element.properties.soundId);
      }
    }, 1000);
  }

  /**
   * Stop the active countdown and remove its DOM.
   * @private
   */
  _stopCountdown() {
    if (!this._activeCountdown) return;

    if (this._activeCountdown.intervalId) {
      clearInterval(this._activeCountdown.intervalId);
    }
    if (this._activeCountdown.audioElement) {
      this._activeCountdown.audioElement.pause();
      this._activeCountdown.audioElement = null;
    }

    // Remove existing playback countdown DOM
    const existing = this.presentationView?.querySelector('.playback-countdown');
    if (existing) existing.remove();

    this._activeCountdown = null;
  }

  /**
   * Create or update the countdown DOM element in a slide container.
   * @param {Object} element - CountdownTimerElement model
   * @param {HTMLElement} container - Slide container
   * @param {number} remaining - Remaining seconds
   * @returns {HTMLElement} The countdown DOM element
   * @private
   */
  _renderCountdownDOM(element, container, remaining) {
    // Remove any existing countdown DOM in the presentation view
    const existing = this.presentationView?.querySelector('.playback-countdown');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.className = 'playback-countdown';
    div.style.left = `${element.position.x}px`;
    div.style.top = `${element.position.y}px`;
    div.style.width = `${element.position.width}px`;
    div.style.height = `${element.position.height}px`;
    div.style.transform = `rotate(${element.position.rotation}deg)`;
    div.style.background = element.properties.background;
    div.style.borderColor = element.properties.borderColor;
    div.style.borderWidth = `${element.properties.borderWidth}px`;
    div.style.borderStyle = 'solid';
    div.style.borderRadius = `${element.properties.borderRadius}px`;

    const display = document.createElement('div');
    display.className = 'timer-display';
    display.style.fontFamily = element.properties.font.family;
    display.style.fontSize = `${element.properties.font.size}px`;
    display.style.color = element.properties.font.color;
    display.style.fontWeight = element.properties.font.weight || 'normal';
    display.textContent = CountdownTimerElement.formatTime(remaining);

    div.appendChild(display);
    container.appendChild(div);

    return div;
  }

  /**
   * Play the completion sound when the countdown reaches zero.
   * @param {string} soundId - Media ID or empty string
   * @private
   */
  async _playCompletionSound(soundId) {
    if (!soundId) return;

    try {
      const audio = document.createElement('audio');

      if (soundId.startsWith('media_') && window.MediaDB) {
        const dataURL = await window.MediaDB.getMediaDataURL(soundId);
        if (dataURL) {
          audio.src = dataURL;
        } else {
          return;
        }
      } else {
        audio.src = soundId;
      }

      audio.play().catch(err => console.warn('Countdown sound playback failed:', err));

      if (this._activeCountdown) {
        this._activeCountdown.audioElement = audio;
      }
    } catch (err) {
      console.warn('Failed to load countdown completion sound:', err);
    }
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
