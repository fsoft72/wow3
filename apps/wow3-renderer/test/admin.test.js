import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { createDb, insertApiKey, insertJob, updateJobStatus } from '../src/api/db.js';
import { hashKey } from '../src/api/middleware/auth.js';
import { createAdminAuth, signAdminToken } from '../src/api/middleware/admin-auth.js';
import { adminRoutes } from '../src/api/routes/admin.js';

const JWT_SECRET = 'test-jwt-secret-32-chars-xxxxxxxx';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'password123';

async function buildApp(db) {
  const app = Fastify({ logger: false });
  await app.register(fastifyCookie);

  // Login/logout without auth protection
  await app.register(
    async (instance) => {
      await adminRoutes(instance, { db, jwtSecret: JWT_SECRET, adminUser: ADMIN_USER, adminPass: ADMIN_PASS });
    },
    { prefix: '/admin' }
  );

  return app;
}

async function buildAuthApp(db, dataDir) {
  const app = Fastify({ logger: false });
  await app.register(fastifyCookie);

  // Login routes (no auth)
  await app.register(
    async (instance) => {
      await adminRoutes(instance, { db, jwtSecret: JWT_SECRET, adminUser: ADMIN_USER, adminPass: ADMIN_PASS, dataDir });
    },
    { prefix: '/admin' }
  );

  return app;
}

async function getSessionCookie(app) {
  const res = await app.inject({
    method: 'POST', url: '/admin/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
  });
  return res.headers['set-cookie'];
}

describe('admin routes — login', () => {
  let db, app;
  beforeEach(async () => { db = createDb(':memory:'); app = await buildApp(db); });

  it('POST /admin/login returns 401 for wrong credentials', async () => {
    const res = await app.inject({
      method: 'POST', url: '/admin/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ username: 'wrong', password: 'wrong' }),
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /admin/login sets httpOnly cookie on success', async () => {
    const res = await app.inject({
      method: 'POST', url: '/admin/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(res.headers['set-cookie']).toMatch(/admin_session=/);
    expect(res.headers['set-cookie']).toMatch(/HttpOnly/i);
  });

  it('POST /admin/logout clears the session cookie', async () => {
    const loginRes = await app.inject({
      method: 'POST', url: '/admin/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
    });
    const cookie = loginRes.headers['set-cookie'];
    const res = await app.inject({
      method: 'POST', url: '/admin/logout',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['set-cookie']).toMatch(/admin_session=;/);
  });
});

describe('admin routes — api-keys (authenticated)', () => {
  let db, app, cookie;

  beforeEach(async () => {
    db = createDb(':memory:');
    app = await buildApp(db);
    cookie = await getSessionCookie(app);
  });

  it('GET /admin/api-keys returns 401 without session', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/api-keys' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /admin/api-keys returns empty list initially', async () => {
    const res = await app.inject({
      method: 'GET', url: '/admin/api-keys',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('GET /admin/api-keys does not expose key_hash', async () => {
    insertApiKey(db, { id: 'k1', label: 'test', keyHash: hashKey('rawkey') });
    const res = await app.inject({
      method: 'GET', url: '/admin/api-keys',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const keys = res.json();
    expect(keys).toHaveLength(1);
    expect(keys[0].key_hash).toBeUndefined();
  });

  it('POST /admin/api-keys creates key and returns raw key once', async () => {
    const res = await app.inject({
      method: 'POST', url: '/admin/api-keys',
      headers: { cookie, 'content-type': 'application/json' },
      payload: JSON.stringify({ label: 'n8n' }),
    });
    expect(res.statusCode).toBe(201);
    const json = res.json();
    expect(json.label).toBe('n8n');
    expect(json.key).toBeTruthy();
    expect(json.key).toHaveLength(32);

    // Verify key works for authentication
    const { findApiKeyByHash } = await import('../src/api/db.js');
    const { hashKey } = await import('../src/api/middleware/auth.js');
    expect(findApiKeyByHash(db, hashKey(json.key))).toBeTruthy();
  });

  it('POST /admin/api-keys returns 400 without label', async () => {
    const res = await app.inject({
      method: 'POST', url: '/admin/api-keys',
      headers: { cookie, 'content-type': 'application/json' },
      payload: JSON.stringify({}),
    });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE /admin/api-keys/:id deletes the key', async () => {
    insertApiKey(db, { id: 'k1', label: 'test', keyHash: hashKey('rawkey') });
    const res = await app.inject({
      method: 'DELETE', url: '/admin/api-keys/k1', headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('DELETE /admin/api-keys/:id returns 404 for missing key', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/admin/api-keys/nope', headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('admin routes — jobs (authenticated)', () => {
  let db, app, cookie, dataDir;

  beforeEach(async () => {
    db = createDb(':memory:');
    dataDir = join(tmpdir(), `wow3-admin-test-${Date.now()}`);
    await mkdir(join(dataDir, 'output'), { recursive: true });
    app = await buildAuthApp(db, dataDir);
    cookie = await getSessionCookie(app);
  });

  afterEach(() => rm(dataDir, { recursive: true, force: true }));

  it('GET /admin/jobs returns all jobs', async () => {
    insertJob(db, { id: 'j1', wow3aName: 'a.wow3a' });
    insertJob(db, { id: 'j2', wow3aName: 'b.wow3a' });
    const res = await app.inject({ method: 'GET', url: '/admin/jobs', headers: { cookie } });
    expect(res.json()).toHaveLength(2);
  });

  it('DELETE /admin/jobs/:id deletes job and mp4 file', async () => {
    const mp4 = join(dataDir, 'output', 'j1.mp4');
    await writeFile(mp4, 'fake');
    insertJob(db, { id: 'j1', wow3aName: 'a.wow3a' });
    updateJobStatus(db, 'j1', 'completed', { outputPath: mp4 });

    const res = await app.inject({ method: 'DELETE', url: '/admin/jobs/j1', headers: { cookie } });
    expect(res.statusCode).toBe(200);

    // File should be gone
    await expect(stat(mp4)).rejects.toThrow();
  });

  it('DELETE /admin/jobs/:id returns 404 for missing job', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/admin/jobs/nope', headers: { cookie } });
    expect(res.statusCode).toBe(404);
  });

  it('GET /admin/jobs/:id/result streams the MP4 when completed', async () => {
    const mp4 = join(dataDir, 'output', 'j2.mp4');
    await writeFile(mp4, Buffer.from('fake-mp4'));
    insertJob(db, { id: 'j2', wow3aName: 'b.wow3a' });
    updateJobStatus(db, 'j2', 'completed', { outputPath: mp4 });

    const res = await app.inject({ method: 'GET', url: '/admin/jobs/j2/result', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('video/mp4');
  });
});
