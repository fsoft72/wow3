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
