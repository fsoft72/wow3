/**
 * wow3-animation project import/export utilities.
 *
 * ZIP format (.wow3a):
 *   project.json       — full project serialization with asset paths rewritten
 *   assets/<filename>  — all referenced media blobs
 */

// ── Media ID collection ────────────────────────────────────────────────────

/**
 * Collect all local media IDs referenced in a serialized project.
 * Scans:
 *   - visual clip properties.url (image / video)
 *   - visual clip properties.backgroundImage.url
 *   - audio clip mediaId
 *   - karaoke clip properties.srtMediaId
 *
 * @param {Object} jsonData - Output of Project.toJSON()
 * @returns {Set<string>} Set of bare media IDs (no local:// prefix)
 */
const collectMediaIds = (jsonData) => {
  const ids = new Set();

  const extractId = (url) => {
    if (!url || typeof url !== 'string') return;
    if (url.startsWith('local://')) {
      const id = url.replace('local://', '');
      if (id.startsWith('media_')) ids.add(id);
    } else if (url.startsWith('media_')) {
      ids.add(url);
    }
  };

  for (const track of jsonData.tracks ?? []) {
    for (const clip of track.clips ?? []) {
      // Image / video / text background url
      if (clip.properties?.url) extractId(clip.properties.url);
      if (clip.properties?.backgroundImage?.url) extractId(clip.properties.backgroundImage.url);
      // Karaoke SRT
      if (clip.properties?.srtMediaId) extractId(clip.properties.srtMediaId);
      // Audio
      if (clip.mediaId) extractId(clip.mediaId);
      if (clip.src) extractId(clip.src);
    }
  }

  return ids;
};

// ── URL rewriting ──────────────────────────────────────────────────────────

/**
 * Rewrite all media references in a project JSON tree.
 * Works for both export (mediaId → assets/filename) and
 * import (assets/filename → new mediaId).
 *
 * @param {Object} jsonData - Serialized project (mutated in-place)
 * @param {Map<string, string>} urlMap - Old value → new value
 */
const rewriteMediaUrls = (jsonData, urlMap) => {
  const rewrite = (url) => {
    if (!url) return url;
    if (urlMap.has(url)) return urlMap.get(url);
    // Also check bare ID without local:// prefix
    if (url.startsWith('local://')) {
      const bare = url.replace('local://', '');
      if (urlMap.has(bare)) return urlMap.get(bare);
    }
    return url;
  };

  for (const track of jsonData.tracks ?? []) {
    for (const clip of track.clips ?? []) {
      if (clip.properties?.url) clip.properties.url = rewrite(clip.properties.url);
      if (clip.properties?.backgroundImage?.url) {
        clip.properties.backgroundImage.url = rewrite(clip.properties.backgroundImage.url);
      }
      if (clip.properties?.srtMediaId) {
        clip.properties.srtMediaId = rewrite(clip.properties.srtMediaId);
      }
      if (clip.mediaId) clip.mediaId = rewrite(clip.mediaId);
      if (clip.src)     clip.src     = rewrite(clip.src);
    }
  }
};

// ── MIME helpers ───────────────────────────────────────────────────────────

const MIME_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg',
  mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', aac: 'audio/aac',
  srt: 'text/plain', vtt: 'text/vtt',
};

const mimeFromFilename = (filename) => {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
};

// ── Export ─────────────────────────────────────────────────────────────────

/**
 * Export a project as a self-contained .wow3a ZIP file.
 * All referenced local media is bundled in the assets/ folder,
 * and the project.json has URLs rewritten to relative asset paths.
 *
 * @param {import('../models/Project.js').Project} project
 * @returns {Promise<void>}
 */
