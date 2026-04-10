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
