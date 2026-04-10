# wow3-renderer Docker Service — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `apps/wow3-renderer` with a Fastify HTTP server that exposes the render pipeline as an async job API with single-slot queue, SQLite persistence, 48h cleanup, API key auth, and a WoxGUI admin UI — all packaged in a Docker image for Hetzner.

**Architecture:** A new `src/api/` subtree wraps the existing CLI pipeline (`recorder.js`, `server.js`, `audio.js`) without touching it. A single-slot in-memory queue reads pending jobs from SQLite and executes them one at a time. The admin UI is a single HTML file served at `/admin` using WoxGUI 0.2.2 CDN.

**Tech Stack:** Node 22, Fastify 5, better-sqlite3, @fastify/multipart, @fastify/static, @fastify/cookie, jsonwebtoken, vitest (tests), WoxGUI 0.2.2 CDN, Docker (node:22-slim + chromium + ffmpeg).

---

## File Map

```
apps/wow3-renderer/
  src/
    api/
      app.js                ← Fastify app factory + entry point
      db.js                 ← SQLite schema + all query helpers
      render.js             ← Render pipeline wrapper (extracted from index.js)
      queue.js              ← Single-slot in-process job queue
      cleanup.js            ← Hourly cron: delete jobs/files older than 48h
      middleware/
        auth.js             ← X-API-Key header validation preHandler
        admin-auth.js       ← Admin JWT cookie validation preHandler
      routes/
        jobs.js             ← POST /jobs, GET /jobs/:id/status, GET /jobs/:id/result
        admin.js            ← Admin CRUD: login, logout, api-keys, jobs
    admin/
      index.html            ← WoxGUI 0.2.2 SPA admin interface
  test/
    db.test.js
    queue.test.js
    auth.test.js
    jobs.test.js
    admin.test.js
    cleanup.test.js
  Dockerfile
  docker-compose.yml
```

**Existing files — DO NOT MODIFY:** `src/index.js`, `src/recorder.js`, `src/server.js`, `src/audio.js`.

---

## Task 1: Add server dependencies and vitest

**Files:**
- Modify: `apps/wow3-renderer/package.json`

- [ ] **Step 1: Update package.json**

Replace the full file contents with:

```json
{
  "name": "@wow/wow3-renderer",
  "version": "0.1.0",
  "description": "CLI tool and HTTP service to render wow3-animation presentations to MP4",
  "private": true,
  "type": "module",
  "bin": {
    "wow3-render": "./src/index.js"
  },
  "scripts": {
    "start": "node src/index.js",
    "server": "node src/api/app.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@fastify/cookie": "^11.0.0",
    "@fastify/multipart": "^9.0.0",
    "@fastify/static": "^8.0.0",
    "fastify": "^5.0.0",
    "jsonwebtoken": "^9.0.0",
    "jszip": "^3.10.1",
    "better-sqlite3": "^11.0.0",
    "puppeteer": "^24.0.0",
    "puppeteer-screen-recorder": "^3.0.6",
    "sirv": "^3.0.1"
  },
  "devDependencies": {
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run from the workspace root:
```bash
pnpm install
```

Expected: resolves without errors, `better-sqlite3` and `fastify` appear in `node_modules`.

- [ ] **Step 3: Verify vitest works**

```bash
pnpm --filter @wow/wow3-renderer test
```

Expected: `No test files found` (no tests yet) — exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/wow3-renderer/package.json pnpm-lock.yaml
git commit -m "feat(renderer): add server dependencies and vitest"
```

---

## Task 2: Implement db.js

**Files:**
- Create: `apps/wow3-renderer/src/api/db.js`
- Create: `apps/wow3-renderer/test/db.test.js`

- [ ] **Step 1: Write the failing tests**

Create `apps/wow3-renderer/test/db.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { hashKey } from '../src/api/middleware/auth.js';
import {
  createDb,
  insertApiKey, listApiKeys, deleteApiKey, findApiKeyByHash,
  insertJob, getJob, listJobs, updateJobStatus, updateJobProgress,
  deleteJob, getExpiredJobs, resetInterruptedJobs, getPendingJobs,
} from '../src/api/db.js';

describe('db — api_keys', () => {
  let db;
  beforeEach(() => { db = createDb(':memory:'); });

  it('inserts and lists api keys without exposing key_hash', () => {
    insertApiKey(db, { id: 'k1', label: 'n8n', keyHash: 'abc' });
    const keys = listApiKeys(db);
    expect(keys).toHaveLength(1);
    expect(keys[0].label).toBe('n8n');
    expect(keys[0]).not.toHaveProperty('key_hash');
  });

  it('deletes an existing key and returns true', () => {
    insertApiKey(db, { id: 'k1', label: 'n8n', keyHash: 'abc' });
    expect(deleteApiKey(db, 'k1')).toBe(true);
    expect(listApiKeys(db)).toHaveLength(0);
  });

  it('returns false when deleting a non-existent key', () => {
    expect(deleteApiKey(db, 'missing')).toBe(false);
  });

  it('finds a key by its hash', () => {
    insertApiKey(db, { id: 'k1', label: 'n8n', keyHash: hashKey('rawkey123') });
    expect(findApiKeyByHash(db, hashKey('rawkey123'))).toBeTruthy();
    expect(findApiKeyByHash(db, hashKey('wrong'))).toBeFalsy();
  });
});

describe('db — jobs', () => {
  let db;
  beforeEach(() => { db = createDb(':memory:'); });

  it('inserts a job with status=pending', () => {
    insertJob(db, { id: 'j1', wow3aName: 'test.wow3a' });
    const job = getJob(db, 'j1');
    expect(job.status).toBe('pending');
    expect(job.wow3a_name).toBe('test.wow3a');
    expect(job.progress).toBe(0);
  });

  it('updates status to running and sets started_at', () => {
    insertJob(db, { id: 'j1', wow3aName: 'test.wow3a' });
    updateJobStatus(db, 'j1', 'running');
    const job = getJob(db, 'j1');
    expect(job.status).toBe('running');
    expect(job.started_at).toBeGreaterThan(0);
  });

  it('updates status to completed with output_path and completed_at', () => {
    insertJob(db, { id: 'j1', wow3aName: 'test.wow3a' });
    updateJobStatus(db, 'j1', 'completed', { outputPath: '/data/output/j1.mp4' });
    const job = getJob(db, 'j1');
    expect(job.status).toBe('completed');
    expect(job.output_path).toBe('/data/output/j1.mp4');
    expect(job.completed_at).toBeGreaterThan(0);
  });

  it('updates status to failed with error and completed_at', () => {
    insertJob(db, { id: 'j1', wow3aName: 'test.wow3a' });
    updateJobStatus(db, 'j1', 'failed', { error: 'boom' });
    const job = getJob(db, 'j1');
    expect(job.status).toBe('failed');
    expect(job.error).toBe('boom');
    expect(job.completed_at).toBeGreaterThan(0);
  });

  it('updates progress', () => {
    insertJob(db, { id: 'j1', wow3aName: 'test.wow3a' });
    updateJobProgress(db, 'j1', 42);
    expect(getJob(db, 'j1').progress).toBe(42);
  });

  it('deletes a job and returns true', () => {
    insertJob(db, { id: 'j1', wow3aName: 'test.wow3a' });
    expect(deleteJob(db, 'j1')).toBe(true);
    expect(getJob(db, 'j1')).toBeUndefined();
  });

  it('returns false when deleting non-existent job', () => {
    expect(deleteJob(db, 'nope')).toBe(false);
  });

  it('lists all jobs', () => {
    insertJob(db, { id: 'j1', wow3aName: 'a.wow3a' });
    insertJob(db, { id: 'j2', wow3aName: 'b.wow3a' });
    expect(listJobs(db)).toHaveLength(2);
  });

  it('returns expired jobs older than cutoff', () => {
    const past = Date.now() - 50 * 60 * 60 * 1000; // 50h ago
    db.prepare(
      'INSERT INTO jobs (id, status, wow3a_name, created_at, completed_at) VALUES (?,?,?,?,?)'
    ).run('j1', 'completed', 'old.wow3a', past, past);
    const expired = getExpiredJobs(db, Date.now() - 48 * 60 * 60 * 1000);
    expect(expired).toHaveLength(1);
    expect(expired[0].id).toBe('j1');
  });

  it('does not return jobs newer than cutoff', () => {
    insertJob(db, { id: 'j1', wow3aName: 'new.wow3a' });
    updateJobStatus(db, 'j1', 'completed', { outputPath: '/x.mp4' });
    const expired = getExpiredJobs(db, Date.now() - 48 * 60 * 60 * 1000);
    expect(expired).toHaveLength(0);
  });

  it('resetInterruptedJobs sets running → failed', () => {
    insertJob(db, { id: 'j1', wow3aName: 'x.wow3a' });
    updateJobStatus(db, 'j1', 'running');
    resetInterruptedJobs(db);
    const job = getJob(db, 'j1');
    expect(job.status).toBe('failed');
    expect(job.error).toBe('interrupted by restart');
  });

  it('getPendingJobs returns only pending jobs in insertion order', () => {
    insertJob(db, { id: 'j1', wow3aName: 'a.wow3a' });
    insertJob(db, { id: 'j2', wow3aName: 'b.wow3a' });
    updateJobStatus(db, 'j1', 'running');
    const pending = getPendingJobs(db);
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('j2');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @wow/wow3-renderer test
```

