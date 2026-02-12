/**
 * WOW3 Storage Utilities
 * Dual storage system:
 * - IndexedDB: Permanent storage (user clicks "Save")
 * - localStorage: Snapshots for auto-save and crash recovery
 */

import { STORAGE_KEYS } from './constants.js';

// PresentationsDB is loaded globally via script tag
const PresentationsDB = window.PresentationsDB;

// ==================== INDEXEDDB (PERMANENT STORAGE) ====================

/**
 * Generate thumbnail from first slide
 * @param {Object} presentation - Presentation object
 * @returns {Promise<string|null>} Data URL of thumbnail or null
 */
export const generateThumbnail = async (presentation) => {
  try {
    // Get the first slide
    if (!presentation.slides || presentation.slides.length === 0) {
      return null;
    }

    const canvas = document.getElementById('slide-canvas');
    if (!canvas) return null;

    // Wait a bit to ensure canvas is rendered
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create a temporary canvas for thumbnail
    const thumbCanvas = document.createElement('canvas');
    const thumbWidth = 400;
    const thumbHeight = 300;
    thumbCanvas.width = thumbWidth;
    thumbCanvas.height = thumbHeight;
    const ctx = thumbCanvas.getContext('2d');

    // Fill with slide background
    const firstSlide = presentation.slides[0];
    ctx.fillStyle = firstSlide.background || '#ffffff';
    ctx.fillRect(0, 0, thumbWidth, thumbHeight);

    // Get all elements from the canvas
    const elements = canvas.querySelectorAll('.element');

    if (elements.length === 0) {
      // No elements, just return background
      return thumbCanvas.toDataURL('image/png');
    }

    // Calculate scale to fit canvas into thumbnail
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = thumbWidth / canvasRect.width;
    const scaleY = thumbHeight / canvasRect.height;
    const scale = Math.min(scaleX, scaleY);

    // Center the content
    const offsetX = (thumbWidth - canvasRect.width * scale) / 2;
    const offsetY = (thumbHeight - canvasRect.height * scale) / 2;

    // Draw each element onto thumbnail canvas
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();

      // Calculate position relative to canvas
      const x = (rect.left - canvasRect.left) * scale + offsetX;
      const y = (rect.top - canvasRect.top) * scale + offsetY;
      const width = rect.width * scale;
      const height = rect.height * scale;

      // Get element type
      const elementType = element.dataset.type;

      if (elementType === 'text') {
        // Draw text elements
        const textContent = element.querySelector('.text-content');
        if (textContent) {
          const computedStyle = window.getComputedStyle(textContent);
          ctx.save();
          ctx.fillStyle = computedStyle.color;
          ctx.font = `${computedStyle.fontWeight} ${computedStyle.fontStyle} ${parseFloat(computedStyle.fontSize) * scale}px ${computedStyle.fontFamily}`;
          ctx.textAlign = computedStyle.textAlign || 'left';
          ctx.textBaseline = 'top';

          // Handle text alignment
          let textX = x;
          if (ctx.textAlign === 'center') textX = x + width / 2;
          else if (ctx.textAlign === 'right') textX = x + width;

          ctx.fillText(textContent.innerText, textX, y);
          ctx.restore();
        }
      } else if (elementType === 'image') {
        // Draw image elements
        const img = element.querySelector('img');
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, x, y, width, height);
        }
      } else if (elementType === 'shape') {
        // Draw shape elements
        const svg = element.querySelector('svg');
        if (svg) {
          const computedStyle = window.getComputedStyle(svg);
          ctx.save();
          ctx.fillStyle = computedStyle.fill || '#000000';

          // Simple shape rendering (rectangle or circle)
          const shapeType = element.dataset.shapeType || 'rectangle';
          if (shapeType === 'circle') {
            ctx.beginPath();
            ctx.arc(x + width/2, y + height/2, Math.min(width, height)/2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(x, y, width, height);
          }
          ctx.restore();
        }
      }
      // Note: Video, audio, and other complex elements are skipped in thumbnails
    }

    return thumbCanvas.toDataURL('image/png');
  } catch (e) {
    console.error('Failed to generate thumbnail:', e);
    return null;
  }
};

/**
 * Save presentation to IndexedDB (permanent storage)
 * This is called when user explicitly clicks "Save"
 * @param {Object} presentation - Presentation object
 * @param {string} thumbnail - Optional thumbnail data URL
 * @returns {Promise<boolean>} Success status
 */
export const savePresentation = async (presentation, thumbnail = null) => {
  try {
    // Generate thumbnail if not provided
    if (!thumbnail) {
      thumbnail = await generateThumbnail(presentation);
    }

    // Add thumbnail to presentation data
    const data = presentation.toJSON ? presentation.toJSON() : presentation;
    if (thumbnail) {
      data.thumbnail = thumbnail;
    }

    await PresentationsDB.savePresentation(data);

    // Also update the snapshot after successful save
    await saveSnapshot(presentation);

    console.log('✅ Presentation saved to IndexedDB');
    return true;
  } catch (e) {
    console.error('❌ Failed to save presentation to IndexedDB:', e);
    return false;
  }
};

/**
 * Load presentation from IndexedDB
 * @param {string} id - Presentation ID
 * @returns {Promise<Object|null>} Presentation data or null
 */
export const loadPresentation = async (id) => {
  try {
    const data = await PresentationsDB.getPresentation(id);
    return data;
  } catch (e) {
    console.error('Failed to load presentation from IndexedDB:', e);
    return null;
  }
};

/**
 * Get all saved presentations from IndexedDB
 * @returns {Promise<Array>} Array of presentations
 */
