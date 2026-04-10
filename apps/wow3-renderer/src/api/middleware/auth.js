import { createHash } from 'node:crypto';

/**
 * Hash a raw API key with SHA-256.
 * @param {string} rawKey
 * @returns {string} hex digest
 */
export function hashKey(rawKey) {
  return createHash('sha256').update(rawKey).digest('hex');
}
