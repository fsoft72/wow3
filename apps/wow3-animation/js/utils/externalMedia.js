const MIME_TO_EXTENSION = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'text/plain': 'txt',
  'text/vtt': 'vtt',
  'application/octet-stream': 'bin'
};

const DEFAULT_EXTENSION_BY_KIND = {
  image: 'png',
  video: 'mp4',
  audio: 'mp3',
  subtitle: 'srt',
  media: 'bin'
};

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isExternalMediaUrl(value) {
  return typeof value === 'string' && /^(https?:)?\/\//i.test(value);
}

/**
 * Import an external media URL into the current project's MediaDB folder.
 * Non-external values are returned unchanged.
 *
 * @param {import('../models/Project.js').Project} project
 * @param {string} source
 * @param {{kind?: 'image'|'video'|'audio'|'subtitle'|'media'}} [options]
 * @returns {Promise<string>}
 */
export async function ingestProjectMediaSource(project, source, options = {}) {
  if (!isExternalMediaUrl(source)) return source;
  if (options.kind === 'video' && isYouTubeUrl(source)) return source;
  return importExternalMediaUrl(project, source, options);
}

/**
 * Scan the whole project and replace importable external URLs with MediaDB IDs.
 *
 * @param {import('../models/Project.js').Project} project
 * @returns {Promise<number>} Number of rewritten references
 */
export async function localizeProjectExternalMedia(project) {
  const imported = new Map();
  let changed = 0;

  /**
   * @param {string} source
   * @param {{kind?: 'image'|'video'|'audio'|'subtitle'|'media'}} options
   * @returns {Promise<string>}
   */
  async function importOnce(source, options) {
    const key = `${options.kind || 'media'}:${source}`;
    if (!imported.has(key)) {
      imported.set(key, ingestProjectMediaSource(project, source, options));
    }
    return imported.get(key);
  }

  for (const track of project.tracks ?? []) {
    for (const clip of track.clips ?? []) {
      if (track.type === 'visual') {
        const visualUrl = clip.properties?.url;
        if (visualUrl && (clip.elementType === 'image' || clip.elementType === 'video')) {
          const mediaId = await importOnce(visualUrl, { kind: clip.elementType });
          if (mediaId !== visualUrl) {
            clip.properties.url = mediaId;
            changed++;
          }
        }

        const bgUrl = clip.properties?.backgroundImage?.url;
        if (bgUrl) {
          const mediaId = await importOnce(bgUrl, { kind: 'image' });
          if (mediaId !== bgUrl) {
            clip.properties.backgroundImage.url = mediaId;
            changed++;
          }
        }

        if (clip.elementType === 'karaoke') {
          const srtMediaId = clip.properties?.srtMediaId;
          const srtUrl = clip.properties?.srtUrl;
          const source = isExternalMediaUrl(srtMediaId) ? srtMediaId : srtUrl;

          if (source) {
            const mediaId = await importOnce(source, { kind: 'subtitle' });
            if (mediaId !== source || srtUrl) {
              clip.properties.srtMediaId = mediaId;
              clip.properties.srtUrl = '';
              changed++;
            }
          }
        }
      }

      if (track.type === 'audio') {
        const source = isExternalMediaUrl(clip.mediaId) ? clip.mediaId : clip.src;
        if (source) {
          const mediaId = await importOnce(source, { kind: 'audio' });
          if (mediaId !== source || clip.src) {
            clip.mediaId = mediaId;
            clip.src = '';
            changed++;
          }
        }
      }
    }
  }

  if (changed > 0) {
    project.touch();
  }

  return changed;
}

/**
 * Best-effort rename of the project's media folder.
 *
 * @param {import('../models/Project.js').Project} project
 * @returns {Promise<void>}
 */
export async function renameProjectMediaFolder(project) {
  const folderId = project?.metadata?.mediaFolderId;
  const folderName = getProjectFolderName(project);
  if (!folderId || !folderName || typeof MediaDB === 'undefined') return;

  try {
    await MediaDB.renameFolder(folderId, folderName);
  } catch (error) {
    console.warn('Failed to rename project media folder:', error);
  }
}

/**
 * @param {import('../models/Project.js').Project} project
 * @param {string} sourceUrl
 * @param {{kind?: 'image'|'video'|'audio'|'subtitle'|'media'}} [options]
 * @returns {Promise<string>}
 */
