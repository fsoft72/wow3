/**
 * WOW3 Constants and Configuration
 * All application constants, enums, and default values
 */

// Animation type constants (bitwise flags for combining animations)
export const AnimationType = {
  FADE_IN: 1,
  FADE_OUT: 2,
  SLIDE_IN: 4,
  SLIDE_OUT: 8,
  ZOOM_IN: 16,
  ZOOM_OUT: 32,
  FLIP_IN: 64,
  FLIP_OUT: 128,
  BOUNCE_IN: 256,
  BOUNCE_OUT: 512,
  ROTATE_IN: 1024,
  ROTATE_OUT: 2048
};

// Animation triggers
export const AnimationTrigger = {
  CLICK: 'click',
  AUTO: 'auto'
};

// Element types
export const ElementType = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  LIST: 'list',
  LINK: 'link',
  SHAPE: 'shape'
};

// Slide directions
export const SlideDirection = {
  TOP: 'top',
  BOTTOM: 'bottom',
  LEFT: 'left',
  RIGHT: 'right'
};

// Canvas settings
export const CANVAS = {
  WIDTH: 1280,
  HEIGHT: 720,
  ASPECT_RATIO: 16 / 9
};

// Default element sizes
export const DEFAULT_SIZE = {
  TEXT: { width: 300, height: 100 },
  IMAGE: { width: 400, height: 300 },
  VIDEO: { width: 640, height: 360 },
  AUDIO: { width: 400, height: 60 },
  SHAPE: { width: 200, height: 200 },
  LIST: { width: 300, height: 200 },
  LINK: { width: 200, height: 50 }
};

// Default values
export const DEFAULTS = {
  FONT_FAMILY: 'Roboto',
  FONT_SIZE: 16,
  FONT_COLOR: '#000000',
  ANIMATION_DURATION: 600,
  BACKGROUND_COLOR: '#ffffff',
  SHAPE_FILL_COLOR: '#2196F3',
  SHAPE_STROKE_COLOR: '#000000',
  SHAPE_STROKE_WIDTH: 2
};

// Keyboard shortcuts
export const SHORTCUTS = {
  SAVE: 'ctrl+s',
  UNDO: 'ctrl+z',
  REDO: 'ctrl+y',
  DELETE: ['Delete', 'Backspace'],
  COPY: 'ctrl+c',
  PASTE: 'ctrl+v',
  CUT: 'ctrl+x',
  DUPLICATE: 'ctrl+d',
  SELECT_ALL: 'ctrl+a',
  ESCAPE: 'Escape',
  PLAY: 'F5',
  NEXT_SLIDE: ['ArrowRight', ' '],
  PREV_SLIDE: 'ArrowLeft'
};

// Storage keys
export const STORAGE_KEYS = {
  PREFIX: 'wow3_',
  CURRENT_PRESENTATION: 'wow3_current_presentation',
  SNAPSHOT: 'wow3_snapshot',
  AUTO_SAVE: 'wow3_autosave',
  PREFERENCES: 'wow3_preferences'
};

// Auto-save interval (milliseconds)
export const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

// UI constants
export const UI = {
  SIDEBAR_WIDTH: 250,
  TOOLBAR_HEIGHT: 64,
  STATUSBAR_HEIGHT: 32,
  ALIGNMENT_THRESHOLD: 5, // pixels
  MIN_ELEMENT_SIZE: 20, // pixels
  SNAP_TO_GRID: false,
  GRID_SIZE: 10 // pixels
};

// Supported file types
export const FILE_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  VIDEO: ['video/mp4', 'video/webm', 'video/ogg'],
  AUDIO: ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mpeg']
};

// Maximum file sizes (bytes)
export const MAX_FILE_SIZE = {
  IMAGE: 10 * 1024 * 1024, // 10MB
  VIDEO: 100 * 1024 * 1024, // 100MB
  AUDIO: 20 * 1024 * 1024 // 20MB
};

// Easing functions
export const EASING_FUNCTIONS = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease', label: 'Ease' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In Out' },
  { value: 'ease-in-back', label: 'Ease In Back' },
  { value: 'ease-out-back', label: 'Ease Out Back' },
  { value: 'ease-in-out-back', label: 'Ease In Out Back' }
];

// Font families
export const FONT_FAMILIES = [
  'Roboto',
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'Comic Sans MS',
  'Impact'
];

// Shape types
export const SHAPE_TYPES = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'line', label: 'Line' }
];

// Text alignments
export const TEXT_ALIGNMENTS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'justify', label: 'Justify' }
];
