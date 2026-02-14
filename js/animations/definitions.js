/**
 * WOW3 Animation Definitions
 * Centralized WAAPI keyframe registry, enums, and helpers
 */

/** Animation categories */
export const ANIMATION_CATEGORY = {
  BUILD_IN: 'buildIn',
  ACTION: 'action',
  BUILD_OUT: 'buildOut'
};

/** Animation trigger types */
export const ANIMATION_TRIGGER = {
  ON_LOAD: 'onLoad',
  ON_CLICK: 'onClick',
  AFTER_PREVIOUS: 'afterPrevious',
  WITH_PREVIOUS: 'withPrevious'
};

/** Named easing values mapped to CSS/WAAPI easing strings */
export const EASING_MAP = {
  'linear': 'linear',
  'ease': 'ease',
  'ease-in': 'ease-in',
  'ease-out': 'ease-out',
  'ease-in-out': 'ease-in-out',
  'ease-in-back': 'cubic-bezier(0.6, -0.28, 0.735, 0.045)',
  'ease-out-back': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  'ease-in-out-back': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
};

/**
 * Animation definitions registry.
 * Each entry contains label, supported categories, WAAPI keyframes, and default options.
 */
export const ANIMATION_DEFINITIONS = {
  // ==================== BUILD IN ====================

  fadeIn: {
    label: 'Fade In',
    category: [ANIMATION_CATEGORY.BUILD_IN],
    keyframes: [
      { opacity: 0 },
      { opacity: 1 }
    ],
    options: { duration: 600, easing: 'ease-in-out' }
  },

  slideInLeft: {
    label: 'Slide In Left',
    category: [ANIMATION_CATEGORY.BUILD_IN],
    keyframes: [
      { transform: 'translateX(-100%)', opacity: 0 },
      { transform: 'translateX(0)', opacity: 1 }
    ],
    options: { duration: 600, easing: 'ease-out' }
  },

  slideInRight: {
    label: 'Slide In Right',
    category: [ANIMATION_CATEGORY.BUILD_IN],
    keyframes: [
      { transform: 'translateX(100%)', opacity: 0 },
      { transform: 'translateX(0)', opacity: 1 }
    ],
    options: { duration: 600, easing: 'ease-out' }
  },

  slideInTop: {
    label: 'Slide In Top',
    category: [ANIMATION_CATEGORY.BUILD_IN],
    keyframes: [
      { transform: 'translateY(-100%)', opacity: 0 },
      { transform: 'translateY(0)', opacity: 1 }
    ],
    options: { duration: 600, easing: 'ease-out' }
  },

  slideInBottom: {
    label: 'Slide In Bottom',
    category: [ANIMATION_CATEGORY.BUILD_IN],
    keyframes: [
      { transform: 'translateY(100%)', opacity: 0 },
      { transform: 'translateY(0)', opacity: 1 }
    ],
    options: { duration: 600, easing: 'ease-out' }
  },

  zoomIn: {
    label: 'Zoom In',
    category: [ANIMATION_CATEGORY.BUILD_IN],
    keyframes: [
      { transform: 'scale(0.3)', opacity: 0 },
      { transform: 'scale(1)', opacity: 1, offset: 0.5 },
      { transform: 'scale(1)', opacity: 1 }
    ],
    options: { duration: 600, easing: 'ease-in-out' }
  },

  bounceIn: {
    label: 'Bounce In',
    category: [ANIMATION_CATEGORY.BUILD_IN],
    keyframes: [
      { transform: 'scale(0.3)', opacity: 0, offset: 0 },
      { transform: 'scale(1.1)', offset: 0.2 },
      { transform: 'scale(0.9)', offset: 0.4 },
      { transform: 'scale(1.03)', opacity: 1, offset: 0.6 },
      { transform: 'scale(0.97)', offset: 0.8 },
      { transform: 'scale(1)', opacity: 1, offset: 1 }
    ],
    options: { duration: 800, easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)' }
  },

  flipInX: {
    label: 'Flip In X',
    category: [ANIMATION_CATEGORY.BUILD_IN],
    keyframes: [
      { transform: 'perspective(400px) rotateX(90deg)', opacity: 0, offset: 0 },
      { transform: 'perspective(400px) rotateX(-20deg)', offset: 0.4 },
      { transform: 'perspective(400px) rotateX(10deg)', opacity: 1, offset: 0.6 },
      { transform: 'perspective(400px) rotateX(-5deg)', offset: 0.8 },
      { transform: 'perspective(400px) rotateX(0deg)', opacity: 1, offset: 1 }
    ],
    options: { duration: 600, easing: 'ease-in-out' }
  },

  rotateIn: {
    label: 'Rotate In',
    category: [ANIMATION_CATEGORY.BUILD_IN],
    keyframes: [
      { transform: 'rotate(-200deg)', opacity: 0 },
      { transform: 'rotate(0deg)', opacity: 1 }
    ],
    options: { duration: 700, easing: 'ease-out' }
  },

  fadeInSlideUp: {
    label: 'Fade In Slide Up',
    category: [ANIMATION_CATEGORY.BUILD_IN],
    keyframes: [
      { transform: 'translateY(50px)', opacity: 0 },
      { transform: 'translateY(0)', opacity: 1 }
    ],
    options: { duration: 600, easing: 'ease-out' }
  },

  // ==================== ACTION ====================

  pulse: {
    label: 'Pulse',
    category: [ANIMATION_CATEGORY.ACTION],
    keyframes: [
      { transform: 'scale(1)', offset: 0 },
      { transform: 'scale(1.1)', offset: 0.5 },
      { transform: 'scale(1)', offset: 1 }
    ],
    options: { duration: 600, easing: 'ease-in-out' }
  },

  shake: {
    label: 'Shake',
    category: [ANIMATION_CATEGORY.ACTION],
    keyframes: [
      { transform: 'translateX(0)', offset: 0 },
      { transform: 'translateX(-10px)', offset: 0.1 },
      { transform: 'translateX(10px)', offset: 0.2 },
      { transform: 'translateX(-10px)', offset: 0.3 },
      { transform: 'translateX(10px)', offset: 0.4 },
      { transform: 'translateX(-10px)', offset: 0.5 },
      { transform: 'translateX(10px)', offset: 0.6 },
      { transform: 'translateX(-10px)', offset: 0.7 },
      { transform: 'translateX(10px)', offset: 0.8 },
      { transform: 'translateX(-5px)', offset: 0.9 },
      { transform: 'translateX(0)', offset: 1 }
    ],
    options: { duration: 800, easing: 'ease-in-out' }
  },

  spin: {
    label: 'Spin',
    category: [ANIMATION_CATEGORY.ACTION],
    keyframes: [
      { transform: 'rotate(0deg)', offset: 0 },
      { transform: 'rotate(360deg)', offset: 1 }
    ],
    options: { duration: 800, easing: 'ease-in-out' }
  },

  // ==================== BUILD OUT ====================

  fadeOut: {
    label: 'Fade Out',
    category: [ANIMATION_CATEGORY.BUILD_OUT],
    keyframes: [
      { opacity: 1 },
      { opacity: 0 }
    ],
    options: { duration: 600, easing: 'ease-in-out' }
  },

  slideOutLeft: {
    label: 'Slide Out Left',
    category: [ANIMATION_CATEGORY.BUILD_OUT],
    keyframes: [
      { transform: 'translateX(0)', opacity: 1 },
      { transform: 'translateX(-100%)', opacity: 0 }
    ],
    options: { duration: 600, easing: 'ease-in' }
  },

  slideOutRight: {
    label: 'Slide Out Right',
    category: [ANIMATION_CATEGORY.BUILD_OUT],
    keyframes: [
      { transform: 'translateX(0)', opacity: 1 },
      { transform: 'translateX(100%)', opacity: 0 }
    ],
    options: { duration: 600, easing: 'ease-in' }
  },

  zoomOut: {
    label: 'Zoom Out',
    category: [ANIMATION_CATEGORY.BUILD_OUT],
    keyframes: [
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(0.3)', opacity: 0, offset: 0.5 },
      { transform: 'scale(0.3)', opacity: 0 }
    ],
    options: { duration: 600, easing: 'ease-in-out' }
  },

  bounceOut: {
    label: 'Bounce Out',
    category: [ANIMATION_CATEGORY.BUILD_OUT],
    keyframes: [
      { transform: 'scale(1)', offset: 0 },
      { transform: 'scale(0.9)', offset: 0.2 },
      { transform: 'scale(1.1)', opacity: 1, offset: 0.5 },
      { transform: 'scale(0.3)', opacity: 0, offset: 1 }
    ],
    options: { duration: 800, easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)' }
  },

  rotateOut: {
    label: 'Rotate Out',
    category: [ANIMATION_CATEGORY.BUILD_OUT],
    keyframes: [
      { transform: 'rotate(0deg)', opacity: 1 },
      { transform: 'rotate(200deg)', opacity: 0 }
    ],
    options: { duration: 700, easing: 'ease-in' }
  },

  flipOutX: {
    label: 'Flip Out X',
    category: [ANIMATION_CATEGORY.BUILD_OUT],
    keyframes: [
      { transform: 'perspective(400px) rotateX(0deg)', opacity: 1, offset: 0 },
      { transform: 'perspective(400px) rotateX(-20deg)', opacity: 1, offset: 0.3 },
      { transform: 'perspective(400px) rotateX(90deg)', opacity: 0, offset: 1 }
    ],
    options: { duration: 600, easing: 'ease-in' }
  }
};

/**
 * Get animation definitions filtered by category
 * @param {string} category - One of ANIMATION_CATEGORY values
 * @returns {Array<{key: string, label: string, keyframes: Array, options: Object}>}
 */
export const getDefinitionsForCategory = (category) => {
  return Object.entries(ANIMATION_DEFINITIONS)
    .filter(([_, def]) => def.category.includes(category))
    .map(([key, def]) => ({ key, ...def }));
};
