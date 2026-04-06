/**
 * WOW3 Animation Manager
 * Pure WAAPI playback engine — no UI, no editor awareness.
 * Takes a DOM container + sequence data and plays animations.
 */

import {
  ANIMATION_DEFINITIONS,
  ANIMATION_CATEGORY,
  ANIMATION_TRIGGER,
  EASING_MAP
} from './definitions.js';

export class AnimationManager {
  /**
   * Create an AnimationManager bound to a container element
   * @param {HTMLElement} containerElement - The DOM container holding animated elements
   */
  constructor(containerElement) {
    this._container = containerElement;
    this._sequence = [];
    this._cursor = 0;
    this._playing = false;
    this._waitingForClick = false;
    this._runningAnimations = [];
    this._abortController = null;
  }

  /**
   * Load an animation sequence for playback
   * @param {Array<Object>} sequenceData - Ordered array of animation step objects
   */
  loadSequence(sequenceData) {
    this._sequence = sequenceData || [];
    this._cursor = 0;
    this._playing = false;
    this._waitingForClick = false;
  }

  /**
   * Prepare initial state: hide elements that have buildIn animations
   * so they become visible only when their animation plays
   */
  prepareInitialState() {
    for (const step of this._sequence) {
      if (step.category !== ANIMATION_CATEGORY.BUILD_IN) continue;

      const el = this._findElement(step.targetElementId);
      if (!el) continue;

      el.style.opacity = '0';
      el.style.visibility = 'hidden';
    }
  }

  /**
   * Play the loaded sequence from the current cursor position.
   * Resolves when all onLoad/afterPrevious/withPrevious steps before
   * the first onClick step have been played.
   * @returns {Promise<void>}
   */
  async play() {
    this._playing = true;
    this._abortController = new AbortController();

    while (this._cursor < this._sequence.length && this._playing) {
      const step = this._sequence[this._cursor];
      const trigger = step.trigger || ANIMATION_TRIGGER.ON_LOAD;

      if (trigger === ANIMATION_TRIGGER.ON_CLICK) {
        this._waitingForClick = true;
        return;
      }

      if (trigger === ANIMATION_TRIGGER.WITH_PREVIOUS) {
        // WITH_PREVIOUS at start of sequence with no preceding step — fire and forget
        this._runStep(step);
        this._cursor++;
        continue;
      }

      // ON_LOAD or AFTER_PREVIOUS: run this step + any chained WITH_PREVIOUS steps together
      await this._runStepWithChained();
    }

    this._playing = false;
  }

  /**
   * Advance past the current onClick step, then continue playing
   * subsequent afterPrevious/withPrevious steps until hitting
   * another onClick or end of sequence.
   * @returns {Promise<void>}
   */
  async next() {
    if (!this._waitingForClick) return;

    this._waitingForClick = false;

    // Play the onClick step + any chained WITH_PREVIOUS steps together
    const step = this._sequence[this._cursor];
    if (step) {
      await this._runStepWithChained();
    }

    // Continue playing subsequent steps
    while (this._cursor < this._sequence.length && this._playing) {
      const nextStep = this._sequence[this._cursor];
      const trigger = nextStep.trigger || ANIMATION_TRIGGER.ON_LOAD;

      if (trigger === ANIMATION_TRIGGER.ON_CLICK) {
        this._waitingForClick = true;
        return;
      }

      if (trigger === ANIMATION_TRIGGER.WITH_PREVIOUS) {
        // WITH_PREVIOUS without preceding step in this loop — fire and forget
        this._runStep(nextStep);
        this._cursor++;
        continue;
      }

      // AFTER_PREVIOUS: run this step + any chained WITH_PREVIOUS steps together
      await this._runStepWithChained();
    }

    this._playing = false;
  }

  /**
   * Skip the currently running animation(s) by finishing them immediately
   */
  skip() {
    for (const anim of this._runningAnimations) {
      try {
        anim.finish();
      } catch (_) {
        // Animation may already be finished
      }
    }
  }

