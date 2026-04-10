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
