import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  getJob, getPendingJobs,
  updateJobStatus, updateJobProgress,
} from './db.js';

/**
 * Create a single-slot in-process job queue.
 *
 * @param {Object} opts
 * @param {import('better-sqlite3').Database} opts.db
 * @param {Function} opts.renderFn - async ({ inputPath, outputPath, signal, onProgress }) => void
 * @param {string} opts.dataDir - Base directory for uploads/ and output/
 * @returns {{ enqueue: () => void, kill: (id: string) => boolean }}
 */
export function createQueue({ db, renderFn, dataDir }) {
  let running = false;
  /** @type {{ id: string, controller: AbortController } | null} */
  let current = null;

  async function runNext() {
    if (running) return;

    const [next] = getPendingJobs(db);
    if (!next) return;

    running = true;
    const { id } = next;
    const controller = new AbortController();
    current = { id, controller };
    const inputPath = join(dataDir, 'uploads', `${id}.wow3a`);
    const outputPath = join(dataDir, 'output', `${id}.mp4`);

    updateJobStatus(db, id, 'running');

    try {
      await renderFn({
        inputPath,
        outputPath,
        signal: controller.signal,
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
      const msg = controller.signal.aborted ? 'cancelled by user' : err.message;
      updateJobStatus(db, id, 'failed', { error: msg });
      // Partial output (if any) is unusable — remove it so it doesn't show as downloadable
      try { await rm(outputPath, { force: true }); } catch {}
    } finally {
      try { await rm(inputPath, { force: true }); } catch {}
      current = null;
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

  /**
   * Abort a job.
   * - If it's the running job, aborts the in-flight render via AbortSignal.
   * - If it's a pending job, marks it failed so runNext() will skip it.
   *
   * @param {string} id
   * @returns {boolean} true when the job was killed or marked cancelled
   */
  function kill(id) {
    if (current && current.id === id) {
      current.controller.abort();
      return true;
    }
    const job = getJob(db, id);
    if (job && job.status === 'pending') {
      updateJobStatus(db, id, 'failed', { error: 'cancelled by user' });
      return true;
    }
    return false;
  }

  return { enqueue, kill };
}
