/**
 * WOW3 Empty Element
 * A fixed-size 64x64 semi-transparent box used for synchronization purposes.
 * Cannot be resized — only moved and rotated.
 */

import { Element } from './Element.js';
import { ElementType } from '../utils/constants.js';

export class EmptyElement extends Element {
  /**
   * Create an empty element
   * @param {Object} properties - Element properties
   */
  constructor(properties = {}) {
    super(ElementType.EMPTY, properties);

    // Force fixed size — always 64x64
    this.position.width = 64;
    this.position.height = 64;
  }

  /**
   * Render empty element to DOM
   * @param {number} zIndex - Z-index for stacking (optional)
   * @returns {HTMLElement} DOM element
   */
  render(zIndex = null) {
    const el = super.render(zIndex);
    el.classList.add('empty-element');

    // Inner dashed box indicator
    const inner = document.createElement('div');
    inner.className = 'empty-element-inner';
    inner.innerHTML = '<i class="material-icons" style="font-size:20px;color:rgba(0,0,0,0.3);">sync</i>';
    el.appendChild(inner);

    return el;
  }
}

Element.registerClass('empty', EmptyElement);

export default EmptyElement;
