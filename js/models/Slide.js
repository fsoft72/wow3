/**
 * WOW3 Slide Model
 * Represents a single slide with elements
 */

import { generateId } from '../utils/dom.js';
import { DEFAULTS } from '../utils/constants.js';
import { Element } from './Element.js';
import { migrateElementAnimations, hasLegacyAnimations } from '../animations/migration.js';
import { TextElement } from './TextElement.js';
import { ImageElement } from './ImageElement.js';
import { VideoElement } from './VideoElement.js';
import { AudioElement } from './AudioElement.js';
import { ShapeElement } from './ShapeElement.js';
import { ListElement } from './ListElement.js';
import { LinkElement } from './LinkElement.js';
import { CountdownTimerElement } from './CountdownTimerElement.js';

export class Slide {
  /**
   * Create a new slide
   * @param {Object} properties - Slide properties
   */
  constructor(properties = {}) {
    this.id = properties.id || generateId('slide');
    this.title = properties.title || 'Untitled Slide';
    this.background = properties.background || DEFAULTS.BACKGROUND_COLOR;
    this.backgroundAnimationSpeed = properties.backgroundAnimationSpeed ?? 0;
    this.visible = properties.visible !== false; // default true
    this.thumbnailId = properties.thumbnailId || null;

    // Shell assignment — references a shell by ID, or null for "no shell"
    // Backward compat: if old hideShell === true, force shellId to null
    if (properties.hideShell === true) {
      this.shellId = null;
    } else {
      this.shellId = properties.shellId !== undefined ? properties.shellId : null;
    }

    // Per-slide shell rendering mode ('above' | 'below')
    this.shellMode = properties.shellMode || 'above';
    this.elements = [];

    // Load elements if provided
    if (properties.elements && properties.elements.length > 0) {
      this.elements = properties.elements.map(elData => {
        const ElementClass = getElementClass(elData.type);
        return new ElementClass(elData);
      });
    }

    // Animation sequence (new system)
    this.animationSequence = properties.animationSequence || [];

    // Auto-migrate legacy inEffect/outEffect if no sequence exists
    if (this.animationSequence.length === 0 && hasLegacyAnimations(this)) {
      this.animationSequence = migrateElementAnimations(this);
    }
  }

  /**
   * Add element to slide
   * @param {Element} element - Element to add
   */
  addElement(element) {
    this.elements.push(element);
  }

  /**
   * Remove element from slide
   * @param {string} elementId - Element ID
   * @returns {boolean} Success status
   */
  removeElement(elementId) {
    const index = this.elements.findIndex(el => el.id === elementId);
    if (index !== -1) {
      this.elements.splice(index, 1);
      this.removeAnimationsForElement(elementId);
      return true;
    }

    // Check if it's a child element
    for (const element of this.elements) {
      if (element.removeChild(elementId)) {
        this.removeAnimationsForElement(elementId);
        return true;
      }
    }

    return false;
  }

  /**
   * Get element by ID
   * @param {string} elementId - Element ID
   * @returns {Element|null} Element or null
   */
  getElement(elementId) {
    // Check top-level elements
    const element = this.elements.find(el => el.id === elementId);
    if (element) return element;

    // Check child elements
    for (const parentElement of this.elements) {
      const child = parentElement.getChild(elementId);
      if (child) return child;
    }

    return null;
  }

  /**
   * Get all elements (including children) as flat array
   * @returns {Array} Flat array of all elements
   */
  getAllElements() {
    const allElements = [];

    this.elements.forEach(element => {
      allElements.push(element);
      element.children.forEach(child => {
        allElements.push(child);
      });
    });

    return allElements;
  }

  /**
   * Move element to different position in z-index
   * @param {string} elementId - Element ID
   * @param {number} newIndex - New index
   * @returns {boolean} Success status
   */
  reorderElement(elementId, newIndex) {
    const index = this.elements.findIndex(el => el.id === elementId);
    if (index !== -1 && newIndex >= 0 && newIndex < this.elements.length) {
      const [element] = this.elements.splice(index, 1);
      this.elements.splice(newIndex, 0, element);
      return true;
    }
    return false;
  }

  /**
   * Bring element to front
   * @param {string} elementId - Element ID
   * @returns {boolean} Success status
   */
  bringToFront(elementId) {
    const index = this.elements.findIndex(el => el.id === elementId);
    if (index !== -1) {
      const [element] = this.elements.splice(index, 1);
      this.elements.push(element);
      return true;
    }
    return false;
  }

  /**
   * Send element to back
   * @param {string} elementId - Element ID
   * @returns {boolean} Success status
   */
  sendToBack(elementId) {
    const index = this.elements.findIndex(el => el.id === elementId);
    if (index !== -1) {
      const [element] = this.elements.splice(index, 1);
      this.elements.unshift(element);
      return true;
    }
    return false;
  }

