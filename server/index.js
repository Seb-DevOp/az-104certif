// Static file server for the AZ-104 trainer, sized for Cloud Run.
//
// No framework and no dependencies: the app is a static SPA plus a JSON question bank, so
// the whole server is a read-only file handler with sensible cache headers and a health
// endpoint. Fewer moving parts means a smaller image and nothing to keep patched.
import { createReadStream, promises as fs } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.map']);

/**
 * Vite emits content-hashed asset names, and the exhibit screenshots are named after a hash
 * of their pixels, so both are safe to cache hard. The question bank and the translation
 * files keep stable names and do change between deploys, so they must revalidate — the ETag
 * makes that a cheap 304 rather than a re-download.
 */
function cacheControl(urlPath, ext) {
  if (urlPath.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  if (urlPath.startsWith('/img/')) return 'public, max-age=604800, immutable';
  if (urlPath.startsWith('/data/') || ext === '.html') return 'no-cache';
  return 'public, max-age=3600';
}

/** Resolves a URL to a file inside ROOT, or null if it escapes or does not exist. */
async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const candidate = path.resolve(ROOT, `.${path.posix.normalize(decoded)}`);
  if (candidate !== ROOT && !candidate.startsWith(ROOT + path.sep)) return null;
  try {
    const stat = await fs.stat(candidate);
    if (stat.isDirectory()) return resolveFile(path.posix.join(decoded, 'index.html'));
    return { file: candidate, stat };
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }

    const urlPath = (req.url || '/').split('?')[0];

    if (urlPath === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"status":"ok"}');
      return;
    }

    // Client-side app: unknown paths fall back to the SPA shell.
    const hit = (await resolveFile(urlPath)) ?? (await resolveFile('/index.html'));
    if (!hit) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }

    const ext = path.extname(hit.file).toLowerCase();
    const etag = `W/"${hit.stat.size.toString(16)}-${hit.stat.mtimeMs.toString(16)}"`;
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': cacheControl(urlPath, ext),
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
    };

    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers).end();
      return;
    }

    const wantsGzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (wantsGzip) headers['Content-Encoding'] = 'gzip';
    else headers['Content-Length'] = hit.stat.size;
    headers.Vary = 'Accept-Encoding';

    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = createReadStream(hit.file);
    if (wantsGzip) await pipeline(stream, createGzip(), res);
    else await pipeline(stream, res);
  } catch (err) {
    // A client that disconnects mid-stream is normal traffic, not an error worth logging.
    if (err && (err.code === 'ERR_STREAM_PREMATURE_CLOSE' || err.code === 'EPIPE')) return;
    console.error(err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`AZ-104 trainer listening on http://${HOST}:${PORT} (serving ${ROOT})`);
});

// Cloud Run sends SIGTERM before reclaiming an instance.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
