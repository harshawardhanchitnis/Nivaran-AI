import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { resolveApiFile } from '../../scripts/lib/api-router.js';

const apiDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'api');

describe('resolveApiFile', () => {
  it('maps a route to its function file', () => {
    expect(resolveApiFile('/api/health', apiDir)).toBe(path.join(apiDir, 'health.ts'));
    expect(resolveApiFile('/api/health/', apiDir)).toBe(path.join(apiDir, 'health.ts'));
  });

  it('returns null for routes that have no function', () => {
    expect(resolveApiFile('/api/does-not-exist', apiDir)).toBeNull();
    expect(resolveApiFile('/health', apiDir)).toBeNull();
  });

  it.each(['/api/../package', '/api/..%2Fpackage', '/api/health.ts', '/api//health', '/api/tsconfig.json'])(
    'refuses paths that could leave the api folder or name a file directly: %s',
    (pathname) => {
      expect(resolveApiFile(pathname, apiDir)).toBeNull();
    },
  );
});