  // ==================== ANIMATION SEQUENCE CRUD ====================

  /**
   * Add an animation step to the sequence
   * @param {Object} anim - Animation step object (must have an id)
   * @param {number} [index] - Optional insertion index; appends if omitted
   */
  addAnimation(anim, index) {
    if (index !== undefined && index >= 0 && index <= this.animationSequence.length) {
      this.animationSequence.splice(index, 0, anim);
    } else {
      this.animationSequence.push(anim);
    }
  }

  /**
   * Remove an animation step by its ID
   * @param {string} animId - Animation step ID
   * @returns {boolean} True if removed
   */
  removeAnimation(animId) {
    const idx = this.animationSequence.findIndex((a) => a.id === animId);
    if (idx === -1) return false;
    this.animationSequence.splice(idx, 1);
    return true;
  }

  /**
   * Update properties of an animation step
   * @param {string} animId - Animation step ID
   * @param {Object} updates - Properties to merge
   * @returns {boolean} True if found and updated
   */
  updateAnimation(animId, updates) {
    const anim = this.animationSequence.find((a) => a.id === animId);
    if (!anim) return false;
    Object.assign(anim, updates);
    return true;
  }

  /**
   * Reorder an animation step within the sequence
   * @param {number} fromIndex - Current index
   * @param {number} toIndex - Desired index
   * @returns {boolean} True if reordered
   */
  reorderAnimation(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.animationSequence.length) return false;
    if (toIndex < 0 || toIndex >= this.animationSequence.length) return false;
    const [item] = this.animationSequence.splice(fromIndex, 1);
    this.animationSequence.splice(toIndex, 0, item);
    return true;
  }

  /**
   * Get all animations targeting a specific element
   * @param {string} elementId - Element ID
   * @returns {Array<Object>} Animation steps for that element
   */
  getAnimationsForElement(elementId) {
    return this.animationSequence.filter((a) => a.targetElementId === elementId);
  }

  /**
   * Remove all animations targeting a specific element
   * @param {string} elementId - Element ID
   */
  removeAnimationsForElement(elementId) {
    this.animationSequence = this.animationSequence.filter((a) => a.targetElementId !== elementId);
  }

  /**
   * Set slide background
   * @param {string} background - Background color or gradient
   * @param {number} [animationSpeed] - Optional gradient animation speed (0-10)
   */
  setBackground(background, animationSpeed) {
    this.background = background;
    if ( animationSpeed !== undefined ) this.backgroundAnimationSpeed = animationSpeed;
  }

  /**
   * Set slide title
   * @param {string} title - Slide title
   */
  setTitle(title) {
    this.title = title;
  }

  /**
   * Clone slide
   * @returns {Slide} Cloned slide
   */
  clone() {
    const data = this.toJSON();
    data.id = generateId('slide');
    data.thumbnailId = null; // Cloned slides should not reference the original's thumbnail

    // Build old→new ID map while generating new IDs for elements
    const idMap = {};
    data.elements = data.elements.map(elData => {
      const newId = generateId('element');
      idMap[elData.id] = newId;
      return {
        ...elData,
        id: newId,
        children: elData.children.map(childData => {
          const newChildId = generateId('element');
          idMap[childData.id] = newChildId;
          return { ...childData, id: newChildId };
        })
      };
    });

    // Remap animation sequence references and generate new anim IDs
    if (data.animationSequence) {
      data.animationSequence = data.animationSequence.map((anim) => ({
        ...anim,
        id: generateId('anim'),
        targetElementId: idMap[anim.targetElementId] || anim.targetElementId
      }));
    }

    return Slide.fromJSON(data);
  }

  /**
   * Convert slide to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      background: this.background,
      backgroundAnimationSpeed: this.backgroundAnimationSpeed,
      visible: this.visible,
      shellId: this.shellId,
      shellMode: this.shellMode,
      thumbnailId: this.thumbnailId,
      elements: this.elements.map(el => el.toJSON()),
      animationSequence: this.animationSequence.map((a) => ({ ...a }))
    };
  }

  /**
   * Create slide from JSON
   * @param {Object} data - JSON data
   * @returns {Slide} Slide instance
   */
  static fromJSON(data) {
    return new Slide(data);
  }
}

/**
 * Get element class by type
 * @param {string} type - Element type
 * @returns {Class} Element class
 */
const getElementClass = (type) => {
  const classes = {
    text: TextElement,
    image: ImageElement,
    video: VideoElement,
    audio: AudioElement,
    shape: ShapeElement,
    list: ListElement,
    link: LinkElement,
    countdown_timer: CountdownTimerElement
  };

  return classes[type] || Element;
};

export default Slide;
