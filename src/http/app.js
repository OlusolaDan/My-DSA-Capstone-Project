import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DomainError } from '../domain/errors.js';
import { createRouter } from './router.js';

const defaultPublicDir = fileURLToPath(new URL('../../public/', import.meta.url));
const mimeTypes = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
};

function sendJson(response, status, payload) {
  response.writeHead(status ?? 200, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  if (!request.headers['content-type']?.toLowerCase().includes('application/json')) return undefined;
  let body = '';
  for await (const chunk of request) body += chunk;
  if (!body) return undefined;
  try { return JSON.parse(body); }
  catch { throw new DomainError('BAD_JSON', 'Request body must contain valid JSON'); }
}

async function serveStatic(publicDir, pathname, response) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); }
  catch { return false; }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const root = await realpath(publicDir);
  const candidate = path.resolve(root, relative);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return false;
  try {
    const actual = await realpath(candidate);
    if (actual !== root && !actual.startsWith(`${root}${path.sep}`)) return false;
    const contents = await readFile(actual);
    response.writeHead(200, { 'content-type': mimeTypes[path.extname(actual).toLowerCase()] ?? 'application/octet-stream' });
    response.end(contents);
    return true;
  } catch {
    return false;
  }
}

export function createApp({ publicDir = defaultPublicDir, router = createRouter() } = {}) {
  if (!router.match('GET', '/health')) {
    router.get('/health', () => ({ status: 'ok' }));
  }
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const body = await readJsonBody(request);
      const match = router.match(request.method ?? 'GET', url.pathname);
      if (match?.error) return sendJson(response, 400, { error: { code: 'BAD_PATH', message: 'Path contains invalid encoding' } });
      if (match) {
        const result = await match.handler({ request, response, params: match.params, query: url.searchParams, body });
        if (!response.writableEnded) sendJson(response, response.statusCode === 200 ? 200 : response.statusCode, result ?? {});
        return;
      }
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'API route not found' } });
      if (await serveStatic(publicDir, url.pathname, response)) return;
      return sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Resource not found' } });
    } catch (error) {
      if (response.writableEnded) return;
      if (error instanceof DomainError && error.code === 'BAD_JSON') return sendJson(response, 400, { error: { code: error.code, message: error.message } });
      const safeError = error instanceof DomainError ? error : new DomainError('INTERNAL_ERROR', 'An unexpected error occurred');
      const status = safeError.code === 'NOT_FOUND' ? 404
        : safeError.code === 'FORBIDDEN' ? 403
          : safeError.code === 'PAYMENT_DECLINED' ? 402
            : safeError.code === 'INVALID_TRANSITION' ? 409
            : safeError.code === 'VALIDATION' || safeError.code === 'BAD_JSON' ? 400 : 500;
      return sendJson(response, status, { error: { code: safeError.code, message: safeError.message } });
    }
  });
}
