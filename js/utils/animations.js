/**
 * WOW3 Animation Utilities
 * Helper functions for applying and managing CSS3 animations
 */

import { AnimationType, SlideDirection } from './constants.js';

/**
 * Apply animation to an element
 * @param {HTMLElement} element - Element to animate
 * @param {Object} animation - Animation configuration
 * @param {Object} options - Additional options
 * @returns {Promise} Promise that resolves when animation completes
 */
export const applyAnimation = (element, animation, options = {}) => {
  return new Promise((resolve) => {
    if (!animation || !element) {
      resolve();
      return;
    }

    // Remove existing animations
    removeAnimation(element);

    // Make element visible and clear the inline opacity so CSS keyframes can control it.
    // All "in" keyframes start from opacity: 0, so fill-mode: both handles the initial state.
    element.style.removeProperty('opacity');
    element.style.setProperty('visibility', 'visible', 'important');

    // Apply duration
    const duration = animation.duration || 600;
    element.style.animationDuration = `${duration}ms`;

    // Apply delay if specified
    if (options.delay || animation.delay) {
      const delay = options.delay || animation.delay;
      element.style.animationDelay = `${delay}ms`;
    }

    // Apply easing
    const easing = options.easing || animation.easing || 'ease-in-out';
    element.style.animationTimingFunction = easing;

    // Add base animated class (sets animation-fill-mode: both)
    element.classList.add('wow-animated');

    // Force reflow so the browser registers the pre-animation state
    void element.offsetWidth;

    // Apply animation type classes — this triggers the animation
    const animationClasses = getAnimationClasses(animation.type, animation.direction);
    animationClasses.forEach(cls => element.classList.add(cls));

    // Finalise element visibility after animation completes
    let resolved = false;
    const finalise = () => {
      if (resolved) return;
      resolved = true;
      element.removeEventListener('animationend', onEnd);
      clearTimeout(fallbackTimeout);
      if (options.signal) {
        options.signal.removeEventListener('abort', finalise);
      }
      removeAnimation(element);
      element.style.setProperty('opacity', '1', 'important');
      element.style.setProperty('visibility', 'visible', 'important');
      resolve();
    };

    const onEnd = () => finalise();
    element.addEventListener('animationend', onEnd, { once: true });

    // Fallback timeout in case animationend doesn't fire
    const timeoutDuration = duration + (options.delay || animation.delay || 0) + 100;
    const fallbackTimeout = setTimeout(finalise, timeoutDuration);

    // Allow external abort (skip animation immediately)
    if (options.signal) {
      if (options.signal.aborted) {
        finalise();
      } else {
        options.signal.addEventListener('abort', finalise, { once: true });
      }
    }
  });
};

/**
 * Remove all animation classes from element
 * @param {HTMLElement} element - Element to clean
 */
export const removeAnimation = (element) => {
  if (!element) return;

  const classes = Array.from(element.classList).filter(cls => cls.startsWith('wow-'));
  classes.forEach(cls => element.classList.remove(cls));

  element.style.animationDuration = '';
  element.style.animationDelay = '';
  element.style.animationTimingFunction = '';
  // NOTE: We don't clear opacity or visibility here
  // as the element should remain visible after animation
};

/**
 * Wait for animation to complete
 * @param {HTMLElement} element - Element being animated
 * @returns {Promise} Promise that resolves when animation ends
 */
export const waitForAnimation = (element) => {
  return new Promise((resolve) => {
    const handler = () => {
      element.removeEventListener('animationend', handler);
      resolve();
    };
    element.addEventListener('animationend', handler);
  });
};

/**
 * Play animation sequence (multiple animations in order)
 * @param {Array} animations - Array of {element, animation, options}
 * @param {boolean} sequential - If true, play sequentially, else in parallel
 * @returns {Promise} Promise that resolves when all animations complete
 */
export const playAnimationSequence = async (animations, sequential = false) => {
  if (sequential) {
    for (const anim of animations) {
      await applyAnimation(anim.element, anim.animation, anim.options);
    }
  } else {
    await Promise.all(
      animations.map(anim => applyAnimation(anim.element, anim.animation, anim.options))
    );
  }
};

/**
 * Get CSS classes for animation type
 * @param {number} type - Animation type (bitwise flags)
 * @param {string} direction - Animation direction
 * @returns {Array} Array of CSS class names
 */
