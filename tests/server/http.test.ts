import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { HttpError, errorResponse, handle, json, readJson } from '../../server/http.js';

describe('json', () => {
  it('returns JSON that is never cached', async () => {
    const response = json({ hello: 'world' }, 201);
    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ hello: 'world' });
  });
});

describe('errorResponse', () => {
  it('shows the code and message of an HttpError', async () => {
    const response = errorResponse(new HttpError(404, 'case_not_found', 'That case does not exist.'));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: 'case_not_found', message: 'That case does not exist.' } });
  });

  it('hides the details of any other error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = errorResponse(new Error('connection string postgres://user:secret@host'));
    const body = JSON.stringify(await response.json());
    expect(response.status).toBe(500);
    expect(body).toContain('internal_error');
    expect(body).not.toContain('secret');
    log.mockRestore();
  });
});

describe('handle', () => {
  it('turns a thrown HttpError into its response', async () => {
    const handler = handle(() => {
      throw new HttpError(403, 'forbidden', 'Not allowed.');
    });
    const response = await handler(new Request('http://localhost/api/x'));
    expect(response.status).toBe(403);
  });

  it('passes a normal response through', async () => {
    const handler = handle(async () => json({ ok: true }));
    const response = await handler(new Request('http://localhost/api/x'));
    expect(await response.json()).toEqual({ ok: true });
  });
});

describe('readJson', () => {
  const schema = z.object({ caseId: z.string().uuid(), step: z.number().int().min(0).default(0) });

  function post(body: string): Request {
    return new Request('http://localhost/api/x', { method: 'POST', body });
  }

  it('returns the parsed body with defaults applied', async () => {
    const body = await readJson(post('{"caseId":"11111111-1111-4111-8111-111111111111"}'), schema);
    expect(body).toEqual({ caseId: '11111111-1111-4111-8111-111111111111', step: 0 });
  });

  it('rejects a body that is not JSON', async () => {
    await expect(readJson(post('{not json'), schema)).rejects.toMatchObject({ status: 400, code: 'invalid_json' });
  });

  it('rejects a body that does not match the schema and names the field', async () => {
    await expect(readJson(post('{"caseId":"nope"}'), schema)).rejects.toMatchObject({
      status: 400,
      code: 'invalid_request',
      message: expect.stringContaining('caseId'),
    });
  });

  it('treats an empty body as an empty object', async () => {
    const body = await readJson(post(''), z.object({ role: z.string().default('primary') }));
    expect(body).toEqual({ role: 'primary' });
  });
});
