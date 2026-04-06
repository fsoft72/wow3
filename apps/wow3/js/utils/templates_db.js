/**
 * WOW3 TemplatesDB: IndexedDB manager for user-saved slide templates
 * Handles permanent storage of templates in IndexedDB
 */

const TEMPLATES_DB_NAME = 'wow3_templates';
const TEMPLATES_DB_VERSION = 1;
const STORE_TEMPLATES = 'templates';

let templatesDbPromise = null;

const TemplatesDB = {
  /**
   * Initialize IndexedDB for templates
   * @returns {Promise<IDBDatabase>}
   */
  init: function() {
    if (templatesDbPromise) return templatesDbPromise;

    templatesDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(TEMPLATES_DB_NAME, TEMPLATES_DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
          const store = db.createObjectStore(STORE_TEMPLATES, { keyPath: 'id' });

          store.createIndex('name', 'name', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        console.log('IndexedDB initialized:', TEMPLATES_DB_NAME);
      };

      request.onsuccess = (event) => {
        console.log('TemplatesDB connection successful');
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.error('TemplatesDB error:', event.target.error);
        reject(event.target.error);
      };
    });

    return templatesDbPromise;
  },

  /**
   * Save a template to IndexedDB
   * @param {Object} template - Template record { id, name, slideData, createdAt }
   * @returns {Promise<void>}
   */
  async save(template) {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_TEMPLATES], 'readwrite');
      const store = tx.objectStore(STORE_TEMPLATES);
      const request = store.put(template);

      request.onsuccess = () => {
        console.log('Template saved to IndexedDB:', template.id);
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to save template:', request.error);
        reject(request.error);
      };
    });
  },

  /**
   * Get a template by ID
   * @param {string} id - Template ID
   * @returns {Promise<Object|null>}
   */
  async get(id) {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_TEMPLATES], 'readonly');
      const store = tx.objectStore(STORE_TEMPLATES);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('Failed to get template:', request.error);
        reject(request.error);
      };
    });
  },

  /**
   * Get all templates from IndexedDB
   * @returns {Promise<Array>}
   */
  async getAll() {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_TEMPLATES], 'readonly');
      const store = tx.objectStore(STORE_TEMPLATES);
      const request = store.getAll();

      request.onsuccess = () => {
        const templates = request.result || [];
        // Sort by creation date (most recent first)
        templates.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        resolve(templates);
      };

      request.onerror = () => {
        console.error('Failed to get all templates:', request.error);
        reject(request.error);
      };
    });
  },

  /**
   * Delete a template by ID
   * @param {string} id - Template ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_TEMPLATES], 'readwrite');
      const store = tx.objectStore(STORE_TEMPLATES);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('Template deleted from IndexedDB:', id);
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to delete template:', request.error);
        reject(request.error);
      };
    });
  },

  /**
   * Rename a template
   * @param {string} id - Template ID
   * @param {string} newName - New template name
   * @returns {Promise<void>}
   */
  async rename(id, newName) {
    const template = await this.get(id);
    if (!template) return;

    template.name = newName;
    await this.save(template);
  }
};

// Make available globally
window.TemplatesDB = TemplatesDB;