const getAnimationClasses = (type, direction = SlideDirection.LEFT) => {
  const classes = [];

  if (type & AnimationType.FADE_IN) {
    classes.push('wow-fade-in');
  }
  if (type & AnimationType.FADE_OUT) {
    classes.push('wow-fade-out');
  }
  if (type & AnimationType.SLIDE_IN) {
    classes.push(`wow-slide-in-${direction}`);
  }
  if (type & AnimationType.SLIDE_OUT) {
    classes.push(`wow-slide-out-${direction}`);
  }
  if (type & AnimationType.ZOOM_IN) {
    classes.push('wow-zoom-in');
  }
  if (type & AnimationType.ZOOM_OUT) {
    classes.push('wow-zoom-out');
  }
  if (type & AnimationType.FLIP_IN) {
    classes.push('wow-flip-in-x');
  }
  if (type & AnimationType.FLIP_OUT) {
    classes.push('wow-flip-out-x');
  }
  if (type & AnimationType.BOUNCE_IN) {
    classes.push('wow-bounce-in');
  }
  if (type & AnimationType.BOUNCE_OUT) {
    classes.push('wow-bounce-out');
  }
  if (type & AnimationType.ROTATE_IN) {
    classes.push('wow-rotate-in');
  }
  if (type & AnimationType.ROTATE_OUT) {
    classes.push('wow-rotate-out');
  }

  return classes;
};

/**
 * Animation presets for common effects
 */
export const AnimationPresets = {
  /**
   * Quick fade in
   */
  quickFadeIn: () => ({
    type: AnimationType.FADE_IN,
    duration: 300,
    trigger: 'auto'
  }),

  /**
   * Slide in with bounce
   */
  slideInBounce: (direction = SlideDirection.LEFT) => ({
    type: AnimationType.SLIDE_IN,
    duration: 600,
    trigger: 'auto',
    direction,
    easing: 'ease-out-back'
  }),

  /**
   * Dramatic zoom in
   */
  dramaticZoomIn: () => ({
    type: AnimationType.ZOOM_IN,
    duration: 800,
    trigger: 'auto'
  }),

  /**
   * Fade and zoom combined
   */
  fadeZoomIn: () => ({
    type: AnimationType.FADE_IN | AnimationType.ZOOM_IN,
    duration: 600,
    trigger: 'auto'
  }),

  /**
   * Slide and fade combined
   */
  slideFadeIn: (direction = SlideDirection.LEFT) => ({
    type: AnimationType.FADE_IN | AnimationType.SLIDE_IN,
    duration: 600,
    trigger: 'auto',
    direction
  }),

  /**
   * Bounce entrance
   */
  bounceIn: () => ({
    type: AnimationType.BOUNCE_IN,
    duration: 800,
    trigger: 'auto'
  }),

  /**
   * Flip entrance
   */
  flipIn: () => ({
    type: AnimationType.FLIP_IN,
    duration: 600,
    trigger: 'auto'
  }),

  /**
   * Rotate entrance
   */
  rotateIn: () => ({
    type: AnimationType.ROTATE_IN,
    duration: 700,
    trigger: 'auto'
  })
};

/**
 * Get animation type name for display
 * @param {number} type - Animation type (bitwise flags)
 * @returns {string} Human-readable animation name
 */
export const getAnimationTypeName = (type) => {
  const names = [];

  if (type & AnimationType.FADE_IN) names.push('Fade In');
  if (type & AnimationType.FADE_OUT) names.push('Fade Out');
  if (type & AnimationType.SLIDE_IN) names.push('Slide In');
  if (type & AnimationType.SLIDE_OUT) names.push('Slide Out');
  if (type & AnimationType.ZOOM_IN) names.push('Zoom In');
  if (type & AnimationType.ZOOM_OUT) names.push('Zoom Out');
  if (type & AnimationType.FLIP_IN) names.push('Flip In');
  if (type & AnimationType.FLIP_OUT) names.push('Flip Out');
  if (type & AnimationType.BOUNCE_IN) names.push('Bounce In');
  if (type & AnimationType.BOUNCE_OUT) names.push('Bounce Out');
  if (type & AnimationType.ROTATE_IN) names.push('Rotate In');
  if (type & AnimationType.ROTATE_OUT) names.push('Rotate Out');

  return names.join(' + ') || 'None';
};

/**
 * Prepare element for animation (hide it initially)
 * @param {HTMLElement} element - Element to prepare
 */
export const prepareElementForAnimation = (element) => {
  if (!element) return;
  element.style.opacity = '0';
  element.style.visibility = 'hidden';
};

/**
 * Reset element after animation
 * @param {HTMLElement} element - Element to reset
 */
export const resetElement = (element) => {
  if (!element) return;
  removeAnimation(element);
  element.style.opacity = '1';
  element.style.visibility = 'visible';
};
