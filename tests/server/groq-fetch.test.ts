import { afterEach, describe, expect, it, vi } from 'vitest';
import { groqFetch } from '../../server/llm/groq-fetch.js';
import { observeModelCalls } from '../../server/llm/observer.js';
import type { ProviderMeasurement } from '../../server/llm/observer.js';

afterEach(() => vi.unstubAllGlobals());
describe('privacy-safe provider timing', () => {
  it('captures usage and request timing without retaining prompts, credentials or response prose', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({usage:{prompt_tokens:1300,completion_tokens:90},choices:[{message:{content:'PRIVATE RESPONSE'}}]}))));
    const measurements: ProviderMeasurement[] = [];
    const response = await observeModelCalls({ beforeCharge(){}, charged(){}, beforeAttempt(){}, providerResponse: m => measurements.push(m) }, () =>
      groqFetch('https://example.test', { method:'POST',headers:{authorization:'Bearer PRIVATE KEY'},body:JSON.stringify({model:'qwen/test',messages:[{role:'user',content:'PRIVATE DOCUMENT'}],tools:[{function:{name:'ask_user'}}],max_tokens:600}) }));
    expect(response.ok).toBe(true);
    expect(measurements[0]).toMatchObject({kind:'tool_choice',inputTokens:1300,outputTokens:90,maxOutputTokens:600,responseMs:expect.any(Number)});
    expect(measurements[0]?.responseMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(measurements)).not.toContain('PRIVATE');
  });
});
