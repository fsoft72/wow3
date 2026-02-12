/**
 * WOW3 Shape Element
 * Geometric shapes (rectangle, circle, triangle, etc.)
 */

import { Element } from './Element.js';
import { ElementType, DEFAULTS } from '../utils/constants.js';

export class ShapeElement extends Element {
  /**
   * Create a shape element
   * @param {Object} properties - Element properties
   */
  constructor(properties = {}) {
    super(ElementType.SHAPE, properties);

    // Shape-specific properties
    this.properties.shapeType = properties.properties?.shapeType || 'rectangle';
    this.properties.fillColor = properties.properties?.fillColor || DEFAULTS.SHAPE_FILL_COLOR;
    this.properties.strokeColor = properties.properties?.strokeColor || DEFAULTS.SHAPE_STROKE_COLOR;
    this.properties.strokeWidth = properties.properties?.strokeWidth || DEFAULTS.SHAPE_STROKE_WIDTH;
  }

  /**
   * Render shape element to DOM
   * @param {number} zIndex - Z-index for stacking (optional)
   * @returns {HTMLElement} DOM element
   */
  render(zIndex = null) {
    const el = super.render(zIndex);
    el.classList.add('shape-element');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');

    let shape;

    switch (this.properties.shapeType) {
      case 'circle':
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        shape.setAttribute('cx', '50');
        shape.setAttribute('cy', '50');
        shape.setAttribute('r', '45');
        break;

      case 'triangle':
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        shape.setAttribute('points', '50,10 90,90 10,90');
        break;

      case 'line':
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        shape.setAttribute('x1', '0');
        shape.setAttribute('y1', '50');
        shape.setAttribute('x2', '100');
        shape.setAttribute('y2', '50');
        break;

      case 'rectangle':
      default:
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        shape.setAttribute('width', '100');
        shape.setAttribute('height', '100');
        break;
    }

    // Apply styles — lines have no fill area, so use fillColor as stroke
    if (this.properties.shapeType === 'line') {
      shape.setAttribute('fill', 'none');
      shape.setAttribute('stroke', this.properties.fillColor);
      shape.setAttribute('stroke-width', Math.max(this.properties.strokeWidth, 2));
      shape.setAttribute('vector-effect', 'non-scaling-stroke');
    } else {
      shape.setAttribute('fill', this.properties.fillColor);
      shape.setAttribute('stroke', this.properties.strokeColor);
      shape.setAttribute('stroke-width', this.properties.strokeWidth);
    }

    svg.appendChild(shape);
    el.appendChild(svg);

    return el;
  }

  /**
   * Set shape type
   * @param {string} type - Shape type
   */
  setShapeType(type) {
    this.properties.shapeType = type;
  }

  /**
   * Set fill color
   * @param {string} color - Fill color
   */
  setFillColor(color) {
    this.properties.fillColor = color;
  }

  /**
   * Set stroke color
   * @param {string} color - Stroke color
   */
  setStrokeColor(color) {
    this.properties.strokeColor = color;
  }

  /**
   * Set stroke width
   * @param {number} width - Stroke width
   */
  setStrokeWidth(width) {
    this.properties.strokeWidth = width;
  }
}

Element.registerClass('shape', ShapeElement);

export default ShapeElement;
