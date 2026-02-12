/**
 * WOW3 Base Element Class
 * Base class for all slide elements with common functionality
 */

import { generateId } from '../utils/dom.js';
import { DEFAULTS, DEFAULT_SIZE } from '../utils/constants.js';

export class Element {
  /**
   * Create a new element
   * @param {string} type - Element type
   * @param {Object} properties - Element properties
   */
  constructor(type, properties = {}) {
    // Handle case where type is actually the full element data object
    if (typeof type === 'object' && type !== null) {
      properties = type;
      type = properties.type || 'text';
    }

    this.id = properties.id || generateId('element');
    this.type = type;

    // Ensure type is a string for DEFAULT_SIZE lookup
    const typeKey = (typeof type === 'string' ? type : 'text').toUpperCase();

    // Position and size
    this.position = {
      x: properties.position?.x ?? 100,
      y: properties.position?.y ?? 100,
      width: properties.position?.width ?? DEFAULT_SIZE[typeKey]?.width ?? 200,
      height: properties.position?.height ?? DEFAULT_SIZE[typeKey]?.height ?? 100,
      rotation: Math.round(properties.position?.rotation ?? 0)
    };

    // Base properties
    this.properties = {
      font: {
        family: properties.properties?.font?.family || DEFAULTS.FONT_FAMILY,
        size: properties.properties?.font?.size || DEFAULTS.FONT_SIZE,
        color: properties.properties?.font?.color || DEFAULTS.FONT_COLOR,
        style: properties.properties?.font?.style || 'normal',
        weight: properties.properties?.font?.weight || 'normal',
        decoration: properties.properties?.font?.decoration || 'none',
        alignment: properties.properties?.font?.alignment || 'left',
        verticalAlign: properties.properties?.font?.verticalAlign || 'top',
        shadow: {
          enabled: properties.properties?.font?.shadow?.enabled || false,
          color: properties.properties?.font?.shadow?.color || '#000000',
          offsetX: properties.properties?.font?.shadow?.offsetX ?? 2,
          offsetY: properties.properties?.font?.shadow?.offsetY ?? 2,
          blur: properties.properties?.font?.shadow?.blur ?? 4
        },
        stroke: {
          enabled: properties.properties?.font?.stroke?.enabled || false,
          color: properties.properties?.font?.stroke?.color || '#000000',
          width: properties.properties?.font?.stroke?.width ?? 1
        }
      },
      ...properties.properties
    };

    // Animation effects
    this.inEffect = properties.inEffect || null;
    this.outEffect = properties.outEffect || null;

    // Children elements (max 1 level deep)
    this.children = [];
    this.parent = null;

    // Load children if provided
    if (properties.children && properties.children.length > 0) {
      this.children = properties.children.map(childData => {
        const ChildClass = getElementClass(childData.type);
        const child = new ChildClass(childData);
        child.parent = this;
        return child;
      });
    }
  }

  /**
   * Convert element to JSON for storage
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      position: { ...this.position },
      properties: JSON.parse(JSON.stringify(this.properties)),
      inEffect: this.inEffect ? { ...this.inEffect } : null,
      outEffect: this.outEffect ? { ...this.outEffect } : null,
      children: this.children.map(child => child.toJSON())
    };
  }

  /**
   * Create element from JSON data
   * @param {Object} data - JSON data
   * @returns {Element} Element instance
   */
  static fromJSON(data) {
    const ElementClass = getElementClass(data.type);
    return new ElementClass(data);
  }

  /**
   * Add child element
   * @param {Element} element - Element to add as child
   * @returns {boolean} Success status
   */
  addChild(element) {
    // Only one level of nesting allowed
    if (this.children.length === 0 && !this.parent) {
      element.parent = this;
      this.children.push(element);
      return true;
    }
    return false;
  }

