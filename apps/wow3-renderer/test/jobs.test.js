import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyCookie from '@fastify/cookie';
import JSZip from 'jszip';
import { createDb, insertApiKey, insertJob, updateJobStatus } from '../src/api/db.js';
import { hashKey } from '../src/api/middleware/auth.js';
import { createApiKeyAuth } from '../src/api/middleware/auth.js';
import { jobsRoutes } from '../src/api/routes/jobs.js';

async function buildApp(db, queue, dataDir) {
  const app = Fastify({ logger: false });
  await app.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await app.register(fastifyCookie);
  app.addHook('preHandler', createApiKeyAuth(db));
  await jobsRoutes(app, { db, queue, dataDir });
  return app;
}

const API_KEY = 'test-api-key-123';
const AUTH = { 'x-api-key': API_KEY };

describe('jobs routes', () => {
  let db, dataDir, queue, app;

  beforeEach(async () => {
    db = createDb(':memory:');
    insertApiKey(db, { id: 'k1', label: 'test', keyHash: hashKey(API_KEY) });

    dataDir = join(tmpdir(), `wow3-jobs-test-${Date.now()}`);
    await mkdir(join(dataDir, 'uploads'), { recursive: true });
    await mkdir(join(dataDir, 'output'), { recursive: true });

    queue = { enqueue: vi.fn() };
    app = await buildApp(db, queue, dataDir);
  });

  afterEach(() => rm(dataDir, { recursive: true, force: true }));

  // POST /jobs
  it('POST /jobs returns 401 without API key', async () => {
    const res = await app.inject({ method: 'POST', url: '/jobs' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /jobs returns 400 when no file is attached', async () => {
    const boundary = 'b1';
    const res = await app.inject({
      method: 'POST', url: '/jobs',
      headers: { ...AUTH, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: `--${boundary}--\r\n`,
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /jobs returns 400 for non-.wow3a file', async () => {
    const boundary = 'b2';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test.txt"',
      'Content-Type: text/plain',
      '',
      'hello',
      `--${boundary}--`,
    ].join('\r\n');

    const res = await app.inject({
      method: 'POST', url: '/jobs',
      headers: { ...AUTH, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /jobs accepts a .json file upload and wraps it in .wow3a', async () => {
    const projectJson = JSON.stringify({ title: 'Test Project', tracks: [] });
    const boundary = 'bj';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="project.json"',
      'Content-Type: application/json',
      '',
      projectJson,
      `--${boundary}--`,
    ].join('\r\n');

    const res = await app.inject({
      method: 'POST', url: '/jobs',
      headers: { ...AUTH, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });

    expect(res.statusCode).toBe(202);
    const json = res.json();
    expect(json.jobId).toBeTruthy();
    expect(json.status).toBe('pending');

    // Verify the saved file is a valid ZIP containing project.json
    const savedPath = join(dataDir, 'uploads', `${json.jobId}.wow3a`);
    const zipBuf = await readFile(savedPath);
    const zip = await JSZip.loadAsync(zipBuf);
    const pj = JSON.parse(await zip.file('project.json').async('string'));
    expect(pj.title).toBe('Test Project');
  });

  it('POST /jobs accepts a JSON body (application/json)', async () => {
    const projectData = { title: 'JSON Body Test', tracks: [] };

    const res = await app.inject({
      method: 'POST', url: '/jobs',
      headers: { ...AUTH, 'content-type': 'application/json' },
      payload: JSON.stringify(projectData),
    });

    expect(res.statusCode).toBe(202);
    const json = res.json();
    expect(json.jobId).toBeTruthy();

    // Verify the saved file is a valid ZIP
    const savedPath = join(dataDir, 'uploads', `${json.jobId}.wow3a`);
    const zipBuf = await readFile(savedPath);
    const zip = await JSZip.loadAsync(zipBuf);
    const pj = JSON.parse(await zip.file('project.json').async('string'));
    expect(pj.title).toBe('JSON Body Test');
  });

  it('POST /jobs creates a job, saves file, enqueues, returns 202', async () => {
    const boundary = 'b3';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="pres.wow3a"',
      'Content-Type: application/octet-stream',
      '',
      'fakedata',
      `--${boundary}--`,
    ].join('\r\n');

    const res = await app.inject({
      method: 'POST', url: '/jobs',
      headers: { ...AUTH, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });

    expect(res.statusCode).toBe(202);
    const json = res.json();
    expect(json.jobId).toBeTruthy();
    expect(json.status).toBe('pending');
    expect(queue.enqueue).toHaveBeenCalledOnce();
  });

  // GET /jobs/:id/status
  it('GET /jobs/:id/status returns 404 for unknown job', async () => {
    const res = await app.inject({
      method: 'GET', url: '/jobs/nonexistent/status', headers: AUTH,
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /jobs/:id/status returns job status and progress', async () => {
    insertJob(db, { id: 'j1', wow3aName: 'test.wow3a' });
    const res = await app.inject({
      method: 'GET', url: '/jobs/j1/status', headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('pending');
    expect(json.progress).toBe(0);
  });

  // GET /jobs/:id/result
  it('GET /jobs/:id/result returns 404 for non-completed job', async () => {
    insertJob(db, { id: 'j1', wow3aName: 'test.wow3a' });
    const res = await app.inject({
      method: 'GET', url: '/jobs/j1/result', headers: AUTH,
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /jobs/:id/result returns 410 when file has been deleted', async () => {
    insertJob(db, { id: 'j1', wow3aName: 'test.wow3a' });
    updateJobStatus(db, 'j1', 'completed', { outputPath: '/nonexistent/path.mp4' });
    const res = await app.inject({
      method: 'GET', url: '/jobs/j1/result', headers: AUTH,
    });
    expect(res.statusCode).toBe(410);
  });

  it('GET /jobs/:id/result streams the MP4 when completed', async () => {
    const mp4Path = join(dataDir, 'output', 'j1.mp4');
    await writeFile(mp4Path, Buffer.from('fake-mp4-data'));

    insertJob(db, { id: 'j1', wow3aName: 'test.wow3a' });
    updateJobStatus(db, 'j1', 'completed', { outputPath: mp4Path });

    const res = await app.inject({
      method: 'GET', url: '/jobs/j1/result', headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('video/mp4');
    expect(res.rawPayload.toString()).toBe('fake-mp4-data');
  });
});
