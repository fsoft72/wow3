/**
 * WOW3 PresentationsDB: IndexedDB manager for presentations
 * Handles permanent storage of presentations in IndexedDB
 */

const DB_NAME = 'wow3_presentations';
const DB_VERSION = 1;
const STORE_PRESENTATIONS = 'presentations';

let dbPromise = null;

const PresentationsDB = {
  /**
   * Initialize IndexedDB
   * @returns {Promise<IDBDatabase>}
   */
  init: function() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create presentations store
        if (!db.objectStoreNames.contains(STORE_PRESENTATIONS)) {
          const store = db.createObjectStore(STORE_PRESENTATIONS, { keyPath: 'id' });

          // Create indexes for efficient queries
          store.createIndex('title', 'title', { unique: false });
          store.createIndex('modified', 'metadata.modified', { unique: false });
          store.createIndex('created', 'metadata.created', { unique: false });
        }

        console.log('IndexedDB initialized:', DB_NAME);
      };

      request.onsuccess = (event) => {
        console.log('IndexedDB connection successful');
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });

    return dbPromise;
  },

  /**
   * Save presentation to IndexedDB
   * @param {Object} presentation - Presentation object
   * @returns {Promise<void>}
   */
  async savePresentation(presentation) {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PRESENTATIONS], 'readwrite');
      const store = tx.objectStore(STORE_PRESENTATIONS);

      // Convert presentation to JSON
      const data = presentation.toJSON ? presentation.toJSON() : presentation;

      const request = store.put(data);

      request.onsuccess = () => {
        console.log('Presentation saved to IndexedDB:', data.id);
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to save presentation:', request.error);
        reject(request.error);
      };
    });
  },

  /**
   * Get presentation by ID from IndexedDB
   * @param {string} id - Presentation ID
   * @returns {Promise<Object|null>}
   */
  async getPresentation(id) {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PRESENTATIONS], 'readonly');
      const store = tx.objectStore(STORE_PRESENTATIONS);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('Failed to get presentation:', request.error);
        reject(request.error);
      };
    });
  },

  /**
   * Get all presentations from IndexedDB
   * @returns {Promise<Array>}
   */
  async getAllPresentations() {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PRESENTATIONS], 'readonly');
      const store = tx.objectStore(STORE_PRESENTATIONS);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort by modified date (most recent first)
        const presentations = request.result || [];
        presentations.sort((a, b) => {
          const dateA = new Date(b.metadata?.modified || 0);
          const dateB = new Date(a.metadata?.modified || 0);
          return dateA - dateB;
        });
        resolve(presentations);
      };

      request.onerror = () => {
        console.error('Failed to get all presentations:', request.error);
        reject(request.error);
      };
    });
  },

  /**
   * Delete presentation from IndexedDB
   * @param {string} id - Presentation ID
   * @returns {Promise<void>}
   */
  async deletePresentation(id) {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PRESENTATIONS], 'readwrite');
      const store = tx.objectStore(STORE_PRESENTATIONS);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('Presentation deleted from IndexedDB:', id);
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to delete presentation:', request.error);
        reject(request.error);
      };
    });
  },

  /**
   * Search presentations by title
   * @param {string} query - Search query
   * @returns {Promise<Array>}
   */
  async searchPresentations(query) {
    const all = await this.getAllPresentations();

    if (!query) return all;

    const lowerQ = query.toLowerCase();
    return all.filter(p => p.title.toLowerCase().includes(lowerQ));
  },

  /**
   * Get presentation count
   * @returns {Promise<number>}
   */
  async getPresentationCount() {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PRESENTATIONS], 'readonly');
      const store = tx.objectStore(STORE_PRESENTATIONS);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Clear all presentations (use with caution!)
   * @returns {Promise<void>}
   */
  async clearAllPresentations() {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PRESENTATIONS], 'readwrite');
      const store = tx.objectStore(STORE_PRESENTATIONS);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('All presentations cleared from IndexedDB');
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to clear presentations:', request.error);
        reject(request.error);
      };
    });
  }
};

// Make available globally
window.PresentationsDB = PresentationsDB;
