// File-based routing for the local API server, mirroring how Vercel maps /api/<route> to
// api/<route>.ts.
import { existsSync } from 'node:fs';
import path from 'node:path';

// Letters, digits, dashes, underscores and single slashes only. No dots, so no "..".
const SAFE_ROUTE = /^[a-z0-9_-]+(\/[a-z0-9_-]+)*$/i;

/** Returns the function file for a URL path such as /api/agent/advance, or null if there is none. */
export function resolveApiFile(pathname: string, apiDir: string): string | null {
  if (!pathname.startsWith('/api/')) {
    return null;
  }
  const route = pathname.slice('/api/'.length).replace(/\/+$/, '');
  if (!SAFE_ROUTE.test(route)) {
    return null;
  }
  const file = path.join(apiDir, `${route}.ts`);
  if (!path.resolve(file).startsWith(path.resolve(apiDir) + path.sep)) {
    return null;
  }
  return existsSync(file) ? file : null;
}
