/**
 * WOW3 Storage Utilities
 * Functions for data persistence using localStorage
 */

import { STORAGE_KEYS } from './constants.js';

/**
 * Save presentation to localStorage
 * @param {Object} presentation - Presentation object
 * @returns {boolean} Success status
 */
export const savePresentation = (presentation) => {
  try {
    const data = JSON.stringify(presentation.toJSON());
    localStorage.setItem(STORAGE_KEYS.PREFIX + presentation.id, data);
    localStorage.setItem(STORAGE_KEYS.CURRENT_PRESENTATION, data);
    return true;
  } catch (e) {
    console.error('Failed to save presentation:', e);
    return false;
  }
};

/**
 * Load presentation from localStorage
 * @param {string} id - Presentation ID
 * @returns {Object|null} Presentation data or null
 */
export const loadPresentation = (id) => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PREFIX + id);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to load presentation:', e);
    return null;
  }
};

/**
 * Get all saved presentations
 * @returns {Array} Array of presentation metadata
 */
export const getAllPresentations = () => {
  const presentations = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(STORAGE_KEYS.PREFIX) && key !== STORAGE_KEYS.CURRENT_PRESENTATION) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        presentations.push({
          id: data.id,
          title: data.title,
          modified: data.metadata.modified,
          slideCount: data.slides.length
        });
      } catch (e) {
        console.error('Failed to parse presentation:', e);
      }
    }
  }

  return presentations.sort((a, b) => new Date(b.modified) - new Date(a.modified));
};

/**
 * Delete presentation from localStorage
 * @param {string} id - Presentation ID
 * @returns {boolean} Success status
 */
export const deletePresentation = (id) => {
  try {
    localStorage.removeItem(STORAGE_KEYS.PREFIX + id);
    return true;
  } catch (e) {
    console.error('Failed to delete presentation:', e);
    return false;
  }
};

/**
 * Export presentation as JSON file
 * @param {Object} presentation - Presentation object
 */
export const exportPresentation = (presentation) => {
  const data = JSON.stringify(presentation.toJSON(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${presentation.title.replace(/[^a-z0-9]/gi, '_')}.wow3.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Import presentation from JSON file
 * @returns {Promise<Object>} Promise that resolves with presentation data
 */
export const importPresentation = () => {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.wow3.json';

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });

    input.click();
  });
};

/**
 * Save user preferences
 * @param {Object} preferences - User preferences
 * @returns {boolean} Success status
 */
export const savePreferences = (preferences) => {
  try {
    localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
    return true;
  } catch (e) {
    console.error('Failed to save preferences:', e);
    return false;
  }
};

/**
 * Load user preferences
 * @returns {Object} User preferences
 */
export const loadPreferences = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error('Failed to load preferences:', e);
    return {};
  }
};

/**
 * Clear all application data
 * @returns {boolean} Success status
 */
export const clearAllData = () => {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(STORAGE_KEYS.PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach(key => localStorage.removeItem(key));
    return true;
  } catch (e) {
    console.error('Failed to clear data:', e);
    return false;
  }
};

/**
 * Get storage usage statistics
 * @returns {Object} Storage usage info
 */
export const getStorageUsage = () => {
  let totalSize = 0;
  let presentationCount = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(STORAGE_KEYS.PREFIX)) {
      const value = localStorage.getItem(key);
      totalSize += key.length + value.length;
      if (key !== STORAGE_KEYS.CURRENT_PRESENTATION && key !== STORAGE_KEYS.PREFERENCES) {
        presentationCount++;
      }
    }
  }

  return {
    totalSize: totalSize * 2, // UTF-16 uses 2 bytes per character
    presentationCount,
    totalSizeFormatted: formatBytes(totalSize * 2)
  };
};

/**
 * Format bytes to human readable format
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};
