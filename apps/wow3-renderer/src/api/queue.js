import { rm, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
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
    const logPath = join(dataDir, 'logs', `${id}.log`);

    await mkdir(join(dataDir, 'logs'), { recursive: true });
    const logStream = createWriteStream(logPath);
    logStream.on('error', (err) =>
      console.error(`[queue] log stream error for ${id}:`, err.message)
    );

    /** Write a timestamped line to the job log. */
    const log = (msg) => logStream.write(`[${new Date().toISOString()}] ${msg}\n`);

    updateJobStatus(db, id, 'running');
    log('Job started');

    try {
      await renderFn({
        inputPath,
        outputPath,
        signal: controller.signal,
        onProgress: (msg) => {
          log(msg);
          const m = msg.match(/Rendering:\s*(\d+)\/(\d+)s/);
          if (m) {
            const pct = Math.round((parseInt(m[1], 10) / parseInt(m[2], 10)) * 100);
            updateJobProgress(db, id, pct);
          }
        },
      });

      log('Job completed');
      updateJobStatus(db, id, 'completed', { outputPath });
    } catch (err) {
      const msg = controller.signal.aborted ? 'cancelled by user' : err.message;
      log(`ERROR: ${msg}`);
      if (!controller.signal.aborted && err.stack) {
        // Write stack lines (skip the first "Error: msg" line, already logged above)
        const stackLines = err.stack.split('\n').slice(1).join('\n');
        if (stackLines) logStream.write(stackLines + '\n');
      }
      updateJobStatus(db, id, 'failed', { error: msg });
      // Partial output (if any) is unusable — remove it so it doesn't show as downloadable
      try { await rm(outputPath, { force: true }); } catch {}
    } finally {
      await new Promise(resolve => logStream.end(resolve));
      try { await rm(inputPath, { force: true }); } catch {}
      current = null;
      running = false;
      // Kick off the next queued job; intentionally not awaited — fire-and-forget.
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
