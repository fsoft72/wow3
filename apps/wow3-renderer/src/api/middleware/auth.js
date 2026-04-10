import { createHash } from 'node:crypto';
import { findApiKeyByHash } from '../db.js';

/**
 * Hash a raw API key with SHA-256.
 * @param {string} rawKey
 * @returns {string} hex digest
 */
export function hashKey(rawKey) {
  return createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Fastify preHandler that validates the X-API-Key header against the database.
 * @param {import('better-sqlite3').Database} db
 * @returns {import('fastify').preHandlerHookHandler}
 */
export function createApiKeyAuth(db) {
  return async function apiKeyAuth(request, reply) {
    const raw = request.headers['x-api-key'];
    if (!raw) {
      reply.code(401).send({ error: 'Missing X-API-Key header' });
      return;
    }
    const row = findApiKeyByHash(db, hashKey(raw));
    if (!row) {
      reply.code(401).send({ error: 'Invalid API key' });
      return;
    }
  };
}
