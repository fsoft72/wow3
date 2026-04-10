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
