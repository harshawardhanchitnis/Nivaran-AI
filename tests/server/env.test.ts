import { describe, expect, it } from 'vitest';

import { DEFAULT_FALLBACK_MODEL, DEFAULT_PRIMARY_MODEL, readEnv } from '../../server/env.js';
import { getModel } from '../../server/llm/provider.js';

describe('readEnv', () => {
  it('falls back to the default models and treats blank values as missing', () => {
    const env = readEnv({ SUPABASE_URL: '  ', GOOGLE_GENERATIVE_AI_API_KEY: '' });
    expect(env.supabaseUrl).toBe('');
    expect(env.googleApiKey).toBeUndefined();
    expect(env.primaryModelId).toBe(DEFAULT_PRIMARY_MODEL);
    expect(env.fallbackModelId).toBe(DEFAULT_FALLBACK_MODEL);
    expect(env.llmCheckEnabled).toBe(false);
  });

  it('reads overrides', () => {
    const env = readEnv({ LLM_PRIMARY_MODEL: 'gemini-3.5-flash-lite', ENABLE_LLM_CHECK: 'TRUE' });
    expect(env.primaryModelId).toBe('gemini-3.5-flash-lite');
    expect(env.llmCheckEnabled).toBe(true);
  });
});

describe('getModel', () => {
  it('refuses with 503 when the key for that role is missing', () => {
    expect(() => getModel('primary', readEnv({}))).toThrowError(expect.objectContaining({ status: 503 }));
    expect(() => getModel('fallback', readEnv({}))).toThrowError(expect.objectContaining({ status: 503 }));
  });

  it('builds a handle for each role when keys are present', () => {
    const env = readEnv({ GOOGLE_GENERATIVE_AI_API_KEY: 'test-key', GROQ_API_KEY: 'test-key' });
    expect(getModel('primary', env)).toMatchObject({ provider: 'google', modelId: DEFAULT_PRIMARY_MODEL });
    expect(getModel('fallback', env)).toMatchObject({ provider: 'groq', modelId: DEFAULT_FALLBACK_MODEL });
  });
});