async function importExternalMediaUrl(project, sourceUrl, options = {}) {
  if (typeof MediaDB === 'undefined') {
    throw new Error('MediaDB is not available');
  }

  const folderId = await ensureProjectMediaFolder(project);
  const existing = await findProjectMediaBySourceUrl(folderId, sourceUrl);
  if (existing) {
    return existing.id;
  }

  const response = await fetch(sourceUrl, { cache: 'default' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${sourceUrl}`);
  }

  const blob = await response.blob();
  const contentType = normalizeMimeType(blob.type || response.headers.get('content-type'));
  const filename = buildImportedFilename(sourceUrl, response, options.kind, contentType);
  const file = new File([blob], filename, { type: contentType });
  const item = await MediaDB.addMedia(
    file,
    folderId,
    {
      importedFrom: 'external-url',
      sourceUrl,
      finalUrl: response.url || sourceUrl
    },
    { dedupe: false }
  );

  return item.id;
}

/**
 * @param {import('../models/Project.js').Project} project
 * @returns {Promise<string|null>}
 */
async function ensureProjectMediaFolder(project) {
  const currentFolderId = project?.metadata?.mediaFolderId || null;

  if (currentFolderId) {
    const folders = await MediaDB.getFolders();
    if (folders.some(folder => folder.id === currentFolderId)) {
      return currentFolderId;
    }
  }

  const folder = await MediaDB.createFolder(getProjectFolderName(project));
  project.metadata.mediaFolderId = folder.id;
  return folder.id;
}

/**
 * @param {string|null} folderId
 * @param {string} sourceUrl
 * @returns {Promise<Object|null>}
 */
async function findProjectMediaBySourceUrl(folderId, sourceUrl) {
  if (!folderId) return null;
  const items = await MediaDB.getMedia(folderId);
  return items.find((item) =>
    item?.metadata?.sourceUrl === sourceUrl ||
    item?.metadata?.finalUrl === sourceUrl
  ) || null;
}

/**
 * @param {import('../models/Project.js').Project} project
 * @returns {string}
 */
function getProjectFolderName(project) {
  const title = project?.title?.trim();
  return title || 'Untitled Project';
}

/**
 * @param {string} sourceUrl
 * @param {Response} response
 * @param {'image'|'video'|'audio'|'subtitle'|'media'|undefined} kind
 * @param {string} contentType
 * @returns {string}
 */
function buildImportedFilename(sourceUrl, response, kind, contentType) {
  const headerFilename = filenameFromContentDisposition(response.headers.get('content-disposition'));
  const sourceFilename = filenameFromUrl(response.url || sourceUrl);
  const baseName = sanitizeFilename(headerFilename || sourceFilename || kind || 'media');
  return ensureFileExtension(baseName, contentType, kind);
}

/**
 * @param {string|null} header
 * @returns {string}
 */
function filenameFromContentDisposition(header) {
  if (!header) return '';

  const utf8Match = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {}
  }

  const asciiMatch = header.match(/filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i);
  return asciiMatch?.[1] || asciiMatch?.[2] || '';
}

/**
 * @param {string} value
 * @returns {string}
 */
function filenameFromUrl(value) {
  try {
    const url = new URL(value, window.location.href);
    const pathname = url.pathname.split('/').pop() || '';
    return decodeURIComponent(pathname);
  } catch {
    return '';
  }
}

/**
 * @param {string} value
 * @returns {string}
 */
function sanitizeFilename(value) {
  const sanitized = value.replace(/[\\/:*?"<>|]+/g, '_').trim();
  return sanitized || 'media';
}

/**
 * @param {string} filename
 * @param {string} contentType
 * @param {'image'|'video'|'audio'|'subtitle'|'media'|undefined} kind
 * @returns {string}
 */
function ensureFileExtension(filename, contentType, kind) {
  if (/\.[a-z0-9]{1,10}$/i.test(filename)) {
    return filename;
  }

  const extension = MIME_TO_EXTENSION[contentType] || DEFAULT_EXTENSION_BY_KIND[kind || 'media'] || 'bin';
  return `${filename}.${extension}`;
}

/**
 * @param {string|null|undefined} value
 * @returns {string}
 */
function normalizeMimeType(value) {
  const raw = (value || '').split(';')[0].trim().toLowerCase();
  return raw || 'application/octet-stream';
}

/**
 * @param {string} url
 * @returns {boolean}
 */
function isYouTubeUrl(url) {
  return /(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/)/i.test(url);
}
