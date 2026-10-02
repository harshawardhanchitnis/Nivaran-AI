import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from '../../api/health.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/health', () => {
  it('reports which settings are present', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'google-test-key-value');
    vi.stubEnv('GROQ_API_KEY', '');

    const response = await GET(new Request('http://localhost/api/health'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      service: 'nivaran-ai',
      configured: { supabase: true, primaryModel: true, fallbackModel: false },
    });
  });

  it('never includes a setting value in the response', async () => {
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'google-test-key-value');

    const response = await GET(new Request('http://localhost/api/health'));
    const text = await response.text();

    expect(text).not.toContain('google-test-key-value');
    expect(text).not.toContain('sb_publishable_test');
  });
});
