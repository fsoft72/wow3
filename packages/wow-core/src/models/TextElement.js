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

    // Background image fill (CSS background-clip: text)
    this.properties.backgroundImage = {
      url: properties.properties?.backgroundImage?.url || '',
      direction: properties.properties?.backgroundImage?.direction || 'none',
      speed: properties.properties?.backgroundImage?.speed ?? 0
    };
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

    // Map verticalAlign to CSS grid align-content
    const vAlignMap = { top: 'start', middle: 'center', bottom: 'end' };
    const vAlign = vAlignMap[this.properties.font.verticalAlign] || 'start';

    // Build optional text-shadow
    const sh = this.properties.font.shadow;
    const shadowCSS = sh?.enabled
      ? `text-shadow: ${sh.offsetX}px ${sh.offsetY}px ${sh.blur}px ${sh.color};`
      : '';

    // Build optional text-stroke
    const st = this.properties.font.stroke;
    const strokeCSS = st?.enabled
      ? `-webkit-text-stroke: ${st.width}px ${st.color}; paint-order: stroke fill;`
      : '';

    // Background image fill (background-clip: text)
    const bgImg = this.properties.backgroundImage;
    const hasBgImage = bgImg && bgImg.url;

    // Detect gradient vs solid color
    const fontColor = this.properties.font.color;
    const isGradient = fontColor && fontColor.includes('gradient(');
    const fontColorSpeed = this.properties.font.colorAnimationSpeed ?? 0;
    const fontColorAnimType = this.properties.font.colorAnimationType || 'pingpong';

    let colorCSS;
    if (hasBgImage) {
      // Image fill — build animation CSS if direction is set
      const DIRECTION_KEYFRAMES = {
        'up': 'wow3BgMoveUp',
        'down': 'wow3BgMoveDown',
        'left': 'wow3BgMoveLeft',
        'right': 'wow3BgMoveRight',
        'up-left': 'wow3BgMoveUpLeft',
        'up-right': 'wow3BgMoveUpRight',
        'down-left': 'wow3BgMoveDownLeft',
        'down-right': 'wow3BgMoveDownRight'
      };
      const dir = bgImg.direction || 'none';
      const speed = bgImg.speed ?? 0;
      const kfName = DIRECTION_KEYFRAMES[dir];
      const animCSS = kfName && speed > 0
        ? `animation: ${kfName} ${22 - speed * 2}s ease alternate infinite;`
        : '';

      colorCSS = `background-size: 200% 200%; background-position: center; background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; ${animCSS}`;
    } else {
      const gradientAnimCSS = isGradient && fontColorSpeed > 0
        ? (() => {
            const kf = fontColorAnimType === 'cycle' ? 'wow3GradientCycleForward' : 'wow3GradientCycle';
            const ea = fontColorAnimType === 'cycle' ? 'linear' : 'ease';
            return ` background-size: 200% 200%; animation: ${kf} ${11 - fontColorSpeed}s ${ea} infinite;`;
          })()
        : '';
      colorCSS = isGradient
        ? `background: ${fontColor}; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;${gradientAnimCSS}`
        : `color: ${fontColor};`;
    }

    // Apply text styles — use CSS Grid so text-align still works
    textContent.style.cssText = `
      font-family: ${this.properties.font.family};
      font-size: ${this.properties.font.size}px;
      ${colorCSS}
      font-style: ${this.properties.font.style};
      font-weight: ${this.properties.font.weight};
      text-decoration: ${this.properties.font.decoration};
      text-align: ${this.properties.font.alignment};
      width: 100%;
      height: 100%;
      outline: none;
      overflow: hidden;
      display: grid;
      align-content: ${vAlign};
      ${shadowCSS}
      ${strokeCSS}
    `;

    // Load background image asynchronously if set
    if (hasBgImage) {
      const url = bgImg.url;
      if (url.startsWith('media_') && window.MediaDB) {
        window.MediaDB.getMediaDataURL(url).then((dataURL) => {
          if (dataURL) textContent.style.backgroundImage = `url(${dataURL})`;
        });
      } else {
        textContent.style.backgroundImage = `url(${url})`;
      }
    }

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
