import Fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
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

  const db = createDb(dbPath);

  // Reset any job that was mid-render when the process last crashed
  resetInterruptedJobs(db);

  const queue = createQueue({ db, renderFn: renderJob, dataDir });

  // Re-trigger queue for any jobs that survived restart
  if (getPendingJobs(db).length > 0) queue.enqueue();

  const cleanup = createCleanup(db);
  cleanup.start();

  const app = Fastify({ logger: true });

  await app.register(fastifyMultipart, { limits: { fileSize: 500 * 1024 * 1024 } });
  await app.register(fastifyCookie);
  await app.register(fastifyStatic, {
    root: join(__dirname, '../admin'),
    prefix: '/admin/',
    decorateReply: false,
  });

  const apiKeyAuth = createApiKeyAuth(db);

  // Public job routes — protected by API key
  await app.register(async (instance) => {
    instance.addHook('preHandler', apiKeyAuth);
    await jobsRoutes(instance, { db, queue, dataDir });
  });

  // Admin routes — login is open, everything else requires session
  await app.register(
    async (instance) => {
      await adminRoutes(instance, { db, jwtSecret, adminUser, adminPass });
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