export const exportProject = async (project) => {
  if (typeof JSZip === 'undefined') throw new Error('JSZip not loaded');

  const jsonData = JSON.parse(JSON.stringify(project.toJSON()));
  if (jsonData.metadata) {
    delete jsonData.metadata.mediaFolderId;
  }

  // Collect all media IDs referenced
  const mediaIds = collectMediaIds(jsonData);

  // Fetch blobs from MediaDB and build a filename map
  const mediaMap = new Map(); // mediaId → { filename, blob }
  const usedFilenames = new Set();

  for (const id of mediaIds) {
    try {
      const item = await window.MediaDB.getMediaItem(id);
      if (!item?.blob) { console.warn(`⚠️ Media not found, skipping: ${id}`); continue; }

      let filename = item.name || id;
      // Deduplicate filenames
      if (usedFilenames.has(filename)) {
        const dot = filename.lastIndexOf('.');
        const base = dot > 0 ? filename.slice(0, dot) : filename;
        const ext  = dot > 0 ? filename.slice(dot) : '';
        let n = 1;
        while (usedFilenames.has(`${base}_${n}${ext}`)) n++;
        filename = `${base}_${n}${ext}`;
      }
      usedFilenames.add(filename);
      mediaMap.set(id, { filename, blob: item.blob });
    } catch (err) {
      console.warn(`⚠️ Failed to fetch media ${id}:`, err);
    }
  }

  // Rewrite media references to relative asset paths
  const urlMap = new Map();
  for (const [id, { filename }] of mediaMap) {
    urlMap.set(id, `assets/${filename}`);
    urlMap.set(`local://${id}`, `assets/${filename}`);
  }
  rewriteMediaUrls(jsonData, urlMap);

  // Build ZIP
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(jsonData, null, 2));
  const assetsFolder = zip.folder('assets');
  for (const [, { filename, blob }] of mediaMap) {
    assetsFolder.file(filename, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });

  // Download
  const safeName = (project.title || 'project').replace(/[^a-z0-9_\-]/gi, '_');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(zipBlob);
  a.download = `${safeName}.wow3a`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);

  console.log(`📦 Exported "${project.title}" (${mediaMap.size} assets)`);
};

// ── Import ─────────────────────────────────────────────────────────────────

/**
 * Import a .wow3a ZIP file:
 *   1. Read project.json
 *   2. Import all assets into MediaDB under a folder named after the zip file
 *   3. Rewrite asset paths back to new media IDs
 *
 * @param {File} file - The .wow3a file selected by the user
 * @returns {Promise<Object>} Deserialized project JSON (ready for Project.fromJSON)
 */
export const importProjectZip = async (file) => {
  if (typeof JSZip === 'undefined') throw new Error('JSZip not loaded');

  const zip = await JSZip.loadAsync(file);

  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error('Invalid .wow3a file: missing project.json');

  const jsonData = JSON.parse(await projectFile.async('string'));

  // Import assets into MediaDB
  const filenameToId = new Map();
  const assetsFolder = zip.folder('assets');

  if (assetsFolder) {
    const assetFiles = [];
    assetsFolder.forEach((relativePath, entry) => {
      if (!entry.dir) assetFiles.push({ relativePath, entry });
    });

    if (assetFiles.length > 0) {
      // Use the zip filename (without extension) as the album name
      const albumName = file.name.replace(/\.wow3a$/i, '').replace(/[_-]/g, ' ') ||
        jsonData.title?.trim() || 'Imported Project';
      let folderId = null;
      try {
        const folder = await window.MediaDB.createFolder(albumName);
        folderId = folder.id;
        } catch (_) {}

      jsonData.metadata = jsonData.metadata || {};
      jsonData.metadata.mediaFolderId = folderId;

      for (const { relativePath, entry } of assetFiles) {
        try {
          const blob = await entry.async('blob');
          const mimeType = mimeFromFilename(relativePath);
          const mediaFile = new File([blob], relativePath, { type: mimeType });
          const item = await window.MediaDB.addMedia(mediaFile, folderId);
          filenameToId.set(relativePath, item.id);
        } catch (err) {
          console.warn(`⚠️ Failed to import asset ${relativePath}:`, err);
        }
      }
    }
  }

  // Rewrite asset paths to media IDs
  const urlMap = new Map();
  for (const [filename, newId] of filenameToId) {
    urlMap.set(`assets/${filename}`, newId);
  }
  rewriteMediaUrls(jsonData, urlMap);

  console.log(`📦 Imported "${jsonData.title}" (${filenameToId.size} assets)`);
  return jsonData;
};

/**
 * Open a file picker and import a .wow3a project file.
 * @returns {Promise<Object>} Project JSON data
 */
export const importProject = () => {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.wow3a';

    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) { reject(new Error('No file selected')); return; }
      try {
        resolve(await importProjectZip(file));
      } catch (err) {
        reject(err);
      }
    });

    input.click();
  });
};
