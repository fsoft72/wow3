import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sirv from 'sirv';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Start a local HTTP server that serves the wow3-animation dist and the input .wow3a file.
 *
 * @param {string} wow3aPath - Absolute path to the .wow3a file to serve
 * @returns {Promise<{port: number, close: () => Promise<void>}>}
 */
export async function startServer(wow3aPath) {
  const distDir = resolve(__dirname, '../../wow3-animation/dist');
  const serve = sirv(distDir, { dev: true, single: false });

  const wow3aBuffer = readFileSync(wow3aPath);

  const server = createServer((req, res) => {
    // Serve the .wow3a file at /input.wow3a
    if (req.url === '/input.wow3a') {
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Length': wow3aBuffer.length,
      });
      res.end(wow3aBuffer);
      return;
    }

    // Everything else: static files from wow3-animation dist
    serve(req, res);
  });

  return new Promise((resolveP) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolveP({
        port,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}
