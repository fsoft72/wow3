import Fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import fastifyRateLimit from '@fastify/rate-limit';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import {
  createDb, resetInterruptedJobs, getPendingJobs,
} from './db.js';
import { createQueue } from './queue.js';
import { createCleanup } from './cleanup.js';
import { createApiKeyAuth } from './middleware/auth.js';
import { jobsRoutes } from './routes/jobs.js';
import { adminRoutes } from './routes/admin.js';
import { renderJob } from './render.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Build and configure the Fastify application.
 *
 * @param {Object} opts
 * @param {string} opts.dbPath       - Path to SQLite file
 * @param {string} opts.dataDir      - Root directory for uploads/ and output/
 * @param {string} opts.jwtSecret    - Secret for signing admin JWTs
 * @param {string} opts.adminUser    - Admin username
 * @param {string} opts.adminPass    - Admin password
 * @returns {Promise<import('fastify').FastifyInstance>}
 */
export async function buildApp({ dbPath, dataDir, jwtSecret, adminUser, adminPass }) {
  await mkdir(join(dataDir, 'uploads'), { recursive: true });
  await mkdir(join(dataDir, 'output'), { recursive: true });
  await mkdir(join(dataDir, 'logs'), { recursive: true });

  const db = createDb(dbPath);

  // Reset any job that was mid-render when the process last crashed
  resetInterruptedJobs(db);

  const queue = createQueue({ db, renderFn: renderJob, dataDir });

  // Re-trigger queue for any jobs that survived restart
  if (getPendingJobs(db).length > 0) queue.enqueue();

  const cleanup = createCleanup(db, dataDir);
  const cleanupInterval = cleanup.start();
  cleanupInterval.unref();

  const app = Fastify({ logger: true });

  await app.register(fastifyMultipart, { limits: { fileSize: 500 * 1024 * 1024 } });
  await app.register(fastifyCookie);
  await app.register(fastifyStatic, {
    root: join(__dirname, '../admin'),
    prefix: '/admin/',
    decorateReply: false,
  });

  // CSP for the admin SPA
  const ADMIN_CSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  app.addHook('onSend', (request, reply, payload, done) => {
    if (request.url.startsWith('/admin')) {
      reply.header('Content-Security-Policy', ADMIN_CSP);
      reply.header('X-Frame-Options', 'DENY');
      reply.header('X-Content-Type-Options', 'nosniff');
    }
    done(null, payload);
  });

  // Redirect bare /admin to /admin/ so the SPA loads correctly
  app.get('/admin', (req, reply) => reply.redirect('/admin/'));

  const apiKeyAuth = createApiKeyAuth(db);

  // Public job routes — protected by API key, rate-limited on POST /jobs
  await app.register(async (instance) => {
    instance.addHook('preHandler', apiKeyAuth);
    await instance.register(fastifyRateLimit, {
      max: 20,
      timeWindow: '1 minute',
      keyGenerator: (request) => request.headers['x-api-key'] ?? request.ip,
    });
    await jobsRoutes(instance, { db, queue, dataDir });
  });

  // Admin routes — login is open, everything else requires session
  await app.register(
    async (instance) => {
      await adminRoutes(instance, { db, queue, jwtSecret, adminUser, adminPass, dataDir });
    },
    { prefix: '/admin' }
  );

  return app;
}

// ── Entry point ──────────────────────────────────────────────────────────────
// Only runs when executed directly: node src/api/app.js

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = parseInt(process.env.PORT ?? '3000', 10);
  const dataDir = process.env.DATA_DIR ?? '/data';
  const jwtSecret = process.env.JWT_SECRET;
  const adminUser = process.env.ADMIN_USER;
  const adminPass = process.env.ADMIN_PASS;

  if (!jwtSecret || !adminUser || !adminPass) {
    console.error('Error: JWT_SECRET, ADMIN_USER, and ADMIN_PASS environment variables are required');
    process.exit(1);
  }

  const app = await buildApp({
    dbPath: join(dataDir, 'wow3.db'),
    dataDir,
    jwtSecret,
    adminUser,
    adminPass,
  });

  await app.listen({ port, host: '0.0.0.0' });
}
