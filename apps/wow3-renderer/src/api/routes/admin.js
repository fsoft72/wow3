import { rm, readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  listApiKeys, insertApiKey, deleteApiKey,
  listJobs, getJob, deleteJob,
} from '../db.js';
import { hashKey } from '../middleware/auth.js';
import { signAdminToken, createAdminAuth } from '../middleware/admin-auth.js';

/**
 * Register admin endpoints.
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {{ db: object, queue: object, jwtSecret: string, adminUser: string, adminPass: string, dataDir: string }} opts
 */
export async function adminRoutes(fastify, { db, queue, jwtSecret, adminUser, adminPass, dataDir }) {
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

    /** GET /jobs/:id/result — stream the MP4 file for completed jobs */
    instance.get('/jobs/:id/result', async (request, reply) => {
      const job = getJob(db, request.params.id);
      if (!job) return reply.code(404).send({ error: 'Job not found' });
      if (job.status !== 'completed') {
        return reply.code(404).send({ error: `Job is not completed (status: ${job.status})` });
      }

      let accessible = false;
      try { await stat(job.output_path); accessible = true; } catch {}
      if (!accessible) return reply.code(410).send({ error: 'Output file has been deleted' });

      const filename = job.wow3a_name.replace(/\.wow3a$/, '.mp4');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.header('Content-Type', 'video/mp4');
      return reply.send(createReadStream(job.output_path));
    });

    /** GET /jobs/:id/log — return the plain-text log file for a job */
    instance.get('/jobs/:id/log', async (request, reply) => {
      const job = getJob(db, request.params.id);
      if (!job) return reply.code(404).send({ error: 'Job not found' });

      const logPath = join(dataDir, 'logs', `${request.params.id}.log`);
      let content;
      try {
        content = await readFile(logPath, 'utf-8');
      } catch (err) {
        if (err.code === 'ENOENT') {
          return reply.code(404).send({ error: 'no log available' });
        }
        throw err;
      }
      reply.header('Content-Type', 'text/plain; charset=utf-8');
      return reply.send(content);
    });

    /** DELETE /jobs/:id */
    instance.delete('/jobs/:id', async (request, reply) => {
      const job = getJob(db, request.params.id);
      if (!job) return reply.code(404).send({ error: 'Job not found' });

      if (job.status === 'running' || job.status === 'pending') {
        queue.kill(request.params.id);
      }

      if (job.output_path) {
        try { await rm(job.output_path, { force: true }); } catch {}
      }
      try {
        await rm(join(dataDir, 'logs', `${request.params.id}.log`), { force: true });
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.warn(`[admin] failed to delete log for ${request.params.id}:`, err.message);
        }
      }
      deleteJob(db, request.params.id);
      return { ok: true };
    });

    /** POST /jobs/:id/kill — abort a running or pending job */
    instance.post('/jobs/:id/kill', async (request, reply) => {
      const job = getJob(db, request.params.id);
      if (!job) return reply.code(404).send({ error: 'Job not found' });
      if (job.status !== 'running' && job.status !== 'pending') {
        return reply.code(409).send({ error: `Job is not running (status: ${job.status})` });
      }
      const killed = queue.kill(request.params.id);
      if (!killed) return reply.code(409).send({ error: 'Job could not be cancelled' });
      return { ok: true };
    });
  });
}