  /**
   * Remove child element
   * @param {string} elementId - ID of element to remove
   * @returns {boolean} Success status
   */
  removeChild(elementId) {
    const index = this.children.findIndex(child => child.id === elementId);
    if (index !== -1) {
      this.children[index].parent = null;
      this.children.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get child element by ID
   * @param {string} elementId - Element ID
   * @returns {Element|null} Child element or null
   */
  getChild(elementId) {
    return this.children.find(child => child.id === elementId) || null;
  }

  /**
   * Clone element
   * @returns {Element} Cloned element
   */
  clone() {
    const data = this.toJSON();
    data.id = generateId('element');
    // Also generate new IDs for children
    data.children = data.children.map(child => ({
      ...child,
      id: generateId('element')
    }));
    return Element.fromJSON(data);
  }

  /**
   * Update position
   * @param {Object} updates - Position updates
   */
  updatePosition(updates) {
    // Ensure rotation is always an integer
    if (updates.rotation !== undefined) {
      updates.rotation = Math.round(updates.rotation);
    }
    this.position = { ...this.position, ...updates };
  }

  /**
   * Set animation effect
   * @param {string} type - 'in' or 'out'
   * @param {Object} animation - Animation configuration
   */
  setAnimation(type, animation) {
    if (type === 'in') {
      this.inEffect = animation;
    } else if (type === 'out') {
      this.outEffect = animation;
    }
  }

  /**
   * Remove animation effect
   * @param {string} type - 'in' or 'out'
   */
  removeAnimation(type) {
    if (type === 'in') {
      this.inEffect = null;
    } else if (type === 'out') {
      this.outEffect = null;
    }
  }

  /**
   * Render element to DOM (to be overridden by subclasses)
   * @param {number} zIndex - Z-index for stacking (optional)
   * @returns {HTMLElement} DOM element
   */
  render(zIndex = null) {
    const el = document.createElement('div');
    el.className = 'element';
    el.id = this.id;
    el.dataset.type = this.type;

    this.applyStyles(el, zIndex);

    return el;
  }

  /**
   * Apply styles to DOM element
   * @param {HTMLElement} el - DOM element
   * @param {number} zIndex - Z-index for stacking (optional)
   */
  applyStyles(el, zIndex = null) {
    // Set styles individually to preserve animation-set properties like opacity and visibility
    el.style.left = `${this.position.x}px`;
    el.style.top = `${this.position.y}px`;
    el.style.width = `${this.position.width}px`;
    el.style.height = `${this.position.height}px`;
    el.style.transform = `rotate(${this.position.rotation}deg)`;

    if (zIndex !== null) {
      el.style.zIndex = zIndex;
    }
  }

  /**
   * Update element from DOM
   * @param {HTMLElement} el - DOM element
   */
  updateFromDOM(el) {
    this.position.x = parseFloat(el.style.left) || this.position.x;
    this.position.y = parseFloat(el.style.top) || this.position.y;
    this.position.width = parseFloat(el.style.width) || this.position.width;
    this.position.height = parseFloat(el.style.height) || this.position.height;

    // Extract rotation from transform
    const transform = el.style.transform;
    const rotateMatch = transform.match(/rotate\(([^)]+)\)/);
    if (rotateMatch) {
      this.position.rotation = parseFloat(rotateMatch[1]);
    }
  }
}

/**
 * Registry of element subclasses, populated by each subclass module to avoid circular imports.
 * @type {Object<string, Class>}
 */
Element._classRegistry = {};

/**
 * Register an element subclass for a given type string
 * @param {string} type - Element type key (e.g. 'video')
 * @param {Class} cls - Subclass constructor
 */
Element.registerClass = (type, cls) => {
  Element._classRegistry[type] = cls;
};

/**
 * Get element class by type (looks up registry, falls back to base Element)
 * @param {string} type - Element type
 * @returns {Class} Element class
 */
const getElementClass = (type) => {
  return Element._classRegistry[type] || Element;
};

export default Element;
