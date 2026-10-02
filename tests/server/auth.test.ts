import { describe, expect, it } from 'vitest';

import { bearerToken, requireUser } from '../../server/auth.js';
import { readEnv } from '../../server/env.js';

function requestWith(authorization?: string): Request {
  return new Request('http://localhost/api/whoami', {
    headers: authorization === undefined ? {} : { authorization },
  });
}

describe('bearerToken', () => {
  it('reads the token from a Bearer header', () => {
    expect(bearerToken(requestWith('Bearer abc.def.ghi'))).toBe('abc.def.ghi');
    expect(bearerToken(requestWith('bearer abc.def.ghi'))).toBe('abc.def.ghi');
  });

  it.each([undefined, '', 'Bearer', 'Bearer ', 'Basic abc', 'abc.def.ghi', 'Bearer two tokens'])(
    'rejects a missing or malformed header: %s',
    (header) => {
      expect(() => bearerToken(requestWith(header))).toThrowError(expect.objectContaining({ status: 401 }));
    },
  );
});

describe('requireUser', () => {
  it('answers 401 before touching Supabase when there is no token', async () => {
    await expect(requireUser(requestWith(), readEnv({}))).rejects.toMatchObject({ status: 401, code: 'unauthenticated' });
  });

  it('answers 503 when the server has no Supabase settings', async () => {
    await expect(requireUser(requestWith('Bearer abc.def.ghi'), readEnv({}))).rejects.toMatchObject({
      status: 503,
      code: 'not_configured',
    });
  });
});
