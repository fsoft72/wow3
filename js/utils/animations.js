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
    console.log('🎨 [applyAnimation] Starting:', {
      element: element.id,
      animation,
      options
    });

    if (!animation || !element) {
      console.log('🎨 [applyAnimation] ❌ Missing animation or element');
      resolve();
      return;
    }

    // Remove existing animations
    removeAnimation(element);

    // Add base animated class
    element.classList.add('wow-animated');

    // Apply duration
    const duration = animation.duration || 600;
    element.style.animationDuration = `${duration}ms`;
    console.log('🎨 [applyAnimation] Duration set:', duration + 'ms');

    // Apply delay if specified
    if (options.delay || animation.delay) {
      const delay = options.delay || animation.delay;
      element.style.animationDelay = `${delay}ms`;
      console.log('🎨 [applyAnimation] Delay set:', delay + 'ms');
    }

    // Apply easing
    const easing = options.easing || animation.easing || 'ease-in-out';
    element.style.animationTimingFunction = easing;
    console.log('🎨 [applyAnimation] Easing set:', easing);

    // Apply animation type classes
    const animationClasses = getAnimationClasses(animation.type, animation.direction);
    console.log('🎨 [applyAnimation] Animation classes:', animationClasses);
    animationClasses.forEach(cls => element.classList.add(cls));

    // Make element visible (with !important to prevent override)
    element.style.setProperty('opacity', '1', 'important');
    element.style.setProperty('visibility', 'visible', 'important');
    console.log('🎨 [applyAnimation] Element made visible with !important');
    console.log('🎨 [applyAnimation] Verify styles after setting:', {
      opacity: element.style.opacity,
      visibility: element.style.visibility,
      cssText: element.style.cssText
    });

    console.log('🎨 [applyAnimation] Final element classes:', Array.from(element.classList));
    console.log('🎨 [applyAnimation] Final element styles:', {
      animationDuration: element.style.animationDuration,
      animationTimingFunction: element.style.animationTimingFunction,
      opacity: element.style.opacity,
      visibility: element.style.visibility
    });

    // Wait for animation to complete
    const handler = () => {
      console.log('🎨 [applyAnimation] ✓ animationend event fired for:', element.id);

      // Ensure element stays visible after animation (with !important)
      element.style.setProperty('opacity', '1', 'important');
      element.style.setProperty('visibility', 'visible', 'important');

      // Clean up animation classes but keep element visible
      removeAnimation(element);
      element.style.setProperty('opacity', '1', 'important');
      element.style.setProperty('visibility', 'visible', 'important');

      // DEBUG: Comprehensive element state
      const computedStyle = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      console.log('🔍 [DEBUG] Complete element state for:', element.id);
      console.log('📐 BoundingRect:', {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left
      });
      console.log('🎨 Computed styles:', {
        opacity: computedStyle.opacity,
        visibility: computedStyle.visibility,
        display: computedStyle.display,
        position: computedStyle.position,
        zIndex: computedStyle.zIndex,
        transform: computedStyle.transform,
        width: computedStyle.width,
        height: computedStyle.height
      });
      console.log('📝 Inline styles:', {
        opacity: element.style.opacity,
        visibility: element.style.visibility,
        display: element.style.display,
        width: element.style.width,
        height: element.style.height,
        left: element.style.left,
        top: element.style.top
      });
      console.log('📦 Element HTML:', element.outerHTML.substring(0, 500));
      console.log('👁️ Is element in viewport?',
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth
      );

      // DEBUG: Check parent container
      const parent = element.parentElement;
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        const parentComputed = window.getComputedStyle(parent);
        console.log('📦 PARENT container:', parent.id || parent.className);
        console.log('📐 PARENT BoundingRect:', {
          x: parentRect.x,
          y: parentRect.y,
          width: parentRect.width,
          height: parentRect.height
        });
        console.log('🎨 PARENT Computed:', {
          opacity: parentComputed.opacity,
          visibility: parentComputed.visibility,
          display: parentComputed.display,
          overflow: parentComputed.overflow,
          zIndex: parentComputed.zIndex,
          background: parentComputed.background
        });
      }

      // DEBUG: Check for overlapping elements
      const elementAtPoint = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
      console.log('🎯 Element at center point:', elementAtPoint?.id || elementAtPoint?.className);
      console.log('🎯 Is our element at that point?', elementAtPoint === element);

      // DEBUG: Check element state after 2 seconds
      setTimeout(() => {
        console.log('⏰ [2 SECONDS LATER] Element state for:', element.id);
        console.log('⏰ Inline styles:', element.style.cssText);
        console.log('⏰ Opacity:', element.style.opacity);
        console.log('⏰ Visibility:', element.style.visibility);
        const computedNow = window.getComputedStyle(element);
        console.log('⏰ Computed opacity:', computedNow.opacity);
        console.log('⏰ Computed visibility:', computedNow.visibility);
      }, 2000);

      element.removeEventListener('animationend', handler);
      resolve();
    };

    element.addEventListener('animationend', handler);

    // Fallback timeout in case animationend doesn't fire
    const timeoutDuration = duration + (options.delay || animation.delay || 0) + 100;
    console.log('🎨 [applyAnimation] Setting fallback timeout:', timeoutDuration + 'ms');
    setTimeout(() => {
      console.log('🎨 [applyAnimation] ⏱️ Timeout fallback triggered for:', element.id);

      // Ensure element stays visible (with !important)
      element.style.setProperty('opacity', '1', 'important');
      element.style.setProperty('visibility', 'visible', 'important');

      // Clean up
      removeAnimation(element);
      element.style.setProperty('opacity', '1', 'important');
      element.style.setProperty('visibility', 'visible', 'important');

      element.removeEventListener('animationend', handler);
      resolve();
    }, timeoutDuration);
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
  console.log('🎬 [prepareElementForAnimation] Hiding element:', element.id);
  element.style.opacity = '0';
  element.style.visibility = 'hidden';
  console.log('🎬 [prepareElementForAnimation] Element hidden:', element.style.cssText);
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
