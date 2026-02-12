/**
 * WOW3 Text Element
 * Text element with rich formatting options
 */

import { Element } from './Element.js';
import { ElementType } from '../utils/constants.js';

export class TextElement extends Element {
  /**
   * Create a text element
   * @param {Object} properties - Element properties
   */
  constructor(properties = {}) {
    super(ElementType.TEXT, properties);

    // Text-specific properties
    this.properties.text = properties.properties?.text || 'Enter text here';
    this.properties.editable = properties.properties?.editable !== false;
  }

  /**
   * Render text element to DOM
   * @param {number} zIndex - Z-index for stacking (optional)
   * @returns {HTMLElement} DOM element
   */
  render(zIndex = null) {
    const el = super.render(zIndex);
    el.classList.add('text-element');

    // Create text content container
    const textContent = document.createElement('div');
    textContent.className = 'text-content';
    textContent.contentEditable = false;
    textContent.innerText = this.properties.text;

    // Apply text styles
    textContent.style.cssText = `
      font-family: ${this.properties.font.family};
      font-size: ${this.properties.font.size}px;
      color: ${this.properties.font.color};
      font-style: ${this.properties.font.style};
      font-weight: ${this.properties.font.weight};
      text-decoration: ${this.properties.font.decoration};
      text-align: ${this.properties.font.alignment};
      width: 100%;
      height: 100%;
      outline: none;
      overflow: hidden;
    `;

    el.appendChild(textContent);

    return el;
  }

  /**
   * Update text content
   * @param {string} text - New text content
   */
  updateText(text) {
    this.properties.text = text;
  }

  /**
   * Update font property
   * @param {string} property - Font property name
   * @param {*} value - New value
   */
  updateFont(property, value) {
    if (this.properties.font.hasOwnProperty(property)) {
      this.properties.font[property] = value;
    }
  }

  /**
   * Update from DOM element
   * @param {HTMLElement} el - DOM element
   */
  updateFromDOM(el) {
    super.updateFromDOM(el);

    // Update text content
    const textContent = el.querySelector('.text-content');
    if (textContent) {
      this.properties.text = textContent.innerText;
    }
  }
}

Element.registerClass('text', TextElement);

export default TextElement;