Expected: `Cannot find module '../src/api/db.js'`

- [ ] **Step 3: Create `apps/wow3-renderer/src/api/db.js`**

```js
import Database from 'better-sqlite3';

/**
 * Create and initialise a SQLite database.
 * @param {string} [dbPath=':memory:'] - File path or ':memory:' for tests.
 * @returns {import('better-sqlite3').Database}
 */
export function createDb(dbPath = ':memory:') {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id         TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      key_hash   TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id           TEXT PRIMARY KEY,
      status       TEXT NOT NULL DEFAULT 'pending',
      wow3a_name   TEXT NOT NULL,
      output_path  TEXT,
      progress     INTEGER DEFAULT 0,
      error        TEXT,
      created_at   INTEGER NOT NULL,
      started_at   INTEGER,
      completed_at INTEGER
    );
  `);

  return db;
}

// ---------------------------------------------------------------------------
// api_keys
// ---------------------------------------------------------------------------

/**
 * Insert an API key record.
 * @param {import('better-sqlite3').Database} db
 * @param {{ id: string, label: string, keyHash: string }} opts
 */
export function insertApiKey(db, { id, label, keyHash }) {
  db.prepare(
    'INSERT INTO api_keys (id, label, key_hash, created_at) VALUES (?, ?, ?, ?)'
  ).run(id, label, keyHash, Date.now());
}

/**
 * Delete an API key by id.
 * @returns {boolean} true if a row was deleted
 */
export function deleteApiKey(db, id) {
  return db.prepare('DELETE FROM api_keys WHERE id = ?').run(id).changes > 0;
}

/**
 * List all API keys. key_hash is intentionally excluded.
 * @returns {Array<{ id: string, label: string, created_at: number }>}
 */
export function listApiKeys(db) {
  return db.prepare('SELECT id, label, created_at FROM api_keys ORDER BY created_at DESC').all();
}

/**
 * Find an API key record by its SHA-256 hash.
 * @returns {{ id: string } | undefined}
 */
export function findApiKeyByHash(db, keyHash) {
  return db.prepare('SELECT id FROM api_keys WHERE key_hash = ?').get(keyHash);
}

// ---------------------------------------------------------------------------
// jobs
// ---------------------------------------------------------------------------

/**
 * Insert a new job with status=pending.
 * @param {{ id: string, wow3aName: string }} opts
 */
export function insertJob(db, { id, wow3aName }) {
  db.prepare(
    'INSERT INTO jobs (id, status, wow3a_name, created_at) VALUES (?, ?, ?, ?)'
  ).run(id, 'pending', wow3aName, Date.now());
}

/**
 * Get a single job by id.
 * @returns {object | undefined}
 */
export function getJob(db, id) {
  return db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
}

/**
 * List all jobs newest-first.
 */
export function listJobs(db) {
  return db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
}

/**
 * Update job status, setting timestamps and extra fields as appropriate.
 * @param {'running'|'completed'|'failed'} status
 * @param {{ outputPath?: string, error?: string }} [extra]
 */
