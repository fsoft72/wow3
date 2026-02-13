/**
 * WOW3 MediaDB: IndexedDB manager for media files with folder support
 * Handles binary file storage to avoid data URL bloat in presentations
 */

const MEDIA_DB_NAME = 'wow3_media';
const MEDIA_DB_VERSION = 3;
const STORE_MEDIA = 'media_items';
const STORE_FOLDERS = 'media_folders';

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
        let mediaStore;
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          mediaStore = db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
        } else {
          mediaStore = event.target.transaction.objectStore(STORE_MEDIA);
        }

        // Ensure indexes exist
        if (!mediaStore.indexNames.contains('folderId')) {
          mediaStore.createIndex('folderId', 'folderId', { unique: false });
        }
        if (!mediaStore.indexNames.contains('type')) {
          mediaStore.createIndex('type', 'type', { unique: false });
        }
        if (!mediaStore.indexNames.contains('createdAt')) {
          mediaStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!mediaStore.indexNames.contains('hash')) {
          mediaStore.createIndex('hash', 'hash', { unique: false });
        }

        // Folders Store
        if (!db.objectStoreNames.contains(STORE_FOLDERS)) {
          const folderStore = db.createObjectStore(STORE_FOLDERS, { keyPath: 'id' });
          folderStore.createIndex('name', 'name', { unique: false });
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
   * Create folder/album
   */
  async createFolder(name) {
    const db = await this.init();
    const id = 'folder_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const folder = { id, name, createdAt: Date.now() };
    await new Promise((resolve) => {
      const tx = db.transaction([STORE_FOLDERS], 'readwrite');
      tx.objectStore(STORE_FOLDERS).add(folder).onsuccess = () => resolve();
    });
    return folder;
  },

  /**
   * Get all folders
   */
  async getFolders() {
    const db = await this.init();
    return new Promise((resolve) => {
      const request = db.transaction([STORE_FOLDERS], 'readonly').objectStore(STORE_FOLDERS).getAll();
      request.onsuccess = () => resolve(request.result);
    });
  },

  /**
   * Delete folder (moves items to root)
   */
  async deleteFolder(id) {
    const db = await this.init();
    const tx = db.transaction([STORE_FOLDERS, STORE_MEDIA], 'readwrite');
    tx.objectStore(STORE_FOLDERS).delete(id);

    const mediaStore = tx.objectStore(STORE_MEDIA);
    const index = mediaStore.index('folderId');
    index.openCursor(IDBKeyRange.only(id)).onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const item = cursor.value;
        item.folderId = null;
        cursor.update(item);
        cursor.continue();
      }
    };

    return new Promise((resolve) => tx.oncomplete = () => resolve());
  },

  /**
   * Rename folder
   */
  async renameFolder(id, newName) {
    const db = await this.init();
    const tx = db.transaction([STORE_FOLDERS], 'readwrite');
    const store = tx.objectStore(STORE_FOLDERS);
    const folder = await new Promise(res => store.get(id).onsuccess = e => res(e.target.result));
    if (folder) {
      folder.name = newName;
      store.put(folder);
    }
    return new Promise(resolve => tx.oncomplete = resolve);
  },

  /**
   * Compute SHA-256 hash of a File or Blob
   * @param {File|Blob} file - File or Blob to hash
   * @returns {Promise<string>} Hex-encoded SHA-256 hash
   */
  async _computeHash(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Find an existing media item by content hash
   * @param {string} hash - SHA-256 hex hash
   * @returns {Promise<Object|null>} Existing media item or null
   */
  async findByHash(hash) {
    if (!hash) return null;

    const db = await this.init();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_MEDIA], 'readonly');
      const store = tx.objectStore(STORE_MEDIA);

      // Use hash index if available, otherwise fall back to cursor scan
      if (store.indexNames.contains('hash')) {
        const request = store.index('hash').get(hash);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      } else {
        // Fallback for pre-v3 databases (before index is created)
        const request = store.getAll();
        request.onsuccess = () => {
          const match = (request.result || []).find(item => item.hash === hash);
          resolve(match || null);
        };
        request.onerror = () => resolve(null);
      }
    });
  },

  /**
   * Add media file to IndexedDB (deduplicates by content hash)
   * @param {File|Blob} file - File or Blob object
   * @param {string|null} folderId - Folder ID or null for root
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Media item with id (existing if duplicate)
   */
  async addMedia(file, folderId = null, metadata = {}) {
    const db = await this.init();

    // Compute content hash and check for duplicates
    const hash = await this._computeHash(file);
    const existing = await this.findByHash(hash);
    if (existing) {
      console.log('♻️ Media already exists, reusing:', existing.id);
      return existing;
    }

    const id = 'media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const item = {
      id,
      name: file.name || 'media',
      type: file.type || 'application/octet-stream',
      size: file.size,
      blob: file,
      hash,
      folderId: folderId || null,
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
   * Get media items (filtered by folder)
   * @param {string|null} folderId - 'all', null (root), or folder ID
   */
  async getMedia(folderId = null) {
    const db = await this.init();
    const tx = db.transaction([STORE_MEDIA], 'readonly');
    const store = tx.objectStore(STORE_MEDIA);

    if (folderId === 'all') {
      return new Promise(resolve => store.getAll().onsuccess = e => resolve(e.target.result));
    }

    // Use index for specific folders
    const index = store.index('folderId');
    return new Promise(resolve => index.getAll(IDBKeyRange.only(folderId)).onsuccess = e => resolve(e.target.result));
  },

  /**
   * Get single media item by ID
   */
  async getMediaItem(id) {
    const db = await this.init();
    return new Promise(resolve => db.transaction([STORE_MEDIA], 'readonly').objectStore(STORE_MEDIA).get(id).onsuccess = e => resolve(e.target.result));
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
   * Update media item
   */
  async updateMedia(item) {
    const db = await this.init();
    await new Promise(resolve => db.transaction([STORE_MEDIA], 'readwrite').objectStore(STORE_MEDIA).put(item).onsuccess = () => resolve());
  },

  /**
   * Search media by name
   */
  async searchMedia(query) {
    const all = await this.getAllMedia();
    if (!query) return all;
    const lowerQ = query.toLowerCase();
    return all.filter(item => item.name.toLowerCase().includes(lowerQ));
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
    const item = await this.getMediaItem(id);
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

    const item = await this.getMediaItem(id);
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
      const existing = await this.getMediaItem(exportData.id);
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