export const getAllPresentations = async () => {
  try {
    const presentations = await PresentationsDB.getAllPresentations();
    return presentations.map(p => ({
      id: p.id,
      title: p.title,
      modified: p.metadata?.modified,
      slideCount: p.slides?.length || 0
    }));
  } catch (e) {
    console.error('Failed to get all presentations:', e);
    return [];
  }
};

/**
 * Delete presentation from IndexedDB
 * @param {string} id - Presentation ID
 * @returns {Promise<boolean>} Success status
 */
export const deletePresentation = async (id) => {
  try {
    await PresentationsDB.deletePresentation(id);

    // Also remove from localStorage if it exists
    localStorage.removeItem(STORAGE_KEYS.PREFIX + id);

    console.log('✅ Presentation deleted from IndexedDB');
    return true;
  } catch (e) {
    console.error('Failed to delete presentation:', e);
    return false;
  }
};

/**
 * Search presentations by title
 * @param {string} query - Search query
 * @returns {Promise<Array>} Filtered presentations
 */
export const searchPresentations = async (query) => {
  try {
    return await PresentationsDB.searchPresentations(query);
  } catch (e) {
    console.error('Failed to search presentations:', e);
    return [];
  }
};

// ==================== LOCALSTORAGE (SNAPSHOTS) ====================

/**
 * Save snapshot to localStorage (auto-save, crash recovery)
 * This is called every 30 seconds for crash recovery
 * @param {Object} presentation - Presentation object
 * @returns {boolean} Success status
 */
export const saveSnapshot = (presentation) => {
  try {
    const data = JSON.stringify(presentation.toJSON ? presentation.toJSON() : presentation);

    // Save as current working presentation
    localStorage.setItem(STORAGE_KEYS.CURRENT_PRESENTATION, data);

    // Also save with timestamp for recovery
    const timestamp = Date.now();
    localStorage.setItem(STORAGE_KEYS.SNAPSHOT + '_' + timestamp, data);

    // Keep only last 3 snapshots to avoid filling localStorage
    cleanupOldSnapshots();

    console.log('📸 Snapshot saved to localStorage');
    return true;
  } catch (e) {
    console.error('Failed to save snapshot:', e);
    return false;
  }
};

/**
 * Load snapshot from localStorage
 * @returns {Object|null} Snapshot data or null
 */
export const loadSnapshot = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_PRESENTATION);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to load snapshot:', e);
    return null;
  }
};

/**
 * Clear current snapshot
 */
export const clearSnapshot = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_PRESENTATION);
    console.log('🗑️ Snapshot cleared');
  } catch (e) {
    console.error('Failed to clear snapshot:', e);
  }
};

/**
 * Get all snapshots (for recovery)
 * @returns {Array} Array of snapshots with timestamps
 */
export const getAllSnapshots = () => {
  const snapshots = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(STORAGE_KEYS.SNAPSHOT + '_')) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        const timestamp = parseInt(key.split('_').pop());
        snapshots.push({
          timestamp,
          data,
          date: new Date(timestamp)
        });
      } catch (e) {
        console.error('Failed to parse snapshot:', e);
      }
    }
  }

  return snapshots.sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Clean up old snapshots (keep only last 3)
 */
const cleanupOldSnapshots = () => {
  const snapshots = getAllSnapshots();

  // Keep only last 3 snapshots
  if (snapshots.length > 3) {
    snapshots.slice(3).forEach(snapshot => {
      localStorage.removeItem(STORAGE_KEYS.SNAPSHOT + '_' + snapshot.timestamp);
    });
  }
};

// ==================== IMPORT/EXPORT ====================

/**
 * Export presentation as JSON file
 * @param {Object} presentation - Presentation object
 */
export const exportPresentation = (presentation) => {
  const data = JSON.stringify(presentation.toJSON ? presentation.toJSON() : presentation, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${presentation.title.replace(/[^a-z0-9]/gi, '_')}.wow3.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('📥 Presentation exported to JSON');
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
          console.log('📤 Presentation imported from JSON');
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

// ==================== PREFERENCES ====================

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

// ==================== UTILITIES ====================

/**
 * Clear all application data (both IndexedDB and localStorage)
 * @returns {Promise<boolean>} Success status
 */
export const clearAllData = async () => {
  try {
    // Clear IndexedDB
    await PresentationsDB.clearAllPresentations();

    // Clear localStorage
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(STORAGE_KEYS.PREFIX) || key.startsWith(STORAGE_KEYS.SNAPSHOT)) {
        keys.push(key);
      }
    }
    keys.forEach(key => localStorage.removeItem(key));

    console.log('🗑️ All data cleared');
    return true;
  } catch (e) {
    console.error('Failed to clear data:', e);
    return false;
  }
};

/**
 * Get storage usage statistics
 * @returns {Promise<Object>} Storage usage info
 */
export const getStorageUsage = async () => {
  // localStorage usage
  let localStorageSize = 0;
  let snapshotCount = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(STORAGE_KEYS.PREFIX) || key.startsWith(STORAGE_KEYS.SNAPSHOT)) {
      const value = localStorage.getItem(key);
      localStorageSize += (key.length + value.length) * 2; // UTF-16

      if (key.startsWith(STORAGE_KEYS.SNAPSHOT)) {
        snapshotCount++;
      }
    }
  }

  // IndexedDB usage
  const presentationCount = await PresentationsDB.getPresentationCount();

  return {
    localStorage: {
      size: localStorageSize,
      sizeFormatted: formatBytes(localStorageSize),
      snapshotCount
    },
    indexedDB: {
      presentationCount
    }
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
