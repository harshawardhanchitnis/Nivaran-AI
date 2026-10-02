import { afterEach, describe, expect, it, vi } from 'vitest';
import { googleFetch } from '../../server/llm/google-fetch.js';

afterEach(() => vi.unstubAllGlobals());
describe('Google structured-output transport', () => {
  it('maps the SDK legacy fields to Gemini responseFormat without changing document content', async () => {
    const fetch = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const schema = { type: 'object', properties: { readable: { type: 'boolean' } } };
    const contents = [{ parts: [{ inlineData: { mimeType: 'application/pdf', data: 'fake-bytes' } }] }];
    await googleFetch('https://example.test/model', { method: 'POST', body: JSON.stringify({
      contents, generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, maxOutputTokens: 8000 },
    }) });
    const args = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(args[1].body));
    expect(body).toEqual({ contents, generationConfig: {
      responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema } }, maxOutputTokens: 8000,
    } });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('forwards ordinary text calls unchanged', async () => {
    const fetch = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const options = { method: 'POST', body: '{"contents":[{"text":"ok"}]}' };
    await googleFetch('https://example.test/model', options);
    expect(fetch).toHaveBeenCalledExactlyOnceWith('https://example.test/model', options);
  });
});
