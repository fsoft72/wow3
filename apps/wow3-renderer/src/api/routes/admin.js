import { rm } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  listApiKeys, insertApiKey, deleteApiKey,
  listJobs, getJob, deleteJob,
} from '../db.js';
import { hashKey } from '../middleware/auth.js';
import { signAdminToken, createAdminAuth } from '../middleware/admin-auth.js';

/**
 * Register admin endpoints.
 * Login/logout are open routes; all others require a valid admin session cookie.
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {{ db: object, jwtSecret: string, adminUser: string, adminPass: string, dataDir?: string }} opts
 */
export async function adminRoutes(fastify, { db, jwtSecret, adminUser, adminPass }) {
  const adminAuth = createAdminAuth(jwtSecret);

  // ── Open routes (no auth required) ───────────────────────────────────────

  /** POST /login */
  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body ?? {};
    if (username !== adminUser || password !== adminPass) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    const token = signAdminToken(jwtSecret);
    reply.setCookie('admin_session', token, {
      httpOnly: true,
      sameSite: 'Strict',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
    return { ok: true };
  });

  /** POST /logout */
  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('admin_session', { path: '/' });
    return { ok: true };
  });

  // ── Protected routes (session required) ──────────────────────────────────
  // Registered in a sub-scope so the preHandler hook only applies here.

  fastify.register(async (instance) => {
    instance.addHook('preHandler', adminAuth);

    /** GET /api-keys */
    instance.get('/api-keys', async () => listApiKeys(db));

    /** POST /api-keys */
    instance.post('/api-keys', async (request, reply) => {
      const { label } = request.body ?? {};
      if (!label) return reply.code(400).send({ error: 'label is required' });

      const id = randomUUID();
      const rawKey = randomBytes(16).toString('hex'); // 32-char hex string
      insertApiKey(db, { id, label, keyHash: hashKey(rawKey) });

      return reply.code(201).send({ id, label, key: rawKey });
    });

    /** DELETE /api-keys/:id */
    instance.delete('/api-keys/:id', async (request, reply) => {
      const deleted = deleteApiKey(db, request.params.id);
      if (!deleted) return reply.code(404).send({ error: 'API key not found' });
      return { ok: true };
    });

    /** GET /jobs */
    instance.get('/jobs', async () => listJobs(db));

    /** DELETE /jobs/:id */
    instance.delete('/jobs/:id', async (request, reply) => {
      const job = getJob(db, request.params.id);
      if (!job) return reply.code(404).send({ error: 'Job not found' });

      if (job.output_path) {
        try { await rm(job.output_path, { force: true }); } catch {}
      }
      deleteJob(db, request.params.id);
      return { ok: true };
    });
  });
}