  /**
   * Cancel all running animations and reset state
   */
  cleanup() {
    this._playing = false;
    this._waitingForClick = false;

    for (const anim of this._runningAnimations) {
      try {
        anim.cancel();
      } catch (_) {
        // Already cancelled
      }
    }
    this._runningAnimations = [];

    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  /** Whether the manager is currently playing animations */
  get isPlaying() {
    return this._playing;
  }

  /** Whether there are steps remaining (including pending onClick) */
  get hasPendingSteps() {
    return this._waitingForClick || this._cursor < this._sequence.length;
  }

  // ==================== PRIVATE ====================

  /**
   * Run the step at the current cursor position along with any
   * following WITH_PREVIOUS steps, all in parallel.
   * Advances the cursor past all consumed steps.
   * @returns {Promise<void>}
   * @private
   */
  async _runStepWithChained() {
    const step = this._sequence[this._cursor];
    if (!step) return;

    const promises = [this._runStep(step)];
    this._cursor++;

    // Collect and fire any chained (WITH_PREVIOUS) steps in parallel
    while (this._cursor < this._sequence.length) {
      const nextStep = this._sequence[this._cursor];
      const nextTrigger = nextStep.trigger || ANIMATION_TRIGGER.ON_LOAD;
      if (nextTrigger !== ANIMATION_TRIGGER.WITH_PREVIOUS) break;
      promises.push(this._runStep(nextStep));
      this._cursor++;
    }

    await Promise.all(promises);
  }

  /**
   * Run a single animation step using WAAPI
   * @param {Object} step - Animation step data
   * @returns {Promise<void>}
   * @private
   */
  async _runStep(step) {
    // Special "nextSlide" effect — dispatch event and stop sequence
    if (step.type === 'nextSlide') {
      this._container.dispatchEvent(new CustomEvent('wow3:nextSlide', { bubbles: true }));
      this._playing = false;
      return;
    }

    const el = this._findElement(step.targetElementId);
    if (!el) return;

    const definition = ANIMATION_DEFINITIONS[step.type];
    if (!definition) {
      console.warn(`[AnimationManager] Unknown animation type: ${step.type}`);
      return;
    }

    // Build keyframes with transform conflict resolution
    const keyframes = this._buildKeyframes(el, definition.keyframes, step.type);

    // Resolve easing string
    const easingKey = step.easing || definition.options.easing || 'ease-in-out';
    const easing = EASING_MAP[easingKey] || easingKey;

    // Make element visible before buildIn animation starts
    if (step.category === ANIMATION_CATEGORY.BUILD_IN) {
      el.style.visibility = 'visible';
    }

    const animation = el.animate(keyframes, {
      duration: step.duration || definition.options.duration || 600,
      delay: step.delay || 0,
      easing,
      fill: 'forwards'
    });

    this._runningAnimations.push(animation);

    try {
      await animation.finished;
    } catch (_) {
      // Animation was cancelled
      return;
    }

    // Apply final state manually so we can remove the fill
    this._applyFinalState(el, step, keyframes);

    // Remove fill — inline styles now control the element
    try {
      animation.cancel();
    } catch (_) {
      // Already cancelled
    }

    // Remove from running list
    const idx = this._runningAnimations.indexOf(animation);
    if (idx !== -1) this._runningAnimations.splice(idx, 1);
  }

  /**
   * Build WAAPI keyframes with element rotation injected into transforms
   * @param {HTMLElement} el - Target DOM element
   * @param {Array<Object>} definitionKeyframes - Keyframe objects from definition
   * @param {string} animationType - The animation type key
   * @returns {Array<Object>} Processed keyframes
   * @private
   */
  _buildKeyframes(el, definitionKeyframes, animationType) {
    // Read element's base rotation from inline style
    const baseRotation = this._getElementRotation(el);

    return definitionKeyframes.map((kf) => {
      const frame = { ...kf };

      if (frame.transform !== undefined && baseRotation !== 0) {
        // Special handling for spin: add base rotation to the spin angles
        if (animationType === 'spin') {
          frame.transform = frame.transform.replace(
            /rotate\((\d+)deg\)/,
            (_, deg) => `rotate(${parseFloat(deg) + baseRotation}deg)`
          );
        } else {
          // Append base rotation to preserve element's static rotation
          frame.transform = `${frame.transform} rotate(${baseRotation}deg)`;
        }
      } else if (frame.transform === undefined && baseRotation !== 0) {
        // If this keyframe has no transform but element has rotation,
        // we don't need to inject — WAAPI interpolates from computed style
      }

      return frame;
    });
  }

  /**
   * Apply final visual state after animation completes
   * @param {HTMLElement} el - Target DOM element
   * @param {Object} step - Animation step data
   * @param {Array<Object>} keyframes - The keyframes that were used
   * @private
   */
  _applyFinalState(el, step, keyframes) {
    const lastFrame = keyframes[keyframes.length - 1];

    if (step.category === ANIMATION_CATEGORY.BUILD_IN) {
      el.style.opacity = '1';
      el.style.visibility = 'visible';
    } else if (step.category === ANIMATION_CATEGORY.BUILD_OUT) {
      el.style.opacity = '0';
      el.style.visibility = 'hidden';
    } else {
      // Action animations: restore opacity if defined in last frame
      if (lastFrame.opacity !== undefined) {
        el.style.opacity = String(lastFrame.opacity);
      }
    }

    // Restore the element's original transform (rotation)
    const baseRotation = this._getElementRotation(el);
    el.style.transform = `rotate(${baseRotation}deg)`;
  }

  /**
   * Find a DOM element by its ID within the container
   * @param {string} elementId - Element ID
   * @returns {HTMLElement|null}
   * @private
   */
  _findElement(elementId) {
    if (!elementId) return null;
    return this._container.querySelector('#' + CSS.escape(elementId));
  }

  /**
   * Extract the element's rotation from its inline transform style
   * @param {HTMLElement} el - DOM element
   * @returns {number} Rotation in degrees (0 if none)
   * @private
   */
  _getElementRotation(el) {
    const transform = el.style.transform || '';
    const match = transform.match(/rotate\(([^)]+)\)/);
    if (!match) return 0;
    return parseFloat(match[1]) || 0;
  }
}

export default AnimationManager;
