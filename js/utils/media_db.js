/**
 * WOW3 MediaDB: IndexedDB manager for media files (images, videos, audio)
 * Handles binary file storage to avoid data URL bloat in presentations
 */

const MEDIA_DB_NAME = 'wow3_media';
const MEDIA_DB_VERSION = 1;
const STORE_MEDIA = 'media_items';

let mediaDbPromise = null;

const MediaDB = {
  /**
   * Initialize Media IndexedDB
   * @returns {Promise<IDBDatabase>}
   */
  init: function() {
    if (mediaDbPromise) return mediaDbPromise;

    mediaDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(MEDIA_DB_NAME, MEDIA_DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Media Items Store
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          const mediaStore = db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });

          // Create indexes
          mediaStore.createIndex('type', 'type', { unique: false });
          mediaStore.createIndex('createdAt', 'createdAt', { unique: false });
          mediaStore.createIndex('name', 'name', { unique: false });
        }

        console.log('MediaDB initialized:', MEDIA_DB_NAME);
      };

      request.onsuccess = (event) => {
        console.log('MediaDB connection successful');
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.error('MediaDB error:', event.target.error);
        reject(event.target.error);
      };
    });

    return mediaDbPromise;
  },

  /**
   * Add media file to IndexedDB
   * @param {File|Blob} file - File or Blob object
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Media item with id
   */
  async addMedia(file, metadata = {}) {
    const db = await this.init();
    const id = 'media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const item = {
      id,
      name: file.name || 'media',
      type: file.type || 'application/octet-stream',
      size: file.size,
      blob: file,
      createdAt: Date.now(),
      metadata: metadata
    };

    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MEDIA], 'readwrite');
      const request = tx.objectStore(STORE_MEDIA).add(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log('✅ Media saved to IndexedDB:', id);
    return item;
  },

  /**
   * Get media item by ID
   * @param {string} id - Media ID
   * @returns {Promise<Object|null>} Media item or null
   */
  async getMedia(id) {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MEDIA], 'readonly');
      const request = tx.objectStore(STORE_MEDIA).get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get all media items
   * @returns {Promise<Array>} Array of media items
   */
  async getAllMedia() {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MEDIA], 'readonly');
      const request = tx.objectStore(STORE_MEDIA).getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Delete media item
   * @param {string} id - Media ID
   * @returns {Promise<void>}
   */
  async deleteMedia(id) {
    const db = await this.init();

    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MEDIA], 'readwrite');
      const request = tx.objectStore(STORE_MEDIA).delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log('🗑️ Media deleted from IndexedDB:', id);
  },

  /**
   * Get media as data URL for display
   * @param {string} id - Media ID
   * @returns {Promise<string|null>} Data URL or null
   */
  async getMediaDataURL(id) {
    const item = await this.getMedia(id);
    if (!item || !item.blob) return null;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(item.blob);
    });
  },

  /**
   * Convert data URL to blob and save to IndexedDB
   * Returns media ID for use in elements
   * @param {string} dataURL - Data URL
   * @param {string} filename - Optional filename
   * @returns {Promise<string>} Media ID
   */
  async saveDataURL(dataURL, filename = 'image') {
    // Convert data URL to blob
    const response = await fetch(dataURL);
    const blob = await response.blob();

    // Create file from blob
    const file = new File([blob], filename, { type: blob.type });

    // Save to IndexedDB
    const item = await this.addMedia(file);
    return item.id;
  },

  /**
   * Export media for JSON (as base64 data URL)
   * @param {string} id - Media ID
   * @returns {Promise<Object>} Export data with dataURL
   */
  async exportMedia(id) {
    const dataURL = await this.getMediaDataURL(id);
    if (!dataURL) return null;

    const item = await this.getMedia(id);
    return {
      id,
      name: item.name,
      type: item.type,
      dataURL
    };
  },

  /**
   * Import media from export data (data URL)
   * @param {Object} exportData - Export data with dataURL
   * @returns {Promise<string>} New media ID
   */
  async importMedia(exportData) {
    if (!exportData || !exportData.dataURL) {
      throw new Error('Invalid import data');
    }

    // If it's an indexed media ID, check if it exists
    if (exportData.id && exportData.id.startsWith('media_')) {
      const existing = await this.getMedia(exportData.id);
      if (existing) {
        return exportData.id; // Already exists
      }
    }

    // Convert data URL to blob and save
    return await this.saveDataURL(exportData.dataURL, exportData.name);
  },

  /**
   * Clear all media (use with caution!)
   * @returns {Promise<void>}
   */
  async clearAllMedia() {
    const db = await this.init();

    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MEDIA], 'readwrite');
      const request = tx.objectStore(STORE_MEDIA).clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log('🗑️ All media cleared from IndexedDB');
  }
};

// Make available globally
window.MediaDB = MediaDB;
export default MediaDB;
