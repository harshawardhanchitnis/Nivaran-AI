import { describe, expect, it } from 'vitest';

import { DEFAULT_TEXT_LINEUP, DEFAULT_VISION_LINEUP, DEFAULT_PDF_TEXT_READING_LINEUP, readEnv } from '../../server/env.js';
import { getModelById } from '../../server/llm/provider.js';

describe('readEnv', () => {
  it('falls back to the default models and treats blank values as missing', () => {
    const env = readEnv({ SUPABASE_URL: '  ', GOOGLE_GENERATIVE_AI_API_KEY: '' });
    expect(env.supabaseUrl).toBe('');
    expect(env.googleApiKey).toBeUndefined();
    expect(env.visionLineup).toEqual(DEFAULT_VISION_LINEUP);
    expect(env.textLineup).toEqual(DEFAULT_TEXT_LINEUP);
    expect(env.pdfTextReadingLineup).toEqual(DEFAULT_PDF_TEXT_READING_LINEUP);
    expect(env.llmCheckEnabled).toBe(false);
  });

  it('reads overrides', () => {
    const env = readEnv({ LLM_TEXT_LINEUP: 'gemini-3.5-flash-lite', LLM_PDF_TEXT_READING_LINEUP:' gemini-3.5-flash, qwen/qwen3.8-27b,gemini-3.5-flash ', ENABLE_LLM_CHECK: 'TRUE' });
    expect(env.textLineup).toEqual(['gemini-3.5-flash-lite']);
    expect(env.pdfTextReadingLineup).toEqual(['gemini-3.5-flash','qwen/qwen3.8-27b']);
    expect(env.llmCheckEnabled).toBe(true);
  });
});

describe('getModel', () => {
  it('refuses with 503 when the key for that role is missing', () => {
    expect(() => getModelById('google','gemini-3.6-flash', readEnv({}))).toThrowError(expect.objectContaining({ status: 503 }));
    expect(() => getModelById('groq','qwen/qwen3.8-27b', readEnv({}))).toThrowError(expect.objectContaining({ status: 503 }));
  });

  it('builds a handle for each role when keys are present', () => {
    const env = readEnv({ GOOGLE_GENERATIVE_AI_API_KEY: 'test-key', GROQ_API_KEY: 'test-key' });
    expect(getModelById('google','gemini-3.6-flash', env)).toMatchObject({ provider: 'google', modelId: 'gemini-3.6-flash' });
    expect(getModelById('groq','qwen/qwen3.8-27b', env)).toMatchObject({ provider: 'groq', modelId: 'qwen/qwen3.8-27b' });
  });
});
