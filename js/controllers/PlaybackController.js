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

    /** @type {number|null} Auto play timer ID */
    this._autoPlayTimerId = null;

    /** @type {HTMLElement|null} Auto play progress bar element */
    this._autoPlayProgressBar = null;
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

    // Clean up any auto play timer from previous slide
    this._clearAutoPlay();

    this.currentSlideIndex = index;

    // Get continuing audio ID before clearing
    const continuingAudioId = window.AudioManager?.getContinuingAudio();

    // If a continuing audio element exists, move it to presentationView level
    // so it survives the slide container cleanup. appendChild on an already-
    // attached node is an atomic reparent — the element never leaves the
    // document, so no 'pause' events fire.
    let continuingAudioElement = null;
    if (continuingAudioId) {
      continuingAudioElement = this.presentationView.querySelector(`#${continuingAudioId}`);
      if (continuingAudioElement) {
        this.presentationView.appendChild(continuingAudioElement);
      }
    }

    // Remove all children EXCEPT the continuing audio element
    Array.from(this.presentationView.children).forEach(child => {
      if (child !== continuingAudioElement) {
        child.remove();
      }
    });

    // Create slide container at design dimensions
    const slideContainer = document.createElement('div');

    // Calculate scale to fit screen while maintaining aspect ratio
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scaleX = viewportWidth / 1280;
    const scaleY = viewportHeight / 720;
    const scale = Math.min(scaleX, scaleY);

    const bgAnimCSS = slide.backgroundAnimationSpeed > 0
      ? (() => {
          const dur = 11 - slide.backgroundAnimationSpeed;
          const animType = slide.backgroundAnimationType || 'pingpong';
          const kf = animType === 'cycle' ? 'wow3GradientCycleForward' : 'wow3GradientCycle';
          const ea = animType === 'cycle' ? 'linear' : 'ease';
          return `background-size: 200% 200%; animation: ${kf} ${dur}s ${ea} infinite;`;
        })()
      : '';

    slideContainer.style.cssText = `
      width: 1280px;
      height: 720px;
      background: ${slide.background};
      position: relative;
      transform: scale(${scale});
      transform-origin: center;
      ${bgAnimCSS}
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

      // Listen for the special "Next Slide" build out effect
      slideContainer.addEventListener('wow3:nextSlide', () => {
        this.nextSlide();
      }, { once: true });

      await this._animationManager.play();
    }

    // Handle continuing audio: it's currently a direct child of presentationView,
    // never removed from the DOM. Decide whether to keep or discard it.
    if (continuingAudioElement) {
      const continuingAudioOnThisSlide = slide.elements &&
        slide.elements.some(el => el.id === continuingAudioId);

      const hasCompetingAutoplayAudio = slide.elements && slide.elements.some(
        el => el.type === 'audio' &&
             el.properties &&
             el.properties.autoplay &&
             el.id !== continuingAudioId
      );

      if (continuingAudioOnThisSlide || hasCompetingAutoplayAudio) {
        // Audio is being replaced — remove the old DOM element.
        // AudioManager.onSlideChange() will handle fading / stopping.
        continuingAudioElement.remove();
      }
      // Otherwise it stays as a direct child of presentationView, untouched.
    }

    // Notify AudioManager of slide change
    if (window.AudioManager) {
      window.AudioManager.onSlideChange(slide);
    }

    appEvents.emit(AppEvents.SLIDE_SELECTED, index);

    // Auto play timer starts AFTER all animations complete.
    // For slides with click-triggered animations, the user must advance through them first.
    if (slide.autoPlay && slide.autoPlayDuration > 0) {
      this._startAutoPlay(slide.autoPlayDuration);
    }
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

    // Clean up auto play timer
    this._clearAutoPlay();

    // Clean up countdown timer
    this._stopCountdown();

    // Clean up animation state
    if (this._animationManager) {
      this._animationManager.cleanup();
      this._animationManager = null;
    }

    // Stop any continuing audio — presentation is ending
    if (window.AudioManager) {
      window.AudioManager.stopAll(true);
    }

    // Clear presentation view
    Array.from(this.presentationView.children).forEach(child => child.remove());

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

    // Clean up auto play
    this._clearAutoPlay();

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

  // ==================== AUTO PLAY ====================

  /**
   * Start the auto play timer and progress bar for the current slide
   * @param {number} durationSeconds - Duration in seconds
   * @private
   */
  _startAutoPlay(durationSeconds) {
    this._clearAutoPlay();

    // Create progress bar
    const bar = document.createElement('div');
    bar.className = 'auto-play-progress';
    bar.style.transitionDuration = `${durationSeconds}s`;
    this.presentationView.appendChild(bar);
    this._autoPlayProgressBar = bar;

    // Force reflow so the transition triggers from width: 0
    bar.offsetWidth;
    bar.style.width = '100%';

    // Set timer to advance slide — calls nextSlide() directly
    // (no event dispatch needed, _clearAutoPlay() at top of showSlide prevents stale timers)
    this._autoPlayTimerId = setTimeout(() => {
      this._autoPlayTimerId = null;
      this._clearAutoPlay();
      this.nextSlide();
    }, durationSeconds * 1000);
  }

  /**
   * Clear the auto play timer and remove progress bar
   * @private
   */
  _clearAutoPlay() {
    if (this._autoPlayTimerId !== null) {
      clearTimeout(this._autoPlayTimerId);
      this._autoPlayTimerId = null;
    }
    if (this._autoPlayProgressBar) {
      this._autoPlayProgressBar.remove();
      this._autoPlayProgressBar = null;
    }
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

    // Build background CSS with optional gradient animation
    const bg = element.properties.background;
    const bgIsGradient = bg && bg.includes('gradient(');
    const bgAnimSpeed = element.properties.backgroundAnimationSpeed ?? 0;
    const bgAnimType = element.properties.backgroundAnimationType || 'pingpong';
    let bgAnimCSS = '';
    if (bgIsGradient && bgAnimSpeed > 0) {
      const kf = bgAnimType === 'cycle' ? 'wow3GradientCycleForward' : 'wow3GradientCycle';
      const ea = bgAnimType === 'cycle' ? 'linear' : 'ease';
      bgAnimCSS = `background-size: 200% 200%; animation: ${kf} ${11 - bgAnimSpeed}s ${ea} infinite;`;
    }

    div.style.cssText = `
      position: absolute;
      left: ${element.position.x}px;
      top: ${element.position.y}px;
      width: ${element.position.width}px;
      height: ${element.position.height}px;
      transform: rotate(${element.position.rotation}deg);
      background: ${bg};
      ${bgAnimCSS}
      border-color: ${element.properties.borderColor};
      border-width: ${element.properties.borderWidth}px;
      border-style: solid;
      border-radius: ${element.properties.borderRadius}px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Build font color CSS (gradient text or solid)
    const fontColor = element.properties.font.color;
    const fontIsGradient = fontColor && fontColor.includes('gradient(');
    const fontAnimSpeed = element.properties.font.colorAnimationSpeed ?? 0;
    const fontAnimType = element.properties.font.colorAnimationType || 'pingpong';
    let fontAnimCSS = '';
    if (fontIsGradient && fontAnimSpeed > 0) {
      const kf = fontAnimType === 'cycle' ? 'wow3GradientCycleForward' : 'wow3GradientCycle';
      const ea = fontAnimType === 'cycle' ? 'linear' : 'ease';
      fontAnimCSS = `background-size: 200% 200%; animation: ${kf} ${11 - fontAnimSpeed}s ${ea} infinite;`;
    }
    const colorCSS = fontIsGradient
      ? `background: ${fontColor}; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; ${fontAnimCSS}`
      : `color: ${fontColor};`;

    const display = document.createElement('div');
    display.className = 'timer-display';
    display.style.cssText = `
      font-family: ${element.properties.font.family};
      font-size: ${element.properties.font.size}px;
      ${colorCSS}
      font-weight: ${element.properties.font.weight || 'normal'};
    `;
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
