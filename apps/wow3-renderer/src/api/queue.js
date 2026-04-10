import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  getPendingJobs,
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