export function updateJobStatus(db, id, status, extra = {}) {
  const sets = ['status = ?'];
  const vals = [status];

  if (status === 'running') {
    sets.push('started_at = ?');
    vals.push(Date.now());
  }
  if (status === 'completed') {
    sets.push('completed_at = ?', 'output_path = ?');
    vals.push(Date.now(), extra.outputPath ?? null);
  }
  if (status === 'failed') {
    sets.push('completed_at = ?', 'error = ?');
    vals.push(Date.now(), extra.error ?? 'unknown error');
  }

  vals.push(id);
  db.prepare(`UPDATE jobs SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

/**
 * Update the progress percentage (0-100) of a running job.
 */
export function updateJobProgress(db, id, progress) {
  db.prepare('UPDATE jobs SET progress = ? WHERE id = ?').run(progress, id);
}

/**
 * Delete a job record. Returns true if a row was deleted.
 */
export function deleteJob(db, id) {
  return db.prepare('DELETE FROM jobs WHERE id = ?').run(id).changes > 0;
}

/**
 * Return jobs that are eligible for cleanup:
 * - completed jobs with completed_at older than cutoffMs
 * - failed jobs with created_at older than cutoffMs
 * @param {number} cutoffMs - Unix ms timestamp
 */
export function getExpiredJobs(db, cutoffMs) {
  return db.prepare(`
    SELECT * FROM jobs
    WHERE (status = 'completed' AND completed_at < ?)
       OR (status = 'failed'    AND created_at  < ?)
  `).all(cutoffMs, cutoffMs);
}

/**
 * Reset any job stuck in 'running' state to 'failed'.
 * Called on startup to recover from a previous crash.
 */
export function resetInterruptedJobs(db) {
  db.prepare(`
    UPDATE jobs
    SET status = 'failed', error = 'interrupted by restart', completed_at = ?
    WHERE status = 'running'
  `).run(Date.now());
}

/**
 * Return all pending jobs ordered by creation time (FIFO).
 * @returns {Array<{ id: string }>}
 */
export function getPendingJobs(db) {
  return db.prepare(
    "SELECT id FROM jobs WHERE status = 'pending' ORDER BY created_at ASC"
  ).all();
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @wow/wow3-renderer test
```

Expected: `✓ db — api_keys (4)` and `✓ db — jobs (11)` — all green.

- [ ] **Step 5: Commit**

```bash
git add apps/wow3-renderer/src/api/db.js apps/wow3-renderer/test/db.test.js
git commit -m "feat(renderer): add SQLite db layer with full test coverage"
```

---

## Task 3: Implement render.js

**Files:**
- Create: `apps/wow3-renderer/src/api/render.js`

No unit tests for this module — it wraps Puppeteer and FFmpeg which require integration testing. The existing pipeline is already validated by the CLI.

- [ ] **Step 1: Create `apps/wow3-renderer/src/api/render.js`**

```js
import { readFile, rm, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import JSZip from 'jszip';
import { startServer } from '../server.js';
import { record } from '../recorder.js';
import { extractAudio, mergeAudioVideo, copyVideoOnly } from '../audio.js';

/**
 * Read project dimensions and duration from a .wow3a file.
 * @param {string} inputPath
 * @returns {Promise<{ width: number, height: number, durationMs: number }>}
 */
async function _readProjectInfo(inputPath) {
  const data = await readFile(inputPath);
  const zip = await JSZip.loadAsync(data);
  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error('Invalid .wow3a: missing project.json');

  const project = JSON.parse(await projectFile.async('string'));
  const width = project.width || 1920;
  const height = project.height || 1080;

  let durationMs = project.durationMs || 0;
  if (durationMs <= 0) {
    let max = 0;
    for (const track of project.tracks ?? []) {
      for (const clip of track.clips ?? []) {
        if (clip.endMs != null && clip.endMs > max) max = clip.endMs;
      }
    }
    durationMs = max || 30000;
  }

  return { width, height, durationMs };
}

/**
 * Render a .wow3a file to an MP4.
 *
 * @param {Object} opts
 * @param {string} opts.inputPath  - Absolute path to the .wow3a file
 * @param {string} opts.outputPath - Absolute path for the output .mp4
 * @param {(msg: string) => void} [opts.onProgress] - Progress callback (receives log strings)
 * @returns {Promise<void>}
 */
export async function renderJob({ inputPath, outputPath, onProgress = () => {} }) {
  const tmpVideoPath = join(tmpdir(), `wow3-video-${Date.now()}.mp4`);
  let server;

  await mkdir(dirname(outputPath), { recursive: true });

  try {
    const { width, height } = await _readProjectInfo(inputPath);

    server = await startServer(inputPath);

    await record({ port: server.port, width, height, outputPath: tmpVideoPath, onProgress });

    const audioData = await extractAudio(inputPath);
    if (audioData) {
      try {
        await mergeAudioVideo({ videoPath: tmpVideoPath, clips: audioData.clips, outputPath });
      } finally {
        await rm(audioData.tmpDir, { recursive: true, force: true });
      }
    } else {
      await copyVideoOnly(tmpVideoPath, outputPath);
    }
  } finally {
    if (server) await server.close();
    try { await rm(tmpVideoPath, { force: true }); } catch {}
  }
}
```

- [ ] **Step 2: Confirm existing tests still pass**

```bash
pnpm --filter @wow/wow3-renderer test
```

Expected: all green (no regressions).

- [ ] **Step 3: Commit**

```bash
git add apps/wow3-renderer/src/api/render.js
git commit -m "feat(renderer): extract render pipeline into api/render.js"
```

---

## Task 4: Implement queue.js

**Files:**
- Create: `apps/wow3-renderer/src/api/queue.js`
- Create: `apps/wow3-renderer/test/queue.test.js`

- [ ] **Step 1: Write the failing tests**

Create `apps/wow3-renderer/test/queue.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDb, insertJob, getJob } from '../src/api/db.js';
import { createQueue } from '../src/api/queue.js';

async function wait(ms = 50) {
  return new Promise(r => setTimeout(r, ms));
}

describe('queue', () => {
  let db, dataDir;

  beforeEach(async () => {
    db = createDb(':memory:');
    dataDir = join(tmpdir(), `wow3-q-test-${Date.now()}`);
    await mkdir(join(dataDir, 'uploads'), { recursive: true });
    await mkdir(join(dataDir, 'output'), { recursive: true });
  });

  afterEach(() => rm(dataDir, { recursive: true, force: true }));

  it('processes a pending job and marks it completed', async () => {
    const id = 'j1';
    insertJob(db, { id, wow3aName: 'test.wow3a' });
    await writeFile(join(dataDir, 'uploads', `${id}.wow3a`), 'fake');

    const renderFn = vi.fn().mockResolvedValue(undefined);
    const queue = createQueue({ db, renderFn, dataDir });
    queue.enqueue();

    await wait(100);

    expect(renderFn).toHaveBeenCalledOnce();
    const [call] = renderFn.mock.calls;
    expect(call[0].inputPath).toBe(join(dataDir, 'uploads', `${id}.wow3a`));
    expect(call[0].outputPath).toBe(join(dataDir, 'output', `${id}.mp4`));
    expect(getJob(db, id).status).toBe('completed');
  });

  it('marks job as failed when renderFn throws', async () => {
    const id = 'j2';
    insertJob(db, { id, wow3aName: 'test.wow3a' });
    await writeFile(join(dataDir, 'uploads', `${id}.wow3a`), 'fake');

    const renderFn = vi.fn().mockRejectedValue(new Error('render failed'));
    const queue = createQueue({ db, renderFn, dataDir });
    queue.enqueue();

    await wait(100);

    const job = getJob(db, id);
    expect(job.status).toBe('failed');
    expect(job.error).toBe('render failed');
  });

  it('processes jobs sequentially, not concurrently', async () => {
    const order = [];
    const renderFn = vi.fn().mockImplementation(async ({ inputPath }) => {
      const id = inputPath.split('/').pop().replace('.wow3a', '');
      order.push(`start:${id}`);
      await wait(30);
      order.push(`end:${id}`);
    });

    for (const id of ['a', 'b']) {
      insertJob(db, { id, wow3aName: `${id}.wow3a` });
      await writeFile(join(dataDir, 'uploads', `${id}.wow3a`), 'fake');
    }

    const queue = createQueue({ db, renderFn, dataDir });
    queue.enqueue();

    await wait(200);

    // Strictly sequential: a must start and end before b starts
    expect(order).toEqual(['start:a', 'end:a', 'start:b', 'end:b']);
  });

  it('updates progress from onProgress callback', async () => {
    const id = 'j3';
    insertJob(db, { id, wow3aName: 'test.wow3a' });
    await writeFile(join(dataDir, 'uploads', `${id}.wow3a`), 'fake');

    const renderFn = vi.fn().mockImplementation(async ({ onProgress }) => {
      onProgress('Rendering: 1/5s');
      onProgress('Rendering: 3/5s');
    });

    const queue = createQueue({ db, renderFn, dataDir });
    queue.enqueue();

    await wait(100);

    expect(getJob(db, id).progress).toBe(60); // 3/5 = 60%
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @wow/wow3-renderer test
```

Expected: `Cannot find module '../src/api/queue.js'`

- [ ] **Step 3: Create `apps/wow3-renderer/src/api/queue.js`**

```js
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  getPendingJobs, getJob,
  updateJobStatus, updateJobProgress,
} from './db.js';

/**
 * Create a single-slot in-process job queue.
 *
 * @param {Object} opts
 * @param {import('better-sqlite3').Database} opts.db
 * @param {Function} opts.renderFn - async ({ inputPath, outputPath, onProgress }) => void
 * @param {string} opts.dataDir - Base directory for uploads/ and output/
 * @returns {{ enqueue: () => void }}
 */
export function createQueue({ db, renderFn, dataDir }) {
  let running = false;

  async function runNext() {
    if (running) return;

    const [next] = getPendingJobs(db);
    if (!next) return;

    running = true;
    const { id } = next;
    const inputPath = join(dataDir, 'uploads', `${id}.wow3a`);
    const outputPath = join(dataDir, 'output', `${id}.mp4`);

    updateJobStatus(db, id, 'running');

    try {
      await renderFn({
        inputPath,
        outputPath,
        onProgress: (msg) => {
          const m = msg.match(/Rendering:\s*(\d+)\/(\d+)s/);
          if (m) {
            const pct = Math.round((parseInt(m[1], 10) / parseInt(m[2], 10)) * 100);
            updateJobProgress(db, id, pct);
          }
        },
      });

      updateJobStatus(db, id, 'completed', { outputPath });
    } catch (err) {
      updateJobStatus(db, id, 'failed', { error: err.message });
    } finally {
      try { await rm(inputPath, { force: true }); } catch {}
      running = false;
      // Immediately process the next queued job if any
      runNext();
    }
  }

  /**
   * Signal that a new pending job is available.
   * Safe to call multiple times — only one job runs at a time.
   */
  function enqueue() {
    runNext();
  }

  return { enqueue };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @wow/wow3-renderer test
```

Expected: `✓ queue (4)` — all green.

- [ ] **Step 5: Commit**

```bash
git add apps/wow3-renderer/src/api/queue.js apps/wow3-renderer/test/queue.test.js
git commit -m "feat(renderer): add single-slot job queue with tests"
```

---

## Task 5: Implement auth middleware

**Files:**
- Create: `apps/wow3-renderer/src/api/middleware/auth.js`
- Create: `apps/wow3-renderer/src/api/middleware/admin-auth.js`
- Create: `apps/wow3-renderer/test/auth.test.js`

- [ ] **Step 1: Write the failing tests**

Create `apps/wow3-renderer/test/auth.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDb, insertApiKey } from '../src/api/db.js';
import { hashKey, createApiKeyAuth } from '../src/api/middleware/auth.js';
import { createAdminAuth, signAdminToken } from '../src/api/middleware/admin-auth.js';

function makeReqReply(headers = {}, cookies = {}) {
  const reply = {
    _code: 200,
    _body: null,
    code(n) { this._code = n; return this; },
    send(b) { this._body = b; return this; },
  };
  const request = { headers, cookies };
  return { request, reply };
}

describe('createApiKeyAuth', () => {
  let db, auth;

  beforeEach(() => {
    db = createDb(':memory:');
    insertApiKey(db, { id: 'k1', label: 'test', keyHash: hashKey('good-key') });
    auth = createApiKeyAuth(db);
  });

  it('calls reply.code(401) when X-API-Key header is missing', async () => {
    const { request, reply } = makeReqReply({});
    await auth(request, reply);
    expect(reply._code).toBe(401);
  });

  it('calls reply.code(401) when key is invalid', async () => {
    const { request, reply } = makeReqReply({ 'x-api-key': 'bad-key' });
    await auth(request, reply);
    expect(reply._code).toBe(401);
  });

  it('does not call reply.code when key is valid', async () => {
    const { request, reply } = makeReqReply({ 'x-api-key': 'good-key' });
    await auth(request, reply);
    expect(reply._code).toBe(200);
  });
});

describe('createAdminAuth', () => {
  const SECRET = 'test-secret-32-chars-xxxxxxxxxxxx';
  let auth;

  beforeEach(() => {
    auth = createAdminAuth(SECRET);
  });

  it('calls reply.code(401) when no cookie present', async () => {
    const { request, reply } = makeReqReply({}, {});
    await auth(request, reply);
    expect(reply._code).toBe(401);
  });

  it('calls reply.code(401) when token is invalid', async () => {
    const { request, reply } = makeReqReply({}, { admin_session: 'bad.token.here' });
    await auth(request, reply);
    expect(reply._code).toBe(401);
  });

  it('does not call reply.code when token is valid', async () => {
    const token = signAdminToken(SECRET);
    const { request, reply } = makeReqReply({}, { admin_session: token });
    await auth(request, reply);
    expect(reply._code).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @wow/wow3-renderer test
```

Expected: `Cannot find module '../src/api/middleware/auth.js'`

- [ ] **Step 3: Create `apps/wow3-renderer/src/api/middleware/auth.js`**

```js
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
    }
  };
}
```

- [ ] **Step 4: Create `apps/wow3-renderer/src/api/middleware/admin-auth.js`**

```js
import jwt from 'jsonwebtoken';

/**
 * Sign a short-lived admin JWT.
 * @param {string} jwtSecret
 * @returns {string} signed token
 */
export function signAdminToken(jwtSecret) {
  return jwt.sign({ admin: true }, jwtSecret, { expiresIn: '8h' });
}

/**
 * Fastify preHandler that validates the admin_session httpOnly cookie.
 * @param {string} jwtSecret
 * @returns {import('fastify').preHandlerHookHandler}
 */
export function createAdminAuth(jwtSecret) {
  return async function adminAuth(request, reply) {
    const token = request.cookies?.admin_session;
    if (!token) {
      reply.code(401).send({ error: 'Not authenticated' });
      return;
    }
    try {
      jwt.verify(token, jwtSecret);
    } catch {
      reply.code(401).send({ error: 'Invalid or expired session' });
    }
  };
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pnpm --filter @wow/wow3-renderer test
```

Expected: `✓ createApiKeyAuth (3)` and `✓ createAdminAuth (3)` — all green.

- [ ] **Step 6: Commit**

```bash
git add apps/wow3-renderer/src/api/middleware/
git add apps/wow3-renderer/test/auth.test.js
git commit -m "feat(renderer): add API key and admin JWT auth middleware with tests"
```

---

## Task 6: Implement routes/jobs.js

**Files:**
- Create: `apps/wow3-renderer/src/api/routes/jobs.js`
- Create: `apps/wow3-renderer/test/jobs.test.js`

- [ ] **Step 1: Write the failing tests**

Create `apps/wow3-renderer/test/jobs.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyCookie from '@fastify/cookie';
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @wow/wow3-renderer test
```

Expected: `Cannot find module '../src/api/routes/jobs.js'`

- [ ] **Step 3: Create `apps/wow3-renderer/src/api/routes/jobs.js`**

```js
import { createReadStream } from 'node:fs';
import { stat, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { insertJob, getJob } from '../db.js';

/**
 * Register public job endpoints on the Fastify instance.
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {{ db: object, queue: { enqueue: () => void }, dataDir: string }} opts
 */
export async function jobsRoutes(fastify, { db, queue, dataDir }) {
  /**
   * POST /jobs
   * Accepts a .wow3a file upload, creates a job, enqueues it.
   * Requires X-API-Key header.
   */
  fastify.post('/jobs', async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.code(400).send({ error: 'No file uploaded' });
    if (!data.filename.endsWith('.wow3a')) {
      return reply.code(400).send({ error: 'File must have .wow3a extension' });
    }

    const id = crypto.randomUUID();
    const uploadDir = join(dataDir, 'uploads');
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, `${id}.wow3a`), await data.toBuffer());

    insertJob(db, { id, wow3aName: data.filename });
    queue.enqueue();

    return reply.code(202).send({ jobId: id, status: 'pending' });
  });

  /**
   * GET /jobs/:id/status
   * Returns the current status and progress of a job.
   */
  fastify.get('/jobs/:id/status', async (request, reply) => {
    const job = getJob(db, request.params.id);
    if (!job) return reply.code(404).send({ error: 'Job not found' });

    const response = { jobId: job.id, status: job.status, progress: job.progress };
    if (job.error) response.error = job.error;
    return response;
  });

  /**
   * GET /jobs/:id/result
   * Streams the rendered MP4. Returns 404 if not completed, 410 if file was deleted.
   */
  fastify.get('/jobs/:id/result', async (request, reply) => {
    const job = getJob(db, request.params.id);
    if (!job) return reply.code(404).send({ error: 'Job not found' });
    if (job.status !== 'completed') {
      return reply.code(404).send({ error: `Job is not completed (status: ${job.status})` });
    }

    try {
      await stat(job.output_path);
    } catch {
      return reply.code(410).send({ error: 'Output file has been deleted' });
    }

    const filename = job.wow3a_name.replace(/\.wow3a$/, '.mp4');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    reply.header('Content-Type', 'video/mp4');
    return reply.send(createReadStream(job.output_path));
  });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @wow/wow3-renderer test
```

Expected: `✓ jobs routes (8)` — all green.

- [ ] **Step 5: Commit**

```bash
git add apps/wow3-renderer/src/api/routes/jobs.js apps/wow3-renderer/test/jobs.test.js
git commit -m "feat(renderer): add public job HTTP routes with tests"
```

---

## Task 7: Implement routes/admin.js

**Files:**
- Create: `apps/wow3-renderer/src/api/routes/admin.js`
- Create: `apps/wow3-renderer/test/admin.test.js`

- [ ] **Step 1: Write the failing tests**

Create `apps/wow3-renderer/test/admin.test.js`:

```js
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
    expect(res.headers['set-cookie']).toMatch(/admin_session=/);
    expect(res.headers['set-cookie']).toMatch(/HttpOnly/i);
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
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @wow/wow3-renderer test
```

Expected: `Cannot find module '../src/api/routes/admin.js'`

- [ ] **Step 3: Create `apps/wow3-renderer/src/api/routes/admin.js`**

```js
import { rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
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
 * @param {{ db: object, jwtSecret: string, adminUser: string, adminPass: string }} opts
 */
export async function adminRoutes(fastify, { db, jwtSecret, adminUser, adminPass }) {
  const adminAuth = createAdminAuth(jwtSecret);

  // ── Open routes (no auth required) ───────────────────────────────────────

  /** POST /admin/login */
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

  /** POST /admin/logout */
  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('admin_session', { path: '/' });
    return { ok: true };
  });

  // ── Protected routes (session required) ──────────────────────────────────
  // Registered in a sub-scope so the preHandler hook only applies here.

  fastify.register(async (instance) => {
    instance.addHook('preHandler', adminAuth);

    /** GET /admin/api-keys */
    instance.get('/api-keys', async () => listApiKeys(db));

    /** POST /admin/api-keys */
    instance.post('/api-keys', async (request, reply) => {
      const { label } = request.body ?? {};
      if (!label) return reply.code(400).send({ error: 'label is required' });

      const id = crypto.randomUUID();
      const rawKey = randomBytes(16).toString('hex'); // 32-char hex string
      insertApiKey(db, { id, label, keyHash: hashKey(rawKey) });

      return reply.code(201).send({ id, label, key: rawKey });
    });

    /** DELETE /admin/api-keys/:id */
    instance.delete('/api-keys/:id', async (request, reply) => {
      const deleted = deleteApiKey(db, request.params.id);
      if (!deleted) return reply.code(404).send({ error: 'API key not found' });
      return { ok: true };
    });

    /** GET /admin/jobs */
    instance.get('/jobs', async () => listJobs(db));

    /** DELETE /admin/jobs/:id */
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
```


- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @wow/wow3-renderer test
```

Expected: `✓ admin routes — login (2)`, `✓ admin routes — api-keys (5)`, `✓ admin routes — jobs (3)` — all green.

- [ ] **Step 5: Commit**

```bash
git add apps/wow3-renderer/src/api/routes/admin.js apps/wow3-renderer/test/admin.test.js
git commit -m "feat(renderer): add admin HTTP routes with tests"
```

---

## Task 8: Implement cleanup.js

**Files:**
- Create: `apps/wow3-renderer/src/api/cleanup.js`
- Create: `apps/wow3-renderer/test/cleanup.test.js`

- [ ] **Step 1: Write the failing tests**

Create `apps/wow3-renderer/test/cleanup.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDb, insertJob, updateJobStatus, getJob } from '../src/api/db.js';
import { createCleanup } from '../src/api/cleanup.js';

const FORTY_EIGHT_H = 48 * 60 * 60 * 1000;

describe('cleanup', () => {
  let db, dataDir;

  beforeEach(async () => {
    db = createDb(':memory:');
    dataDir = join(tmpdir(), `wow3-cleanup-test-${Date.now()}`);
    await mkdir(join(dataDir, 'output'), { recursive: true });
  });

  afterEach(() => rm(dataDir, { recursive: true, force: true }));

  it('deletes an expired completed job and its MP4 file', async () => {
    const mp4 = join(dataDir, 'output', 'j1.mp4');
    await writeFile(mp4, 'fake');

    insertJob(db, { id: 'j1', wow3aName: 'x.wow3a' });
    // Manually set completed_at to 50 hours ago
    const past = Date.now() - 50 * FORTY_EIGHT_H / 48;
    db.prepare(
      "UPDATE jobs SET status='completed', output_path=?, completed_at=? WHERE id='j1'"
    ).run(mp4, past);

    const { runCleanup } = createCleanup(db);
    const count = await runCleanup();

    expect(count).toBe(1);
    expect(getJob(db, 'j1')).toBeUndefined();
    await expect(access(mp4)).rejects.toThrow(); // file deleted
  });

  it('does not delete jobs newer than 48h', async () => {
    insertJob(db, { id: 'j1', wow3aName: 'x.wow3a' });
    updateJobStatus(db, 'j1', 'completed', { outputPath: '/nonexistent.mp4' });

    const { runCleanup } = createCleanup(db);
    const count = await runCleanup();

    expect(count).toBe(0);
    expect(getJob(db, 'j1')).toBeTruthy();
  });

  it('deletes an expired failed job', async () => {
    insertJob(db, { id: 'j1', wow3aName: 'x.wow3a' });
    const past = Date.now() - 50 * FORTY_EIGHT_H / 48;
    db.prepare(
      "UPDATE jobs SET status='failed', error='boom', created_at=? WHERE id='j1'"
    ).run(past);

    const { runCleanup } = createCleanup(db);
    const count = await runCleanup();

    expect(count).toBe(1);
  });

  it('does not throw when MP4 file is already gone', async () => {
    insertJob(db, { id: 'j1', wow3aName: 'x.wow3a' });
    const past = Date.now() - 50 * FORTY_EIGHT_H / 48;
    db.prepare(
      "UPDATE jobs SET status='completed', output_path='/already/deleted.mp4', completed_at=? WHERE id='j1'"
    ).run(past);

    const { runCleanup } = createCleanup(db);
    await expect(runCleanup()).resolves.toBe(1); // no throw
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @wow/wow3-renderer test
```

Expected: `Cannot find module '../src/api/cleanup.js'`

- [ ] **Step 3: Create `apps/wow3-renderer/src/api/cleanup.js`**

```js
import { rm } from 'node:fs/promises';
import { getExpiredJobs, deleteJob } from './db.js';

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

/**
 * Create a cleanup handler that deletes expired jobs and their MP4 files.
 * @param {import('better-sqlite3').Database} db
 * @returns {{ start: () => NodeJS.Timeout, runCleanup: () => Promise<number> }}
 */
export function createCleanup(db) {
  /**
   * Run one cleanup pass.
   * @returns {Promise<number>} Number of jobs deleted
   */
  async function runCleanup() {
    const cutoff = Date.now() - FORTY_EIGHT_HOURS_MS;
    const expired = getExpiredJobs(db, cutoff);

    for (const job of expired) {
      if (job.output_path) {
        try { await rm(job.output_path, { force: true }); } catch {}
      }
      deleteJob(db, job.id);
    }

    return expired.length;
  }

  /**
   * Start the hourly cleanup interval.
   * Runs once immediately, then every hour.
   * @returns {NodeJS.Timeout} interval handle (call clearInterval to stop)
   */
  function start() {
    runCleanup();
    return setInterval(runCleanup, 60 * 60 * 1000);
  }

  return { start, runCleanup };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @wow/wow3-renderer test
```

Expected: `✓ cleanup (4)` — all green.

- [ ] **Step 5: Confirm full test suite still passes**

```bash
pnpm --filter @wow/wow3-renderer test
```

Expected: all tests green, no failures.

- [ ] **Step 6: Commit**

```bash
git add apps/wow3-renderer/src/api/cleanup.js apps/wow3-renderer/test/cleanup.test.js
git commit -m "feat(renderer): add 48h cleanup with tests"
```

---

## Task 9: Wire everything in api/app.js

**Files:**
- Create: `apps/wow3-renderer/src/api/app.js`

No separate unit tests — integration is validated by the route tests. Manual smoke-test step below.

- [ ] **Step 1: Create `apps/wow3-renderer/src/api/app.js`**

```js
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
import { createAdminAuth } from './middleware/admin-auth.js';
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
```

- [ ] **Step 2: Run all tests to confirm no regressions**

```bash
pnpm --filter @wow/wow3-renderer test
```

Expected: all tests green.

- [ ] **Step 3: Smoke test — verify the server starts (optional, requires wow3-animation to be built)**

```bash
# Build the animation player first if not already done
pnpm build:animation

# Start the server
DATA_DIR=/tmp/wow3-smoke JWT_SECRET=testsecret ADMIN_USER=admin ADMIN_PASS=admin123 \
  node apps/wow3-renderer/src/api/app.js
```

Expected: `Server listening at http://0.0.0.0:3000`

- [ ] **Step 4: Commit**

```bash
git add apps/wow3-renderer/src/api/app.js
git commit -m "feat(renderer): wire Fastify server entry point"
```

---

## Task 10: Build admin/index.html

**Files:**
- Create: `apps/wow3-renderer/src/admin/index.html`

- [ ] **Step 1: Create `apps/wow3-renderer/src/admin/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>wow3-renderer — Admin</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  <script type="module" src="https://cdn.jsdelivr.net/npm/wox-gui@0.2.2/dist/wox-gui.cdn.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--wox-font);
      background: var(--wox-bg-app);
      color: var(--wox-text-primary);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    #main { display: none; flex-direction: column; flex: 1; overflow: hidden; }
    #main.visible { display: flex; }

    /* Table styles */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--wox-font-size-base);
    }
    .data-table th {
      background: var(--wox-bg-section-header);
      color: var(--wox-text-secondary);
      font-weight: 500;
      text-align: left;
      padding: 8px 12px;
      border-bottom: 1px solid var(--wox-border);
      white-space: nowrap;
    }
    .data-table td {
      padding: 8px 12px;
      border-bottom: 1px solid var(--wox-border-section);
      color: var(--wox-text-primary);
      vertical-align: middle;
    }
    .data-table tr:hover td { background: var(--wox-bg-hover); }
    .table-wrap { overflow-y: auto; flex: 1; }
    .tab-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 12px;
      padding: 16px;
      overflow: hidden;
    }
    .toolbar { display: flex; align-items: center; gap: 8px; }
    .badge-status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: var(--wox-radius-sm);
      font-size: var(--wox-font-size-sm);
      font-weight: 500;
    }
    .s-pending  { background: #333; color: #aaa; }
    .s-running  { background: #1a3a5c; color: var(--wox-accent); }
    .s-completed { background: #1a3c2a; color: #4cc9f0; }
    .s-failed   { background: #3c1a1a; color: var(--wox-danger); }
    .btn-action {
      background: none; border: 1px solid var(--wox-border);
      color: var(--wox-text-secondary); padding: 3px 8px;
      border-radius: var(--wox-radius-sm); cursor: pointer;
      font-size: var(--wox-font-size-sm);
    }
    .btn-action:hover { border-color: var(--wox-accent); color: var(--wox-accent); }
    .btn-danger:hover { border-color: var(--wox-danger); color: var(--wox-danger); }
    .key-mask { font-family: var(--wox-font-mono); color: var(--wox-text-secondary); }
  </style>
</head>
<body>

<!-- Login modal (shown until authenticated) -->
<wox-modal id="loginModal" open title="wow3-renderer Admin" closable="false" width="340px">
  <div style="display:flex; flex-direction:column; gap:12px; padding:4px 0">
    <wox-input id="loginUser" type="text" label="Username" placeholder="admin"></wox-input>
    <wox-input id="loginPass" type="password" label="Password" placeholder="Password"></wox-input>
    <wox-button id="loginBtn" variant="text" icon="login" label="Sign In" style="align-self:flex-end"></wox-button>
  </div>
</wox-modal>

<!-- Main interface (hidden until logged in) -->
<div id="main">
  <wox-menubar>
    <span style="font-weight:600; color:var(--wox-text-hi); padding:0 16px; font-size:var(--wox-font-size-lg)">
      wow3-renderer
    </span>
    <div style="flex:1"></div>
    <wox-button id="logoutBtn" variant="text" icon="logout" label="Logout"
      style="margin-right:8px"></wox-button>
  </wox-menubar>

  <div style="flex:1; overflow:hidden; display:flex; flex-direction:column;">
    <wox-tabs id="tabs" active="jobs" style="flex:1; overflow:hidden;">

      <!-- Jobs tab -->
      <wox-tab name="jobs" label="Jobs" icon="video_file">
        <div class="tab-content">
          <div class="toolbar">
            <span style="color:var(--wox-text-secondary); font-size:var(--wox-font-size-sm)" id="jobsStatus">
              Loading...
            </span>
            <div style="flex:1"></div>
            <wox-button id="refreshBtn" variant="icon" icon="refresh"></wox-button>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>File</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Created</th>
                  <th>Duration</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="jobsBody"></tbody>
            </table>
          </div>
        </div>
      </wox-tab>

      <!-- API Keys tab -->
      <wox-tab name="keys" label="API Keys" icon="key">
        <div class="tab-content">
          <div class="toolbar">
            <wox-button id="newKeyBtn" variant="text" icon="add" label="New API Key"></wox-button>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="keysBody"></tbody>
            </table>
          </div>
        </div>
      </wox-tab>

    </wox-tabs>
  </div>

  <wox-statusbar>
    <span slot="left" id="statusLeft">Ready</span>
  </wox-statusbar>
</div>

<!-- New API Key modal -->
<wox-modal id="newKeyModal" title="New API Key" width="360px">
  <div style="display:flex; flex-direction:column; gap:12px; padding:4px 0">
    <wox-input id="keyLabel" type="text" label="Label" placeholder="e.g. n8n production"></wox-input>
  </div>
  <div slot="footer" style="display:flex; gap:8px; justify-content:flex-end">
    <wox-button id="newKeyCancel" variant="text" label="Cancel"></wox-button>
    <wox-button id="newKeyConfirm" variant="text" icon="add" label="Create"></wox-button>
  </div>
</wox-modal>

<!-- Created key display modal -->
<wox-modal id="createdKeyModal" title="API Key Created" width="480px" closable="false">
  <div style="display:flex; flex-direction:column; gap:12px; padding:4px 0">
    <p style="color:var(--wox-text-secondary); font-size:var(--wox-font-size-base)">
      Copy this key now — it will not be shown again.
    </p>
    <div style="display:flex; gap:8px; align-items:center">
      <wox-input id="createdKeyValue" type="text" style="flex:1"></wox-input>
      <wox-button id="copyKeyBtn" variant="icon" icon="content_copy"></wox-button>
    </div>
  </div>
  <div slot="footer" style="display:flex; justify-content:flex-end">
    <wox-button id="createdKeyClose" variant="text" label="Done"></wox-button>
  </div>
</wox-modal>

<!-- Delete confirmation modal -->
<wox-modal id="confirmModal" title="Confirm Delete" width="340px">
  <p id="confirmMsg" style="color:var(--wox-text-secondary)"></p>
</wox-modal>

<script type="module">
// ── API helpers ──────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

// ── State ────────────────────────────────────────────────────────────────────

let refreshTimer = null;

// ── Formatting helpers ───────────────────────────────────────────────────────

function fmtDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString();
}

function fmtDuration(startMs, endMs) {
  if (!startMs || !endMs) return '—';
  const s = Math.round((endMs - startMs) / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

// ── Login ────────────────────────────────────────────────────────────────────

document.getElementById('loginBtn').addEventListener('wox-click', async () => {
  const username = document.getElementById('loginUser').value;
  const password = document.getElementById('loginPass').value;
  try {
    await api('POST', '/admin/login', { username, password });
    document.getElementById('loginModal').removeAttribute('open');
    document.getElementById('main').classList.add('visible');
    loadJobs();
    startAutoRefresh();
  } catch {
    WoxToast.error('Invalid credentials');
  }
});

// Allow Enter key on password field
document.getElementById('loginPass').addEventListener('wox-change', () => {
  document.getElementById('loginBtn').dispatchEvent(new CustomEvent('wox-click'));
});

document.getElementById('logoutBtn').addEventListener('wox-click', async () => {
  await api('POST', '/admin/logout');
  location.reload();
});

// ── Jobs ─────────────────────────────────────────────────────────────────────

async function loadJobs() {
  try {
    const jobs = await api('GET', '/admin/jobs');
    renderJobs(jobs);
    const running = jobs.filter(j => j.status === 'running').length;
    const pending = jobs.filter(j => j.status === 'pending').length;
    document.getElementById('jobsStatus').textContent =
      `${jobs.length} total · ${running} running · ${pending} queued`;
    document.getElementById('statusLeft').textContent =
      `${jobs.length} jobs`;
  } catch (e) {
    WoxToast.error(`Failed to load jobs: ${e.message}`);
  }
}

function renderJobs(jobs) {
  const tbody = document.getElementById('jobsBody');
  tbody.innerHTML = '';
  for (const j of jobs) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family:var(--wox-font-mono);font-size:var(--wox-font-size-sm)">${j.id.slice(0, 8)}</td>
      <td>${j.wow3a_name}</td>
      <td><span class="badge-status s-${j.status}">${j.status}</span></td>
      <td>${j.status === 'running' ? j.progress + '%' : '—'}</td>
      <td style="color:var(--wox-text-secondary)">${fmtDate(j.created_at)}</td>
      <td>${fmtDuration(j.started_at, j.completed_at)}</td>
      <td style="display:flex;gap:4px;flex-wrap:wrap">
        ${j.status === 'completed'
          ? `<button class="btn-action" data-action="download" data-id="${j.id}" data-name="${j.wow3a_name}">Download</button>`
          : ''}
        <button class="btn-action btn-danger" data-action="delete-job" data-id="${j.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
  tbody.addEventListener('click', onJobAction);
}

async function onJobAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'download') {
    const a = document.createElement('a');
    a.href = `/jobs/${btn.dataset.id}/result`;
    a.download = btn.dataset.name.replace('.wow3a', '.mp4');
    a.click();
  }
  if (btn.dataset.action === 'delete-job') {
    const confirmed = await confirm(`Delete job ${btn.dataset.id.slice(0, 8)}?`);
    if (!confirmed) return;
    try {
      await api('DELETE', `/admin/jobs/${btn.dataset.id}`);
      WoxToast.success('Job deleted');
      loadJobs();
    } catch (err) {
      WoxToast.error(err.message);
    }
  }
}

document.getElementById('refreshBtn').addEventListener('wox-click', loadJobs);

// ── API Keys ─────────────────────────────────────────────────────────────────

async function loadKeys() {
  try {
    const keys = await api('GET', '/admin/api-keys');
    renderKeys(keys);
  } catch (e) {
    WoxToast.error(`Failed to load API keys: ${e.message}`);
  }
}

function renderKeys(keys) {
  const tbody = document.getElementById('keysBody');
  tbody.innerHTML = '';
  for (const k of keys) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${k.label}</td>
      <td style="color:var(--wox-text-secondary)">${fmtDate(k.created_at)}</td>
      <td>
        <button class="btn-action btn-danger" data-action="delete-key" data-id="${k.id}" data-label="${k.label}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
  tbody.addEventListener('click', onKeyAction);
}

async function onKeyAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.dataset.action !== 'delete-key') return;
  const confirmed = await confirm(`Delete API key "${btn.dataset.label}"?`);
  if (!confirmed) return;
  try {
    await api('DELETE', `/admin/api-keys/${btn.dataset.id}`);
    WoxToast.success('API key deleted');
    loadKeys();
  } catch (err) {
    WoxToast.error(err.message);
  }
}

// New key flow
document.getElementById('newKeyBtn').addEventListener('wox-click', () => {
  document.getElementById('keyLabel').value = '';
  document.getElementById('newKeyModal').setAttribute('open', '');
});

document.getElementById('newKeyCancel').addEventListener('wox-click', () => {
  document.getElementById('newKeyModal').removeAttribute('open');
});

document.getElementById('newKeyConfirm').addEventListener('wox-click', async () => {
  const label = document.getElementById('keyLabel').value.trim();
  if (!label) { WoxToast.warning('Label is required'); return; }
  try {
    const { key } = await api('POST', '/admin/api-keys', { label });
    document.getElementById('newKeyModal').removeAttribute('open');
    document.getElementById('createdKeyValue').value = key;
    document.getElementById('createdKeyModal').setAttribute('open', '');
    loadKeys();
  } catch (err) {
    WoxToast.error(err.message);
  }
});

document.getElementById('copyKeyBtn').addEventListener('wox-click', () => {
  const val = document.getElementById('createdKeyValue').value;
  navigator.clipboard.writeText(val).then(() => WoxToast.success('Key copied to clipboard!'));
});

document.getElementById('createdKeyClose').addEventListener('wox-click', () => {
  document.getElementById('createdKeyModal').removeAttribute('open');
});

// ── Tab switching ────────────────────────────────────────────────────────────

document.getElementById('tabs').addEventListener('wox-tab-change', (e) => {
  if (e.detail.name === 'keys') loadKeys();
  if (e.detail.name === 'jobs') loadJobs();
});

// ── Auto refresh ─────────────────────────────────────────────────────────────

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (document.getElementById('tabs').getAttribute('active') === 'jobs') {
      loadJobs();
    }
  }, 10000);
}
</script>
</body>
</html>
```

- [ ] **Step 2: Run all tests to confirm nothing broke**

```bash
pnpm --filter @wow/wow3-renderer test
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add apps/wow3-renderer/src/admin/index.html
git commit -m "feat(renderer): add WoxGUI admin UI"
```

---

## Task 11: Dockerfile and docker-compose.yml

**Files:**
- Create: `apps/wow3-renderer/Dockerfile`
- Create: `apps/wow3-renderer/docker-compose.yml`
- Create: `apps/wow3-renderer/.dockerignore`

- [ ] **Step 1: Create `apps/wow3-renderer/.dockerignore`**

```
node_modules
test
*.test.js
.env
```

- [ ] **Step 2: Create `apps/wow3-renderer/Dockerfile`**

```dockerfile
FROM node:22-slim

# Install Chromium (used by Puppeteer) and FFmpeg
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copy workspace manifests for pnpm resolution
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/wow3-renderer/package.json ./apps/wow3-renderer/

# Only package.json needed — renderer does not import @wow/core source
COPY packages/wow-core/package.json ./packages/wow-core/package.json

RUN npm install -g pnpm@10.32.1 && \
    pnpm install --frozen-lockfile --filter @wow/wow3-renderer

# Copy renderer source
COPY apps/wow3-renderer/src ./apps/wow3-renderer/src

# Copy pre-built animation player (must run `pnpm build:animation` before docker build)
COPY apps/wow3-animation/dist ./apps/wow3-animation/dist

VOLUME ["/data"]
EXPOSE 3000

ENV DATA_DIR=/data
ENV PORT=3000

CMD ["node", "apps/wow3-renderer/src/api/app.js"]
```

- [ ] **Step 3: Create `apps/wow3-renderer/docker-compose.yml`**

```yaml
services:
  wow3-renderer:
    build:
      context: ../..
      dockerfile: apps/wow3-renderer/Dockerfile
    ports:
      - "${PORT:-3000}:3000"
    volumes:
      - renderer-data:/data
    env_file:
      - .env
    restart: unless-stopped

volumes:
  renderer-data:
```

- [ ] **Step 4: Create `.env.example` for Hetzner setup documentation**

Create `apps/wow3-renderer/.env.example`:

```
# Required
ADMIN_USER=admin
ADMIN_PASS=change-me-strong-password
JWT_SECRET=change-me-at-least-32-chars-random-string

# Optional
PORT=3000
DATA_DIR=/data
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

- [ ] **Step 5: Build the animation player (prerequisite for Docker)**

```bash
pnpm build:animation
```

Expected: `apps/wow3-animation/dist/` directory exists with `index.html` and assets.

- [ ] **Step 6: Build the Docker image**

From the workspace root:
```bash
docker build -f apps/wow3-renderer/Dockerfile -t wow3-renderer:latest .
```

Expected: image builds without errors. Takes ~2-3 minutes the first time (downloading Chromium via apt).

- [ ] **Step 7: Smoke test the Docker image locally**

```bash
docker run --rm \
  -e ADMIN_USER=admin \
  -e ADMIN_PASS=admin123 \
  -e JWT_SECRET=local-test-secret-32-chars-xxxxx \
  -p 3000:3000 \
  wow3-renderer:latest
```

Expected output: `Server listening at http://0.0.0.0:3000`

Open `http://localhost:3000/admin` in a browser. You should see the WoxGUI login screen.

- [ ] **Step 8: Commit**

```bash
git add apps/wow3-renderer/Dockerfile \
        apps/wow3-renderer/docker-compose.yml \
        apps/wow3-renderer/.dockerignore \
        apps/wow3-renderer/.env.example
git commit -m "feat(renderer): add Dockerfile and docker-compose for Hetzner deployment"
```

---

## Deployment on Hetzner

After the image builds successfully:

```bash
# Save image to file
docker save wow3-renderer:latest | gzip > wow3-renderer.tar.gz

# Copy to Hetzner server
scp wow3-renderer.tar.gz user@your-hetzner-ip:~/

# On the Hetzner server:
ssh user@your-hetzner-ip
docker load < wow3-renderer.tar.gz
mkdir -p ~/wow3-renderer
# Create .env from .env.example with real values
cp .env.example .env && nano .env
# Start
docker compose -f docker-compose.yml up -d
```

## n8n Integration

In n8n, use an **HTTP Request** node:

| Field | Value |
|-------|-------|
| Method | POST |
| URL | `http://<hetzner-ip>:3000/jobs` |
| Header | `X-API-Key: <key-from-admin-ui>` |
| Body Content Type | Form-Data Multipart |
| Parameter name | `file` |
| Parameter type | Binary |

Then poll `GET /jobs/{{ $json.jobId }}/status` with the returned `jobId` until `status === "completed"`, then download from `GET /jobs/{{ $json.jobId }}/result`.
