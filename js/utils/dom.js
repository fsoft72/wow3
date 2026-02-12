/**
 * WOW3 DOM Utility Functions
 * Helper functions for DOM manipulation and element creation
 */

/**
 * Generate unique ID with optional prefix
 * @param {string} prefix - Prefix for the ID
 * @returns {string} Unique ID
 */
export const generateId = (prefix = 'id') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create element with attributes and children
 * @param {string} tag - HTML tag name
 * @param {Object} attributes - Element attributes
 * @param {Array} children - Child elements or text
 * @returns {HTMLElement} Created element
 */
export const createElement = (tag, attributes = {}, children = []) => {
  const element = document.createElement(tag);

  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else if (key.startsWith('on') && typeof value === 'function') {
      const event = key.substring(2).toLowerCase();
      element.addEventListener(event, value);
    } else {
      element.setAttribute(key, value);
    }
  });

  children.forEach(child => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof HTMLElement) {
      element.appendChild(child);
    }
  });

  return element;
};

/**
 * Get element position relative to parent
 * @param {HTMLElement} element - Element to get position for
 * @param {HTMLElement} parent - Parent element
 * @returns {Object} Position object with x and y
 */
export const getRelativePosition = (element, parent) => {
  const elementRect = element.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();

  return {
    x: elementRect.left - parentRect.left,
    y: elementRect.top - parentRect.top
  };
};

/**
 * Check if point is inside element
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} True if point is inside element
 */
export const isPointInElement = (x, y, element) => {
  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
};

/**
 * Get mouse position relative to element
 * @param {MouseEvent} event - Mouse event
 * @param {HTMLElement} element - Element to get position relative to
 * @returns {Object} Position object with x and y
 */
export const getMousePosition = (event, element) => {
  const rect = element.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
};

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (obj instanceof Object) {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
};

/**
 * Convert hex color to RGBA
 * @param {string} hex - Hex color code
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA color string
 */
export const hexToRGBA = (hex, alpha = 1) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Clamp number between min and max
 * @param {number} num - Number to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export const clamp = (num, min, max) => {
  return Math.min(Math.max(num, min), max);
};

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
export const degToRad = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Convert radians to degrees
 * @param {number} radians - Angle in radians
 * @returns {number} Angle in degrees
 */
export const radToDeg = (radians) => {
  return radians * (180 / Math.PI);
};

/**
 * Format file size to human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Sanitize HTML string
 * @param {string} html - HTML string to sanitize
 * @returns {string} Sanitized HTML
 */
export const sanitizeHTML = (html) => {
  const temp = document.createElement('div');
  temp.textContent = html;
  return temp.innerHTML;
};

/**
 * Load image from URL
 * @param {string} url - Image URL
 * @returns {Promise<HTMLImageElement>} Promise that resolves with loaded image
 */
export const loadImage = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

/**
 * Download file with given content
 * @param {string} content - File content
 * @param {string} filename - File name
 * @param {string} mimeType - MIME type
 */
export const downloadFile = (content, filename, mimeType = 'text/plain') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Read file as text
 * @param {File} file - File to read
 * @returns {Promise<string>} Promise that resolves with file content
 */
export const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

/**
 * Read file as data URL
 * @param {File} file - File to read
 * @returns {Promise<string>} Promise that resolves with data URL
 */
export const readFileAsDataURL = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Get element dimensions including rotation
 * @param {HTMLElement} element - Element to measure
 * @returns {Object} Dimensions object with width and height
 */
export const getRotatedDimensions = (element) => {
  const rect = element.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height
  };
};

/**
 * Check if two rectangles intersect
 * @param {Object} rect1 - First rectangle
 * @param {Object} rect2 - Second rectangle
 * @returns {boolean} True if rectangles intersect
 */
export const rectsIntersect = (rect1, rect2) => {
  return !(
    rect2.x > rect1.x + rect1.width ||
    rect2.x + rect2.width < rect1.x ||
    rect2.y > rect1.y + rect1.height ||
    rect2.y + rect2.height < rect1.y
  );
};
