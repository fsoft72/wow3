/**
 * WOW3 Event Handling Utilities
 * Event emitter and handler utilities for application-wide events
 */

/**
 * Simple Event Emitter class for application-wide events
 */
export class EventEmitter {
  constructor() {
    this.events = {};
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }

    this.events[event].push(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Subscribe to an event (once)
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  once(event, callback) {
    const onceCallback = (...args) => {
      callback(...args);
      this.off(event, onceCallback);
    };

    return this.on(event, onceCallback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   */
  off(event, callback) {
    if (!this.events[event]) return;

    this.events[event] = this.events[event].filter(cb => cb !== callback);

    if (this.events[event].length === 0) {
      delete this.events[event];
    }
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {...any} args - Arguments to pass to callbacks
   */
  emit(event, ...args) {
    if (!this.events[event]) return;

    this.events[event].forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in event handler for "${event}":`, error);
      }
    });
  }

  /**
   * Remove all event listeners
   * @param {string} event - Event name (optional, if not provided, removes all)
   */
  removeAllListeners(event) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }

  /**
   * Get listener count for an event
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event) {
    return this.events[event] ? this.events[event].length : 0;
  }
}

// Create global event emitter instance
export const appEvents = new EventEmitter();

// Application event names
export const AppEvents = {
  // Presentation events
  PRESENTATION_CREATED: 'presentation:created',
  PRESENTATION_LOADED: 'presentation:loaded',
  PRESENTATION_SAVED: 'presentation:saved',
  PRESENTATION_CHANGED: 'presentation:changed',

  // Slide events
  SLIDE_ADDED: 'slide:added',
  SLIDE_REMOVED: 'slide:removed',
  SLIDE_CHANGED: 'slide:changed',
  SLIDE_SELECTED: 'slide:selected',

  // Element events
  ELEMENT_ADDED: 'element:added',
  ELEMENT_REMOVED: 'element:removed',
  ELEMENT_SELECTED: 'element:selected',
  ELEMENT_DESELECTED: 'element:deselected',
  ELEMENT_UPDATED: 'element:updated',
  ELEMENT_MOVED: 'element:moved',
  ELEMENT_RESIZED: 'element:resized',
  ELEMENT_ROTATED: 'element:rotated',

  // Animation events
  ANIMATION_STARTED: 'animation:started',
  ANIMATION_ENDED: 'animation:ended',
  ANIMATION_UPDATED: 'animation:updated',

  // UI events
  UI_MODE_CHANGED: 'ui:mode:changed',
  UI_PANEL_TOGGLED: 'ui:panel:toggled',
  UI_ZOOM_CHANGED: 'ui:zoom:changed',

  // History events
  HISTORY_UNDO: 'history:undo',
  HISTORY_REDO: 'history:redo',
  HISTORY_CHANGED: 'history:changed',

  // Error events
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

/**
 * Prevent default behavior and stop propagation
 * @param {Event} event - Event object
 */
export const preventDefault = (event) => {
  event.preventDefault();
  event.stopPropagation();
};

/**
 * Check if event is a keyboard shortcut
 * @param {KeyboardEvent} event - Keyboard event
 * @param {string} shortcut - Shortcut string (e.g., 'ctrl+s')
 * @returns {boolean} True if shortcut matches
 */
export const isShortcut = (event, shortcut) => {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  const ctrl = parts.includes('ctrl') || parts.includes('cmd');
  const shift = parts.includes('shift');
  const alt = parts.includes('alt');

  return (
    event.key.toLowerCase() === key &&
    (!ctrl || event.ctrlKey || event.metaKey) &&
    (!shift || event.shiftKey) &&
    (!alt || event.altKey)
  );
};

/**
 * Add event listener with automatic cleanup
 * @param {HTMLElement|Window|Document} target - Event target
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @param {Object} options - Event options
 * @returns {Function} Cleanup function
 */
export const addEventListener = (target, event, handler, options = {}) => {
  target.addEventListener(event, handler, options);

  return () => {
    target.removeEventListener(event, handler, options);
  };
};

/**
 * Add multiple event listeners at once
 * @param {HTMLElement|Window|Document} target - Event target
 * @param {Object} events - Object mapping event names to handlers
 * @param {Object} options - Event options
 * @returns {Function} Cleanup function
 */
export const addEventListeners = (target, events, options = {}) => {
  const cleanupFunctions = Object.entries(events).map(([event, handler]) => {
    return addEventListener(target, event, handler, options);
  });

  return () => {
    cleanupFunctions.forEach(cleanup => cleanup());
  };
};

/**
 * Delegate event handling to parent element
 * @param {HTMLElement} parent - Parent element
 * @param {string} selector - Child selector
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @returns {Function} Cleanup function
 */
export const delegateEvent = (parent, selector, event, handler) => {
  const delegateHandler = (e) => {
    const target = e.target.closest(selector);
    if (target && parent.contains(target)) {
      handler.call(target, e);
    }
  };

  return addEventListener(parent, event, delegateHandler);
};

/**
 * Trigger custom event
 * @param {HTMLElement} target - Event target
 * @param {string} eventName - Event name
 * @param {*} detail - Event detail data
 */
export const triggerEvent = (target, eventName, detail = null) => {
  const event = new CustomEvent(eventName, {
    bubbles: true,
    cancelable: true,
    detail
  });

  target.dispatchEvent(event);
};
