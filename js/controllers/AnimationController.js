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

    M.toast({
      html: `${this.currentMode === 'in' ? 'In' : 'Out'} animation ${animation.type !== 0 ? 'set' : 'removed'}`,
      classes: 'green'
    });
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
   * @returns {Promise} Promise that resolves when animations complete
   */
  async playSlideAnimations(slide) {
    // Get all elements with inEffect
    const allElements = slide.getAllElements();
    const animatedElements = allElements.filter((el) => el.inEffect);

    // Prepare elements (hide them initially)
    animatedElements.forEach((element) => {
      const elementDOM = document.getElementById(element.id);
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

    // Play auto animations
    for (const element of autoElements) {
      await this.playElementAnimation(element, 'in');
    }

    // Setup click handler for click-triggered animations
    if (clickElements.length > 0) {
      await this.playClickAnimations(clickElements);
    }
  }

  /**
   * Play click-triggered animations
   * @param {Array} elements - Elements with click-triggered animations
   * @returns {Promise} Promise that resolves when all animations complete
   */
  playClickAnimations(elements) {
    return new Promise((resolve) => {
      let currentIndex = 0;

      const playNext = async () => {
        if (currentIndex < elements.length) {
          await this.playElementAnimation(elements[currentIndex], 'in');
          currentIndex++;
        } else {
          document.removeEventListener('click', playNext);
          resolve();
        }
      };

      document.addEventListener('click', playNext);

      // Also resolve on escape
      const escapeHandler = (e) => {
        if (e.key === 'Escape') {
          document.removeEventListener('click', playNext);
          document.removeEventListener('keydown', escapeHandler);
          resolve();
        }
      };
      document.addEventListener('keydown', escapeHandler);
    });
  }

  /**
   * Play animation for single element
   * @param {Element} element - Element to animate
   * @param {string} mode - 'in' or 'out'
   * @returns {Promise} Promise that resolves when animation completes
   */
  async playElementAnimation(element, mode) {
    const animation = mode === 'in' ? element.inEffect : element.outEffect;
    console.log('🎬 [AnimationController] playElementAnimation:', {
      elementId: element.id,
      mode,
      animation
    });

    if (!animation) {
      console.log('🎬 [AnimationController] No animation found for element:', element.id);
      return;
    }

    const elementDOM = document.getElementById(element.id);
    if (!elementDOM) {
      return;
    }

    appEvents.emit(AppEvents.ANIMATION_STARTED, { element, mode });

    // Apply animation
    await applyAnimation(elementDOM, animation);

    // Play children animations
    for (const child of element.children) {
      await this.playElementAnimation(child, mode);
    }

    appEvents.emit(AppEvents.ANIMATION_ENDED, { element, mode });
  }
}

export default AnimationController;
