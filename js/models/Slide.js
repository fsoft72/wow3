/**
 * WOW3 Slide Model
 * Represents a single slide with elements
 */

import { generateId } from '../utils/dom.js';
import { DEFAULTS } from '../utils/constants.js';
import { Element } from './Element.js';
import { TextElement } from './TextElement.js';
import { ImageElement } from './ImageElement.js';
import { VideoElement } from './VideoElement.js';
import { AudioElement } from './AudioElement.js';
import { ShapeElement } from './ShapeElement.js';
import { ListElement } from './ListElement.js';
import { LinkElement } from './LinkElement.js';

export class Slide {
  /**
   * Create a new slide
   * @param {Object} properties - Slide properties
   */
  constructor(properties = {}) {
    this.id = properties.id || generateId('slide');
    this.title = properties.title || 'Untitled Slide';
    this.background = properties.background || DEFAULTS.BACKGROUND_COLOR;
    this.visible = properties.visible !== false; // default true
    this.hideShell = properties.hideShell || false;
    this.elements = [];

    // Load elements if provided
    if (properties.elements && properties.elements.length > 0) {
      this.elements = properties.elements.map(elData => {
        const ElementClass = getElementClass(elData.type);
        return new ElementClass(elData);
      });
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
      return true;
    }

    // Check if it's a child element
    for (const element of this.elements) {
      if (element.removeChild(elementId)) {
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

  /**
   * Set slide background
   * @param {string} background - Background color or gradient
   */
  setBackground(background) {
    this.background = background;
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
    // Generate new IDs for all elements
    data.elements = data.elements.map(elData => ({
      ...elData,
      id: generateId('element'),
      children: elData.children.map(childData => ({
        ...childData,
        id: generateId('element')
      }))
    }));
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
      visible: this.visible,
      hideShell: this.hideShell,
      elements: this.elements.map(el => el.toJSON())
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
    link: LinkElement
  };

  return classes[type] || Element;
};

export default Slide;
