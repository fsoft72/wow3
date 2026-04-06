/**
 * WOW3 Animation Migration
 * Converts old inEffect/outEffect bitwise animations on elements
 * to the new slide-level animationSequence format.
 */

import { AnimationType, AnimationTrigger } from '../utils/constants.js';
import { ANIMATION_CATEGORY, ANIMATION_TRIGGER } from './definitions.js';
import { generateId } from '../utils/dom.js';

/**
 * Map old bitwise animation flag + direction to new animation type string
 * @param {number} flag - Single bitwise flag
 * @param {string} direction - Direction string (left/right/top/bottom)
 * @param {string} mode - 'in' or 'out'
 * @returns {string|null} New animation type key
 */
const _mapFlag = (flag, direction, mode) => {
  if (mode === 'in') {
    if (flag === AnimationType.FADE_IN) return 'fadeIn';
    if (flag === AnimationType.SLIDE_IN) {
      const dirMap = { left: 'slideInLeft', right: 'slideInRight', top: 'slideInTop', bottom: 'slideInBottom' };
      return dirMap[direction] || 'slideInLeft';
    }
    if (flag === AnimationType.ZOOM_IN) return 'zoomIn';
    if (flag === AnimationType.FLIP_IN) return 'flipInX';
    if (flag === AnimationType.BOUNCE_IN) return 'bounceIn';
    if (flag === AnimationType.ROTATE_IN) return 'rotateIn';
  } else {
    if (flag === AnimationType.FADE_OUT) return 'fadeOut';
    if (flag === AnimationType.SLIDE_OUT) {
      const dirMap = { left: 'slideOutLeft', right: 'slideOutRight' };
      return dirMap[direction] || 'slideOutLeft';
    }
    if (flag === AnimationType.ZOOM_OUT) return 'zoomOut';
    if (flag === AnimationType.FLIP_OUT) return 'flipOutX';
    if (flag === AnimationType.BOUNCE_OUT) return 'bounceOut';
    if (flag === AnimationType.ROTATE_OUT) return 'rotateOut';
  }
  return null;
};

/**
 * Decompose a bitwise animation type into individual flags
 * @param {number} type - Bitwise OR'd animation type
 * @param {string} mode - 'in' or 'out'
 * @returns {Array<number>} Individual flag values
 */
const _decomposeFlags = (type, mode) => {
  const inFlags = [
    AnimationType.FADE_IN, AnimationType.SLIDE_IN, AnimationType.ZOOM_IN,
    AnimationType.FLIP_IN, AnimationType.BOUNCE_IN, AnimationType.ROTATE_IN
  ];
  const outFlags = [
    AnimationType.FADE_OUT, AnimationType.SLIDE_OUT, AnimationType.ZOOM_OUT,
    AnimationType.FLIP_OUT, AnimationType.BOUNCE_OUT, AnimationType.ROTATE_OUT
  ];
  const flags = mode === 'in' ? inFlags : outFlags;
  return flags.filter((flag) => (type & flag) !== 0);
};

/**
 * Convert old trigger value to new trigger enum
 * @param {string} oldTrigger - 'auto' or 'click'
 * @returns {string} New trigger value
 */
const _mapTrigger = (oldTrigger) => {
  if (oldTrigger === AnimationTrigger.CLICK || oldTrigger === 'click') {
    return ANIMATION_TRIGGER.ON_CLICK;
  }
  return ANIMATION_TRIGGER.ON_LOAD;
};

/**
 * Convert a single legacy effect into one or more animation sequence entries
 * @param {Object} effect - Old inEffect or outEffect object
 * @param {string} elementId - Target element ID
 * @param {string} mode - 'in' or 'out'
 * @returns {Array<Object>} Animation sequence entries
 */
const _convertEffect = (effect, elementId, mode) => {
  if (!effect || !effect.type) return [];

  const flags = _decomposeFlags(effect.type, mode);
  if (flags.length === 0) return [];

  const category = mode === 'in' ? ANIMATION_CATEGORY.BUILD_IN : ANIMATION_CATEGORY.BUILD_OUT;
  const trigger = _mapTrigger(effect.trigger);

  const entries = flags.map((flag, index) => {
    const type = _mapFlag(flag, effect.direction, mode);
    if (!type) return null;

    return {
      id: generateId('anim'),
      targetElementId: elementId,
      type,
      category,
      trigger: index === 0 ? trigger : ANIMATION_TRIGGER.WITH_PREVIOUS,
      duration: effect.duration || 600,
      delay: 0,
      easing: effect.easing || 'ease-in-out'
    };
  });

  return entries.filter(Boolean);
};

/**
 * Migrate all legacy element animations from a slide into an animationSequence.
 * Processes all elements (including children) in z-order: buildIn first, then buildOut.
 * @param {Object} slide - Slide model instance
 * @returns {Array<Object>} The new animationSequence array
 */
export const migrateElementAnimations = (slide) => {
  const sequence = [];
  const allElements = slide.getAllElements();

  // Build-in animations first (in element z-order)
  for (const element of allElements) {
    if (element.inEffect) {
      const entries = _convertEffect(element.inEffect, element.id, 'in');
      sequence.push(...entries);
    }
  }

  // Then build-out animations
  for (const element of allElements) {
    if (element.outEffect) {
      const entries = _convertEffect(element.outEffect, element.id, 'out');
      sequence.push(...entries);
    }
  }

  return sequence;
};

/**
 * Check if a slide has any legacy animations on its elements
 * @param {Object} slide - Slide model instance
 * @returns {boolean} True if any element has inEffect or outEffect
 */
export const hasLegacyAnimations = (slide) => {
  const allElements = slide.getAllElements();
  return allElements.some((el) => el.inEffect || el.outEffect);
};
