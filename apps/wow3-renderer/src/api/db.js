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
