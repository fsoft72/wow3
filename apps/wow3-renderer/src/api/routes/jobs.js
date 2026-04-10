import { createReadStream } from 'node:fs';
import { stat, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
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

    const id = randomUUID();
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
