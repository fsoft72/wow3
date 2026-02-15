/**
 * WOW3 Settings Module
 * Manages application settings with localStorage persistence.
 * All settings are stored under the "wow3" key in localStorage.
 */

const SETTINGS_KEY = 'wow3';

const DEFAULT_SETTINGS = {
  general: {
    autosaveInterval: 15
  },
  theme: {
    mode: 'light',
    navColor: '#1565C0',
    buttonColor: '#1976D2',
    panelColor: '#1565C0'
  }
};

/**
 * Deep-merge source into target, filling in missing keys from source.
 * @param {Object} target - The target object (user settings)
 * @param {Object} source - The source object (defaults)
 * @returns {Object} Merged object
 */
const _deepMerge = (target, source) => {
  const result = { ...source };
  for (const key of Object.keys(target)) {
    if (
      target[key] !== null &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key]) &&
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      result[key] = _deepMerge(target[key], source[key]);
    } else {
      result[key] = target[key];
    }
  }
  return result;
};

/**
 * Load settings from localStorage, deep-merged with defaults.
 * @returns {Object} Complete settings object
 */
const loadSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    const parsed = JSON.parse(raw);
    return _deepMerge(parsed, DEFAULT_SETTINGS);
  } catch (e) {
    console.warn('Failed to load settings, using defaults:', e);
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
};

/**
 * Save settings object to localStorage.
 * @param {Object} settings - The settings object to persist
 */
const saveSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
};

/**
 * Get a setting value by dot-path.
 * @param {string} path - Dot-separated path, e.g. "theme.navColor"
 * @returns {*} The setting value, or undefined if not found
 */
const getSetting = (path) => {
  const settings = loadSettings();
  return path.split('.').reduce((obj, key) => (obj != null ? obj[key] : undefined), settings);
};

/**
 * Set a setting value by dot-path and auto-save.
 * @param {string} path - Dot-separated path, e.g. "theme.navColor"
 * @param {*} value - The value to set
 */
const setSetting = (path, value) => {
  const settings = loadSettings();
  const keys = path.split('.');
  let current = settings;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] == null || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
  saveSettings(settings);
};

// Expose globally for non-module scripts
window.WOW3Settings = {
  loadSettings,
  saveSettings,
  getSetting,
  setSetting,
  DEFAULT_SETTINGS
};

export { loadSettings, saveSettings, getSetting, setSetting, DEFAULT_SETTINGS, SETTINGS_KEY };
