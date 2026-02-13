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

    // Serialize to plain JSON object (strips Promises, DOM refs, and other non-cloneable values)
    const raw = presentation.toJSON ? presentation.toJSON() : presentation;
    const data = JSON.parse(JSON.stringify(raw));
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
 * Collect all media IDs referenced in the presentation JSON.
 * Traverses slides, shell, and all nested children looking for
 * properties.url values that point to local media.
 * @param {Object} jsonData - Serialized presentation object
 * @returns {Set<string>} Set of media IDs (without local:// prefix)
 */
const collectMediaIds = (jsonData) => {
  const ids = new Set();

  /**
   * Extract a media ID from a URL string if it's a local reference
   * @param {string} url - URL to inspect
   */
  const extractId = (url) => {
    if (!url || typeof url !== 'string') return;
    if (url.startsWith('local://')) {
      const id = url.replace('local://', '');
      if (id.startsWith('media_')) ids.add(id);
    } else if (url.startsWith('media_')) {
      ids.add(url);
    }
  };

  /**
   * Recursively scan an element and its children for media references
   * @param {Object} el - Serialized element
   */
  const scanElement = (el) => {
    if (!el) return;
    if (el.properties && el.properties.url) {
      extractId(el.properties.url);
    }
    if (Array.isArray(el.children)) {
      el.children.forEach(scanElement);
    }
  };

  /**
   * Scan a slide's elements array
   * @param {Object} slide - Serialized slide
   */
  const scanSlide = (slide) => {
    if (!slide) return;
    if (Array.isArray(slide.elements)) {
      slide.elements.forEach(scanElement);
    }
  };

  if (Array.isArray(jsonData.slides)) {
    jsonData.slides.forEach(scanSlide);
  }
  if (jsonData.shell) {
    scanSlide(jsonData.shell);
  }

  return ids;
};

/**
 * Rewrite media URLs in the JSON tree, replacing local media references
 * with asset paths (for export) or new media IDs (for import).
 * @param {Object} jsonData - Serialized presentation (mutated in place)
 * @param {Map<string, string>} urlMap - Old URL → new URL mapping
 */
const rewriteMediaUrls = (jsonData, urlMap) => {
  /**
   * Rewrite URL in an element's properties
   * @param {Object} el - Serialized element
   */
  const rewriteElement = (el) => {
    if (!el) return;
    if (el.properties && el.properties.url) {
      const url = el.properties.url;
      // Try direct match first, then strip local:// prefix
      if (urlMap.has(url)) {
        el.properties.url = urlMap.get(url);
      } else if (url.startsWith('local://')) {
        const bare = url.replace('local://', '');
        if (urlMap.has(bare)) {
          el.properties.url = urlMap.get(bare);
        }
      }
    }
    if (Array.isArray(el.children)) {
      el.children.forEach(rewriteElement);
    }
  };

  const rewriteSlide = (slide) => {
    if (!slide || !Array.isArray(slide.elements)) return;
    slide.elements.forEach(rewriteElement);
  };

  if (Array.isArray(jsonData.slides)) {
    jsonData.slides.forEach(rewriteSlide);
  }
  if (jsonData.shell) {
    rewriteSlide(jsonData.shell);
  }
};

/**
 * Export presentation as a self-contained .wow3 ZIP file.
 * The ZIP contains presentation.json at root and an assets/ folder
 * with all referenced media blobs.
 * @param {Object} presentation - Presentation object
 * @returns {Promise<void>}
 */
export const exportPresentation = async (presentation) => {
  const jsonData = JSON.parse(JSON.stringify(
    presentation.toJSON ? presentation.toJSON() : presentation
  ));

  // Collect all local media IDs used in the presentation
  const mediaIds = collectMediaIds(jsonData);

  // Fetch blobs and build filename map
  const mediaMap = new Map(); // mediaId → { filename, blob }
  const usedFilenames = new Set();

  for (const id of mediaIds) {
    try {
      const item = await window.MediaDB.getMediaItem(id);
      if (!item || !item.blob) {
        console.warn(`⚠️ Media item not found, skipping: ${id}`);
        continue;
      }

      let filename = item.name || id;
      // Handle duplicate filenames by appending _N suffix
      if (usedFilenames.has(filename)) {
        const dotIdx = filename.lastIndexOf('.');
        const base = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
        const ext = dotIdx > 0 ? filename.slice(dotIdx) : '';
        let counter = 1;
        while (usedFilenames.has(`${base}_${counter}${ext}`)) counter++;
        filename = `${base}_${counter}${ext}`;
      }
      usedFilenames.add(filename);
      mediaMap.set(id, { filename, blob: item.blob });
    } catch (err) {
      console.warn(`⚠️ Failed to fetch media ${id}:`, err);
    }
  }

  // Build URL rewrite map: mediaId → assets/filename (and local:// variant)
  const urlMap = new Map();
  for (const [id, { filename }] of mediaMap) {
    const assetPath = `assets/${filename}`;
    urlMap.set(id, assetPath);
    urlMap.set(`local://${id}`, assetPath);
  }
  rewriteMediaUrls(jsonData, urlMap);

  // Build ZIP
  const zip = new JSZip();
  zip.file('presentation.json', JSON.stringify(jsonData, null, 2));

  const assetsFolder = zip.folder('assets');
  for (const [, { filename, blob }] of mediaMap) {
    assetsFolder.file(filename, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });

  // Trigger download
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${presentation.title.replace(/[^a-z0-9]/gi, '_')}.wow3`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`📦 Presentation exported as .wow3 (${mediaMap.size} assets)`);
};

/** MIME type lookup by file extension for imported assets */
const MIME_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogg: 'video/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aac: 'audio/aac',
};

/**
 * Guess MIME type from a filename extension
 * @param {string} filename - Asset filename
 * @returns {string} MIME type string
 */
const mimeFromFilename = (filename) => {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
};

/**
 * Import a .wow3 ZIP file: extract presentation.json, ingest assets
 * into MediaDB, and rewrite asset paths back to media IDs.
 * @param {File} file - The .wow3 ZIP file
 * @returns {Promise<Object>} Presentation JSON data
 */
const importZip = async (file) => {
  const zip = await JSZip.loadAsync(file);

  // Extract presentation.json
  const presFile = zip.file('presentation.json');
  if (!presFile) throw new Error('Invalid .wow3 file: missing presentation.json');

  const jsonData = JSON.parse(await presFile.async('string'));

  // Import each asset and build filename → newMediaId map
  const filenameToId = new Map();
  const assetsFolder = zip.folder('assets');

  if (assetsFolder) {
    const assetFiles = [];
    assetsFolder.forEach((relativePath, entry) => {
      if (!entry.dir) assetFiles.push({ relativePath, entry });
    });

    for (const { relativePath, entry } of assetFiles) {
      try {
        const blob = await entry.async('blob');
        const mimeType = mimeFromFilename(relativePath);
        const mediaFile = new File([blob], relativePath, { type: mimeType });
        const item = await window.MediaDB.addMedia(mediaFile);
        filenameToId.set(relativePath, item.id);
      } catch (err) {
        console.warn(`⚠️ Failed to import asset ${relativePath}:`, err);
      }
    }
  }

  // Rewrite assets/filename paths back to media IDs
  const urlMap = new Map();
  for (const [filename, newId] of filenameToId) {
    urlMap.set(`assets/${filename}`, newId);
  }
  rewriteMediaUrls(jsonData, urlMap);

  console.log(`📦 Imported .wow3 (${filenameToId.size} assets)`);
  return jsonData;
};

/**
 * Import presentation from a .wow3 ZIP or legacy .json file.
 * Opens a file picker, then processes the selected file.
 * @returns {Promise<Object>} Presentation JSON data
 */
export const importPresentation = () => {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.wow3,.json,.wow3.json';

    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      try {
        const isLegacy = file.name.endsWith('.json');
        if (isLegacy) {
          // Legacy JSON import
          const text = await file.text();
          const data = JSON.parse(text);
          console.log('📤 Presentation imported from JSON (legacy)');
          resolve(data);
        } else {
          // ZIP import
          const data = await importZip(file);
          resolve(data);
        }
      } catch (error) {
        reject(error);
      }
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
