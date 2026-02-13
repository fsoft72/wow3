/**
 * WOW3 Animation Controller
 * Manages animation system and playback
 */

import {
  applyAnimation,
  removeAnimation,
  prepareElementForAnimation,
  resetElement
} from '../utils/animations.js';
import { AnimationType, AnimationTrigger } from '../utils/constants.js';
import { appEvents, AppEvents } from '../utils/events.js';
import { toast } from '../utils/toasts.js';

export class AnimationController {
  /**
   * Create animation controller
   * @param {EditorController} editorController - Editor controller instance
   */
  constructor(editorController) {
    this.editor = editorController;
    this.currentElement = null;
    this.currentMode = null; // 'in' or 'out'
    this.modal = null;

    // Click-animation queue state
    this._clickAnimQueue = [];
    this._clickAnimIndex = 0;
    this._clickAnimContainer = null;
    this._clickAnimResolve = null;

    // Auto-animation skip/cancel state
    this._currentAnimAbortController = null;
    this._isAnimating = false;
    this._cancelled = false;
  }

  /**
   * Initialize animation controller
   */
  async init() {
    console.log('Initializing AnimationController...');
    this.setupAnimationModal();
    console.log('AnimationController initialized');
  }

  /**
   * Setup animation modal
   */
  setupAnimationModal() {
    this.modal = document.getElementById('animation-modal');
    if (!this.modal) return;

    // Initialize modal
    M.Modal.init(this.modal);

    // Save button
    const saveBtn = document.getElementById('save-animation-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveAnimation();
      });
    }
  }

  /**
   * Open animation editor
   * @param {Element} element - Element to edit animation for
   * @param {string} mode - 'in' or 'out'
   */
  openAnimationEditor(element, mode) {
    this.currentElement = element;
    this.currentMode = mode;

    const currentAnimation = mode === 'in' ? element.inEffect : element.outEffect;

    // Populate form with current settings
    this.populateAnimationForm(currentAnimation);

    // Open modal
    const modalInstance = M.Modal.getInstance(this.modal);
    modalInstance.open();
  }

  /**
   * Populate animation form with current settings
   * @param {Object|null} animation - Animation object
   */
  populateAnimationForm(animation) {
    if (!animation) {
      // Clear form
      this.clearAnimationForm();
      return;
    }

    // Set animation type checkboxes
    const types = [
      { id: 'anim-fade-in', flag: AnimationType.FADE_IN },
      { id: 'anim-fade-out', flag: AnimationType.FADE_OUT },
      { id: 'anim-slide-in', flag: AnimationType.SLIDE_IN },
      { id: 'anim-slide-out', flag: AnimationType.SLIDE_OUT },
      { id: 'anim-zoom-in', flag: AnimationType.ZOOM_IN },
      { id: 'anim-zoom-out', flag: AnimationType.ZOOM_OUT }
    ];

    types.forEach(({ id, flag }) => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.checked = (animation.type & flag) !== 0;
      }
    });

    // Set direction
    const directionSelect = document.getElementById('anim-direction');
    if (directionSelect && animation.direction) {
      directionSelect.value = animation.direction;
      M.FormSelect.init(directionSelect);
    }

    // Set duration
    const durationInput = document.getElementById('anim-duration');
    if (durationInput && animation.duration) {
      durationInput.value = animation.duration;
    }

    // Set trigger
    const triggerSelect = document.getElementById('anim-trigger');
    if (triggerSelect && animation.trigger) {
      triggerSelect.value = animation.trigger;
      M.FormSelect.init(triggerSelect);
    }

    // Set easing
    const easingSelect = document.getElementById('anim-easing');
    if (easingSelect && animation.easing) {
      easingSelect.value = animation.easing;
      M.FormSelect.init(easingSelect);
    }
  }

  /**
   * Clear animation form
   */
  clearAnimationForm() {
    // Uncheck all checkboxes
    const checkboxes = this.modal.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((cb) => (cb.checked = false));

    // Reset selects
    const directionSelect = document.getElementById('anim-direction');
    if (directionSelect) {
      directionSelect.value = 'left';
      M.FormSelect.init(directionSelect);
    }

    const triggerSelect = document.getElementById('anim-trigger');
    if (triggerSelect) {
      triggerSelect.value = 'auto';
      M.FormSelect.init(triggerSelect);
    }

    const easingSelect = document.getElementById('anim-easing');
    if (easingSelect) {
      easingSelect.value = 'ease-in-out';
      M.FormSelect.init(easingSelect);
    }

    // Reset duration
    const durationInput = document.getElementById('anim-duration');
    if (durationInput) {
      durationInput.value = 600;
    }
  }

  /**
   * Save animation from form
   */
  saveAnimation() {
    if (!this.currentElement || !this.currentMode) return;

    // Build animation object from form
    const animation = this.buildAnimationFromForm();

    console.log('🎬 [AnimationController] Saving animation:', {
      element: this.currentElement.id,
      mode: this.currentMode,
      animation
    });

    // Set animation on element
    if (this.currentMode === 'in') {
      this.currentElement.inEffect = animation.type !== 0 ? animation : null;
    } else {
      this.currentElement.outEffect = animation.type !== 0 ? animation : null;
    }

    console.log('🎬 [AnimationController] Animation saved to element:', {
      elementId: this.currentElement.id,
      inEffect: this.currentElement.inEffect,
      outEffect: this.currentElement.outEffect
    });

    // Update UI
    if (this.editor.uiManager && this.editor.uiManager.elementsTree) {
      const currentSlide = this.editor.presentation.getCurrentSlide();
      this.editor.uiManager.elementsTree.render(currentSlide.elements);
    }

    this.editor.recordHistory();
    appEvents.emit(AppEvents.ANIMATION_UPDATED, {
      element: this.currentElement,
      mode: this.currentMode,
      animation
    });

    toast.success(`${this.currentMode === 'in' ? 'In' : 'Out'} animation ${animation.type !== 0 ? 'set' : 'removed'}`);
  }

  /**
   * Build animation object from form
   * @returns {Object} Animation object
   */
  buildAnimationFromForm() {
    let type = 0;

    // Get animation type (bitwise OR of selected flags)
    const types = [
      { id: 'anim-fade-in', flag: AnimationType.FADE_IN },
      { id: 'anim-fade-out', flag: AnimationType.FADE_OUT },
      { id: 'anim-slide-in', flag: AnimationType.SLIDE_IN },
      { id: 'anim-slide-out', flag: AnimationType.SLIDE_OUT },
      { id: 'anim-zoom-in', flag: AnimationType.ZOOM_IN },
      { id: 'anim-zoom-out', flag: AnimationType.ZOOM_OUT }
    ];

    types.forEach(({ id, flag }) => {
      const checkbox = document.getElementById(id);
      if (checkbox && checkbox.checked) {
        type |= flag;
      }
    });

    // Get other properties
    const direction = document.getElementById('anim-direction')?.value || 'left';
    const duration = parseInt(document.getElementById('anim-duration')?.value) || 600;
    const trigger = document.getElementById('anim-trigger')?.value || 'auto';
    const easing = document.getElementById('anim-easing')?.value || 'ease-in-out';

    return {
      type,
      direction,
      duration,
      trigger,
      easing
    };
  }

  /**
   * Set animation on element
   * @param {Element} element - Element
   * @param {string} mode - 'in' or 'out'
   * @param {Object} animation - Animation object
   */
  setAnimation(element, mode, animation) {
    if (mode === 'in') {
      element.inEffect = animation;
    } else {
      element.outEffect = animation;
    }

    this.editor.recordHistory();

    // Update elements tree
    if (this.editor.uiManager && this.editor.uiManager.elementsTree) {
      const currentSlide = this.editor.presentation.getCurrentSlide();
      this.editor.uiManager.elementsTree.render(currentSlide.elements);
    }

    appEvents.emit(AppEvents.ANIMATION_UPDATED, { element, mode, animation });
  }

  /**
   * Play slide animations (for presentation mode)
   * @param {Slide} slide - Slide to play animations for
   * @param {HTMLElement} container - DOM container to scope element lookups to
   * @returns {Promise} Promise that resolves when animations complete
   */
  async playSlideAnimations(slide, container) {
    this._cancelled = false;
    this._isAnimating = true;

    // Get all elements with inEffect
    const allElements = slide.getAllElements();
    const animatedElements = allElements.filter((el) => el.inEffect);

    // Prepare elements (hide them initially) — scoped to presentation container
    animatedElements.forEach((element) => {
      const elementDOM = container.querySelector(`#${element.id}`);
      if (elementDOM) {
        prepareElementForAnimation(elementDOM);
      }
    });

    // Separate by trigger type (only for elements that aren't children of another animated element)
    const autoElements = animatedElements.filter(
      (el) => !animatedElements.includes(el.parent) && (el.inEffect.trigger === AnimationTrigger.AUTO || el.inEffect.trigger === 'auto')
    );

    const clickElements = animatedElements.filter(
      (el) => !animatedElements.includes(el.parent) && (el.inEffect.trigger === AnimationTrigger.CLICK || el.inEffect.trigger === 'click')
    );

    // Play auto animations (skippable via skipCurrentAnimation)
    for (const element of autoElements) {
      if (this._cancelled) break;
      await this.playElementAnimation(element, 'in', container);
    }

    if (this._cancelled) {
      this._isAnimating = false;
      return;
    }

    this._isAnimating = false;

    // Setup click-triggered animation queue (advanced by PlaybackController.advance)
    if (clickElements.length > 0) {
      await this.playClickAnimations(clickElements, container);
    }
  }

  /**
   * Whether auto animations are currently playing
   * @returns {boolean}
   */
  get isAnimating() {
    return this._isAnimating;
  }

  /**
   * Whether there are queued click-triggered animations still waiting
   * @returns {boolean}
   */
  get hasPendingClickAnimations() {
    return this._clickAnimQueue.length > 0 && this._clickAnimIndex < this._clickAnimQueue.length;
  }

  /**
   * Skip the currently playing animation (completes it immediately)
   */
  skipCurrentAnimation() {
    if (this._currentAnimAbortController) {
      this._currentAnimAbortController.abort();
    }
  }

  /**
   * Full cleanup — abort all animations, reset all state
   * Called when switching slides or stopping playback.
   */
  cleanup() {
    this._cancelled = true;
    this.skipCurrentAnimation();
    this._currentAnimAbortController = null;
    this._isAnimating = false;
    this._cleanupClickListeners();
  }

  /**
   * Advance the click-animation queue by one step (called externally by PlaybackController)
   * @returns {Promise<boolean>} true if an animation was played
   */
  async advanceClickAnimation() {
    if (!this.hasPendingClickAnimations) return false;

    await this.playElementAnimation(
      this._clickAnimQueue[this._clickAnimIndex], 'in', this._clickAnimContainer
    );
    this._clickAnimIndex++;

    if (!this.hasPendingClickAnimations) {
      this._cleanupClickListeners();
    }

    return true;
  }

  /**
   * Play click-triggered animations, advancing one per click or "next" key press
   * @param {Array} elements - Elements with click-triggered animations
   * @param {HTMLElement} container - DOM container to scope element lookups to
   * @returns {Promise} Resolves when all click animations have been played
   */
  playClickAnimations(elements, container) {
    // Clean up any leftover state from a previous slide
    this._cleanupClickListeners();

    this._clickAnimQueue = elements;
    this._clickAnimIndex = 0;
    this._clickAnimContainer = container;

    // No click/escape listeners here — PlaybackController drives
    // advancement via its unified advance() method.
    return new Promise((resolve) => {
      this._clickAnimResolve = resolve;
    });
  }

  /**
   * Remove click-animation event listeners and reset queue state
   */
  _cleanupClickListeners() {
    this._clickAnimQueue = [];
    this._clickAnimIndex = 0;
    this._clickAnimContainer = null;

    if (this._clickAnimResolve) {
      this._clickAnimResolve();
      this._clickAnimResolve = null;
    }
  }

  /**
   * Play animation for single element
   * @param {Element} element - Element to animate
   * @param {string} mode - 'in' or 'out'
   * @param {HTMLElement} container - DOM container to scope element lookups to
   * @returns {Promise} Promise that resolves when animation completes
   */
  async playElementAnimation(element, mode, container) {
    if (this._cancelled) return;

    const animation = mode === 'in' ? element.inEffect : element.outEffect;
    if (!animation) return;

    const elementDOM = container.querySelector(`#${element.id}`);
    if (!elementDOM) return;

    appEvents.emit(AppEvents.ANIMATION_STARTED, { element, mode });

    // Create abort controller so this animation can be skipped externally
    this._currentAnimAbortController = new AbortController();
    await applyAnimation(elementDOM, animation, { signal: this._currentAnimAbortController.signal });
    this._currentAnimAbortController = null;

    // Play children animations
    for (const child of element.children) {
      if (this._cancelled) break;
      await this.playElementAnimation(child, mode, container);
    }

    appEvents.emit(AppEvents.ANIMATION_ENDED, { element, mode });
  }
}

export default AnimationController;
