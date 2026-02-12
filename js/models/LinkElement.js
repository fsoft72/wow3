/**
 * WOW3 Link Element
 * Clickable link/button element
 */

import { Element } from './Element.js';
import { ElementType } from '../utils/constants.js';

export class LinkElement extends Element {
  /**
   * Create a link element
   * @param {Object} properties - Element properties
   */
  constructor(properties = {}) {
    super(ElementType.LINK, properties);

    // Link-specific properties
    this.properties.url = properties.properties?.url || '#';
    this.properties.text = properties.properties?.text || 'Click Here';
    this.properties.target = properties.properties?.target || '_blank';
    this.properties.backgroundColor = properties.properties?.backgroundColor || '#2196F3';
    this.properties.textColor = properties.properties?.textColor || '#ffffff';
    this.properties.borderRadius = properties.properties?.borderRadius || 4;
  }

  /**
   * Render link element to DOM
   * @param {number} zIndex - Z-index for stacking (optional)
   * @returns {HTMLElement} DOM element
   */
  render(zIndex = null) {
    const el = super.render(zIndex);
    el.classList.add('link-element');

    const link = document.createElement('a');
    link.href = this.properties.url;
    link.target = this.properties.target;
    link.innerText = this.properties.text;
    link.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      background: ${this.properties.backgroundColor};
      color: ${this.properties.textColor};
      text-decoration: none;
      font-family: ${this.properties.font.family};
      font-size: ${this.properties.font.size}px;
      font-weight: ${this.properties.font.weight};
      border-radius: ${this.properties.borderRadius}px;
      transition: opacity 0.2s;
      cursor: pointer;
    `;

    link.addEventListener('mouseenter', () => {
      link.style.opacity = '0.9';
    });

    link.addEventListener('mouseleave', () => {
      link.style.opacity = '1';
    });

    // Prevent navigation during editing
    link.addEventListener('click', (e) => {
      if (el.classList.contains('selected')) {
        e.preventDefault();
      }
    });

    el.appendChild(link);

    return el;
  }

  /**
   * Set link URL
   * @param {string} url - Link URL
   */
  setUrl(url) {
    this.properties.url = url;
  }

  /**
   * Set link text
   * @param {string} text - Link text
   */
  setText(text) {
    this.properties.text = text;
  }

  /**
   * Set background color
   * @param {string} color - Background color
   */
  setBackgroundColor(color) {
    this.properties.backgroundColor = color;
  }

  /**
   * Set text color
   * @param {string} color - Text color
   */
  setTextColor(color) {
    this.properties.textColor = color;
  }
}

Element.registerClass('link', LinkElement);

export default LinkElement;
