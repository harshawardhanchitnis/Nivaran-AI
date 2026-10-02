// Local stand-in for Vercel Functions, so development needs no Vercel login.
// Serves api/**/*.ts on http://127.0.0.1:3000; `ng serve` proxies /api to it (proxy.conf.json).
// Run with: npm run dev:api   (or `npm run dev` for API and web together)
import { existsSync } from 'node:fs';
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveApiFile } from './lib/api-router.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const file of ['.env.local', '.env']) {
  const envPath = path.join(root, file);
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

const port = Number(process.env['API_PORT'] ?? 3000);
const apiDir = path.join(root, 'api');

type WebHandler = (request: Request) => Response | Promise<Response>;

async function readBody(req: IncomingMessage): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

function sendJson(res: ServerResponse, status: number, code: string, message: string): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: { code, message } }));
}

function findHandler(mod: Record<string, unknown>, method: string): WebHandler | null {
  const named = mod[method];
  if (typeof named === 'function') {
    return named as WebHandler;
  }
  const fallback = (mod['default'] as { fetch?: unknown } | undefined)?.fetch;
  return typeof fallback === 'function' ? (fallback as WebHandler) : null;
}

const server = createServer(async (req, res) => {
  const started = Date.now();
  const method = (req.method ?? 'GET').toUpperCase();
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `127.0.0.1:${port}`}`);

  try {
    const file = resolveApiFile(url.pathname, apiDir);
    if (!file) {
      sendJson(res, 404, 'not_found', `No function at ${url.pathname}.`);
      return;
    }

    const mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
    const handler = findHandler(mod, method);
    if (!handler) {
      sendJson(res, 405, 'method_not_allowed', `${url.pathname} does not handle ${method}.`);
      return;
    }

    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          headers.append(name, item);
        }
      } else if (value !== undefined) {
        headers.set(name, value);
      }
    }

    const hasBody = method !== 'GET' && method !== 'HEAD';
    const request = new Request(url, { method, headers, body: hasBody ? await readBody(req) : undefined });
    const response = await handler(request);

    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error('[dev-api] handler crashed', error);
    if (!res.headersSent) {
      sendJson(res, 500, 'internal_error', 'The local API server hit an error. See the terminal.');
    } else {
      res.end();
    }
  } finally {
    console.log(`[dev-api] ${method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[dev-api] serving api/ on http://127.0.0.1:${port}`);
});
