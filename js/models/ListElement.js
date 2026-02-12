/**
 * WOW3 List Element
 * Ordered and unordered lists
 */

import { Element } from './Element.js';
import { ElementType } from '../utils/constants.js';

export class ListElement extends Element {
  /**
   * Create a list element
   * @param {Object} properties - Element properties
   */
  constructor(properties = {}) {
    super(ElementType.LIST, properties);

    // List-specific properties
    this.properties.listType = properties.properties?.listType || 'unordered'; // 'ordered' or 'unordered'
    this.properties.items = properties.properties?.items || ['Item 1', 'Item 2', 'Item 3'];
    this.properties.editable = properties.properties?.editable !== false;
  }

  /**
   * Render list element to DOM
   * @param {number} zIndex - Z-index for stacking (optional)
   * @returns {HTMLElement} DOM element
   */
  render(zIndex = null) {
    const el = super.render(zIndex);
    el.classList.add('list-element');

    // Create list container
    const listTag = this.properties.listType === 'ordered' ? 'ol' : 'ul';
    const list = document.createElement(listTag);
    list.style.cssText = `
      font-family: ${this.properties.font.family};
      font-size: ${this.properties.font.size}px;
      color: ${this.properties.font.color};
      font-style: ${this.properties.font.style};
      font-weight: ${this.properties.font.weight};
      margin: 0;
      padding-left: 20px;
      width: 100%;
      height: 100%;
      overflow: auto;
    `;

    // Add list items
    this.properties.items.forEach((itemText, index) => {
      const li = document.createElement('li');
      li.contentEditable = this.properties.editable;
      li.innerText = itemText;
      li.style.margin = '4px 0';
      li.dataset.index = index;

      // Update items array when edited
      if (this.properties.editable) {
        li.addEventListener('blur', (e) => {
          this.properties.items[index] = e.target.innerText;
        });
      }

      list.appendChild(li);
    });

    el.appendChild(list);

    return el;
  }

  /**
   * Set list type
   * @param {string} type - 'ordered' or 'unordered'
   */
  setListType(type) {
    this.properties.listType = type;
  }

  /**
   * Add list item
   * @param {string} text - Item text
   */
  addItem(text) {
    this.properties.items.push(text);
  }

  /**
   * Remove list item
   * @param {number} index - Item index
   */
  removeItem(index) {
    if (index >= 0 && index < this.properties.items.length) {
      this.properties.items.splice(index, 1);
    }
  }

  /**
   * Update list item
   * @param {number} index - Item index
   * @param {string} text - New text
   */
  updateItem(index, text) {
    if (index >= 0 && index < this.properties.items.length) {
      this.properties.items[index] = text;
    }
  }

  /**
   * Update from DOM element
   * @param {HTMLElement} el - DOM element
   */
  updateFromDOM(el) {
    super.updateFromDOM(el);

    // Update items from DOM
    const listItems = el.querySelectorAll('li');
    this.properties.items = Array.from(listItems).map(li => li.innerText);
  }
}

export default ListElement;
