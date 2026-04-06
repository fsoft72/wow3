/**
 * Fetch an ArrayBuffer from MediaDB (for media_xxx IDs) or a URL.
 * @param {string} src - mediaId or URL
 * @returns {Promise<ArrayBuffer|null>}
 */
export async function fetchMediaArrayBuffer(src) {
  try {
    if (src.startsWith('media_') && typeof MediaDB !== 'undefined') {
      const item = await MediaDB.getMediaItem(src);
      if (item?.blob) return await item.blob.arrayBuffer();
    }
    const resp = await fetch(src);
    return await resp.arrayBuffer();
  } catch (err) {
    console.warn('fetchMediaArrayBuffer failed:', err);
    return null;
  }
}

/**
 * Fetch text content from MediaDB (for media_xxx IDs) or a URL.
 * @param {string} src - mediaId or URL
 * @returns {Promise<string|null>}
 */
export async function fetchMediaText(src) {
  try {
    if (src.startsWith('media_') && typeof MediaDB !== 'undefined') {
      const item = await MediaDB.getMediaItem(src);
      if (item?.blob) return await item.blob.text();
    }
    const resp = await fetch(src);
    return await resp.text();
  } catch (err) {
    console.warn('fetchMediaText failed:', err);
    return null;
  }
}
