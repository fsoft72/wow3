/**
 * WOW3 Positioning Utilities
 * Helper functions for element positioning, alignment, and transformations
 */

import { UI, CANVAS } from './constants.js';
import { clamp } from './dom.js';

/**
 * Constrain position within canvas bounds
 * @param {Object} position - Position object with x, y, width, height
 * @returns {Object} Constrained position
 */
export const constrainToCanvas = (position) => {
  return {
    x: clamp(position.x, 0, CANVAS.WIDTH - position.width),
    y: clamp(position.y, 0, CANVAS.HEIGHT - position.height),
    width: position.width,
    height: position.height,
    rotation: position.rotation
  };
};

/**
 * Snap position to grid
 * @param {number} value - Position value
 * @param {number} gridSize - Grid size
 * @returns {number} Snapped value
 */
export const snapToGrid = (value, gridSize = UI.GRID_SIZE) => {
  if (!UI.SNAP_TO_GRID) return value;
  return Math.round(value / gridSize) * gridSize;
};

/**
 * Check if two positions are aligned within threshold
 * @param {number} pos1 - First position
 * @param {number} pos2 - Second position
 * @param {number} threshold - Alignment threshold
 * @returns {boolean} True if aligned
 */
export const isAligned = (pos1, pos2, threshold = UI.ALIGNMENT_THRESHOLD) => {
  return Math.abs(pos1 - pos2) < threshold;
};

/**
 * Get alignment points for an element
 * @param {Object} position - Element position
 * @returns {Object} Alignment points (left, right, top, bottom, centerX, centerY)
 */
export const getAlignmentPoints = (position) => {
  return {
    left: position.x,
    right: position.x + position.width,
    top: position.y,
    bottom: position.y + position.height,
    centerX: position.x + position.width / 2,
    centerY: position.y + position.height / 2
  };
};

/**
 * Find alignment guides for dragging element
 * @param {Object} draggedPosition - Position of dragged element
 * @param {Array} otherElements - Array of other element positions
 * @returns {Object} Alignment guides {horizontal: [], vertical: []}
 */
export const findAlignmentGuides = (draggedPosition, otherElements) => {
  const guides = {
    horizontal: [],
    vertical: []
  };

  const draggedPoints = getAlignmentPoints(draggedPosition);

  otherElements.forEach(otherPos => {
    const otherPoints = getAlignmentPoints(otherPos);

    // Check vertical alignments (left, right, center)
    if (isAligned(draggedPoints.left, otherPoints.left)) {
      guides.vertical.push({ position: otherPoints.left, type: 'left' });
    }
    if (isAligned(draggedPoints.right, otherPoints.right)) {
      guides.vertical.push({ position: otherPoints.right, type: 'right' });
    }
    if (isAligned(draggedPoints.centerX, otherPoints.centerX)) {
      guides.vertical.push({ position: otherPoints.centerX, type: 'center' });
    }

    // Check horizontal alignments (top, bottom, middle)
    if (isAligned(draggedPoints.top, otherPoints.top)) {
      guides.horizontal.push({ position: otherPoints.top, type: 'top' });
    }
    if (isAligned(draggedPoints.bottom, otherPoints.bottom)) {
      guides.horizontal.push({ position: otherPoints.bottom, type: 'bottom' });
    }
    if (isAligned(draggedPoints.centerY, otherPoints.centerY)) {
      guides.horizontal.push({ position: otherPoints.centerY, type: 'middle' });
    }
  });

  // Remove duplicates
  guides.horizontal = removeDuplicateGuides(guides.horizontal);
  guides.vertical = removeDuplicateGuides(guides.vertical);

  return guides;
};

/**
 * Remove duplicate guides
 * @param {Array} guides - Array of guides
 * @returns {Array} Unique guides
 */
