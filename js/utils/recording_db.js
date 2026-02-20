/**
 * WOW3 RecordingDB: IndexedDB manager for recording chunks
 * Handles binary chunk storage for screen/audio recordings
 */

const RECORDING_DB_NAME = 'wow3_recordings';
const RECORDING_DB_VERSION = 1;
const STORE_RECORDING_CHUNKS = 'recording_chunks';

let recordingDbPromise = null;

const RecordingDB = {
  /**
   * Initialize Recording IndexedDB (lazy singleton)
   * @returns {Promise<IDBDatabase>}
   */
  init: () => {
    if (recordingDbPromise) return recordingDbPromise;

    recordingDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(RECORDING_DB_NAME, RECORDING_DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_RECORDING_CHUNKS)) {
          const store = db.createObjectStore(STORE_RECORDING_CHUNKS, {
            keyPath: 'id',
            autoIncrement: true
          });
          store.createIndex('sessionId', 'sessionId', { unique: false });
        }

        console.log('RecordingDB initialized:', RECORDING_DB_NAME);
      };

      request.onsuccess = (event) => {
        console.log('RecordingDB connection successful');
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.error('RecordingDB error:', event.target.error);
        reject(event.target.error);
      };
    });

    return recordingDbPromise;
  },

  /**
   * Save a recording chunk to IndexedDB
   * @param {string} sessionId - Recording session identifier
   * @param {number} chunkIndex - Sequential index of the chunk
   * @param {Blob} blob - Binary chunk data
   * @returns {Promise<number>} The auto-generated record ID
   */
  saveChunk: async (sessionId, chunkIndex, blob) => {
    const db = await RecordingDB.init();

    const record = {
      sessionId,
      chunkIndex,
      blob,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_RECORDING_CHUNKS], 'readwrite');
      const request = tx.objectStore(STORE_RECORDING_CHUNKS).add(record);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get all chunks for a recording session, sorted by chunkIndex
   * @param {string} sessionId - Recording session identifier
   * @returns {Promise<Array<{id: number, sessionId: string, chunkIndex: number, blob: Blob, timestamp: number}>>}
   */
  getChunks: async (sessionId) => {
    const db = await RecordingDB.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_RECORDING_CHUNKS], 'readonly');
      const store = tx.objectStore(STORE_RECORDING_CHUNKS);
      const index = store.index('sessionId');
      const request = index.getAll(IDBKeyRange.only(sessionId));

      request.onsuccess = () => {
        const chunks = request.result || [];
        chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
        resolve(chunks);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Delete all chunks for a recording session using cursor
   * @param {string} sessionId - Recording session identifier
   * @returns {Promise<void>}
   */
  deleteSession: async (sessionId) => {
    const db = await RecordingDB.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_RECORDING_CHUNKS], 'readwrite');
      const store = tx.objectStore(STORE_RECORDING_CHUNKS);
      const index = store.index('sessionId');
      const cursorReq = index.openCursor(IDBKeyRange.only(sessionId));

      cursorReq.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) return;
        cursor.delete();
        cursor.continue();
      };

      cursorReq.onerror = () => reject(cursorReq.error);
      tx.oncomplete = () => resolve();
    });
  },

  /**
   * Clear all recording data from IndexedDB
   * @returns {Promise<void>}
   */
  clearAll: async () => {
    const db = await RecordingDB.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_RECORDING_CHUNKS], 'readwrite');
      const request = tx.objectStore(STORE_RECORDING_CHUNKS).clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};

// Make available globally
window.RecordingDB = RecordingDB;