const removeDuplicateGuides = (guides) => {
  const seen = new Set();
  return guides.filter(guide => {
    const key = `${guide.position}-${guide.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Calculate new position after rotation
 * @param {Object} position - Original position
 * @param {number} rotation - Rotation angle in degrees
 * @param {Object} origin - Rotation origin point
 * @returns {Object} New position
 */
export const rotatePosition = (position, rotation, origin) => {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const dx = position.x - origin.x;
  const dy = position.y - origin.y;

  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
    width: position.width,
    height: position.height,
    rotation
  };
};

/**
 * Calculate bounding box after rotation
 * @param {Object} position - Element position with rotation
 * @returns {Object} Bounding box {x, y, width, height}
 */
export const getRotatedBounds = (position) => {
  const { x, y, width, height, rotation = 0 } = position;

  if (rotation === 0) {
    return { x, y, width, height };
  }

  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));

  const newWidth = width * cos + height * sin;
  const newHeight = width * sin + height * cos;

  return {
    x: x - (newWidth - width) / 2,
    y: y - (newHeight - height) / 2,
    width: newWidth,
    height: newHeight
  };
};

/**
 * Maintain aspect ratio during resize
 * @param {Object} currentSize - Current size {width, height}
 * @param {Object} delta - Change in size {dw, dh}
 * @param {number} aspectRatio - Aspect ratio to maintain
 * @param {string} direction - Resize direction
 * @returns {Object} New size {width, height}
 */
export const maintainAspectRatio = (currentSize, delta, aspectRatio, direction) => {
  let newWidth = currentSize.width;
  let newHeight = currentSize.height;

  switch (direction) {
    case 'se':
    case 'ne':
    case 'sw':
    case 'nw':
    case 'e':
    case 'w':
      // Use width as primary
      newWidth += delta.dw;
      newHeight = newWidth / aspectRatio;
      break;
    case 'n':
    case 's':
      // Use height as primary
      newHeight += delta.dh;
      newWidth = newHeight * aspectRatio;
      break;
  }

  return {
    width: Math.max(UI.MIN_ELEMENT_SIZE, newWidth),
    height: Math.max(UI.MIN_ELEMENT_SIZE, newHeight)
  };
};

/**
 * Distribute elements evenly
 * @param {Array} elements - Array of element positions
 * @param {string} axis - 'horizontal' or 'vertical'
 * @returns {Array} New positions for elements
 */
export const distributeElements = (elements, axis = 'horizontal') => {
  if (elements.length < 3) return elements;

  const sorted = [...elements].sort((a, b) => {
    return axis === 'horizontal' ? a.x - b.x : a.y - b.y;
  });

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const totalSpace = axis === 'horizontal'
    ? (last.x + last.width) - first.x
    : (last.y + last.height) - first.y;

  const totalElementSize = sorted.reduce((sum, el) => {
    return sum + (axis === 'horizontal' ? el.width : el.height);
  }, 0);

  const spacing = (totalSpace - totalElementSize) / (sorted.length - 1);

  let currentPos = axis === 'horizontal' ? first.x : first.y;

  return sorted.map((el, i) => {
    if (i === 0) {
      return el;
    }

    const prevEl = sorted[i - 1];
    const prevSize = axis === 'horizontal' ? prevEl.width : prevEl.height;
    currentPos += prevSize + spacing;

    return {
      ...el,
      [axis === 'horizontal' ? 'x' : 'y']: currentPos
    };
  });
};

/**
 * Align elements to a common edge
 * @param {Array} elements - Array of element positions
 * @param {string} alignment - 'left', 'right', 'top', 'bottom', 'center-horizontal', 'center-vertical'
 * @returns {Array} New positions for elements
 */
export const alignElements = (elements, alignment) => {
  if (elements.length < 2) return elements;

  let targetPosition;

  switch (alignment) {
    case 'left':
      targetPosition = Math.min(...elements.map(el => el.x));
      return elements.map(el => ({ ...el, x: targetPosition }));

    case 'right':
      targetPosition = Math.max(...elements.map(el => el.x + el.width));
      return elements.map(el => ({ ...el, x: targetPosition - el.width }));

    case 'top':
      targetPosition = Math.min(...elements.map(el => el.y));
      return elements.map(el => ({ ...el, y: targetPosition }));

    case 'bottom':
      targetPosition = Math.max(...elements.map(el => el.y + el.height));
      return elements.map(el => ({ ...el, y: targetPosition - el.height }));

    case 'center-horizontal':
      const minX = Math.min(...elements.map(el => el.x));
      const maxX = Math.max(...elements.map(el => el.x + el.width));
      const centerX = (minX + maxX) / 2;
      return elements.map(el => ({ ...el, x: centerX - el.width / 2 }));

    case 'center-vertical':
      const minY = Math.min(...elements.map(el => el.y));
      const maxY = Math.max(...elements.map(el => el.y + el.height));
      const centerY = (minY + maxY) / 2;
      return elements.map(el => ({ ...el, y: centerY - el.height / 2 }));

    default:
      return elements;
  }
};

/**
 * Center element on canvas
 * @param {Object} elementSize - Element size {width, height}
 * @returns {Object} Centered position {x, y}
 */
export const centerOnCanvas = (elementSize) => {
  return {
    x: (CANVAS.WIDTH - elementSize.width) / 2,
    y: (CANVAS.HEIGHT - elementSize.height) / 2
  };
};
