import { describe, expect, it, vi } from 'vitest';
import { routeModelCall, modelLineup, providerCooldown } from '../../server/llm/router.js';
import { readEnv } from '../../server/env.js';
const now = Date.parse('2026-10-02T09:00:00Z');
function deps() {
  return {
    now: () => now,
    charge: vi.fn(async () => {}),
    available: vi.fn(async () => []),
    exhaust: vi.fn(async () => {}),
    attempt: vi.fn(async (model: { modelId: string }) => model.modelId),
    timeoutMs: 5000,
  };
}
describe('task-routed logical model calls', () => {
  it('uses the requested default orders and excludes Groq from vision PDFs even with an override', () => {
    const env = readEnv({});
    expect(modelLineup('pdf_text_reading',env).map(m=>m.modelId)).toEqual([
      'gemini-3.5-flash-lite','gemini-3.5-flash','gemini-3.6-flash','gemini-3.8-flash','gemini-3.7-flash','qwen/qwen3.8-27b']);
    expect(modelLineup('vision_image', env).map((m) => m.modelId)).toEqual([
      'gemini-3.6-flash',
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.7-flash',
      'qwen/qwen3.8-27b',
    ]);
    expect(modelLineup('text', env).map((m) => m.modelId)).toEqual([
      'qwen/qwen3.8-27b',
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
    ]);
    expect(
      modelLineup(
        'vision_pdf',
        readEnv({ LLM_VISION_LINEUP: 'qwen/qwen3.8-27b,gemini-3.5-flash' }),
      ).map((m) => m.provider),
    ).toEqual(['google']);
  });
  it('moves immediately on quota, rate limit and high demand, charging only once', async () => {
    const d = deps();
    d.attempt
      .mockRejectedValueOnce({ statusCode: 429, responseHeaders: { 'retry-after': '8' } })
      .mockRejectedValueOnce({ statusCode: 503, message: 'high demand' })
      .mockRejectedValueOnce({
        statusCode: 429,
        responseBody: 'GenerateRequestsPerDayPerProjectPerModel quota exceeded',
      })
      .mockResolvedValueOnce('answer');
    const result = await routeModelCall(modelLineup('vision_image', readEnv({})), d);
    expect(result.modelId).toBe('gemini-3.5-flash-lite');
    expect(result.value).toBe('answer');
    expect(d.charge).toHaveBeenCalledTimes(1);
    expect(d.attempt).toHaveBeenCalledTimes(4);
    expect(d.exhaust).toHaveBeenCalledTimes(3);
    expect(d.charge.mock.invocationCallOrder[0]).toBeLessThan(
      d.attempt.mock.invocationCallOrder[0]!,
    );
  });
  it('skips saved cooldowns without calling providers or charging when all are unavailable', async () => {
    const models = modelLineup('text', readEnv({}));
    const d = deps();
    d.available.mockResolvedValue(
      models.map((m) => ({
        model_key: m.key,
        usable_after: new Date(now + 12000).toISOString(),
      })) as never,
    );
    await expect(routeModelCall(models, d)).rejects.toMatchObject({ retryAfterMs: 12000 });
    expect(d.charge).not.toHaveBeenCalled();
    expect(d.attempt).not.toHaveBeenCalled();
  });
  it('skips a blocked first model and charges before the next usable model only', async () => {
    const models = modelLineup('text', readEnv({}));
    const d = deps();
    d.available.mockResolvedValue([
      { model_key: models[0]!.key, usable_after: new Date(now + 12000).toISOString() },
    ] as never);
    expect((await routeModelCall(models, d)).modelId).toBe('gemini-3.5-flash-lite');
    expect(d.attempt).toHaveBeenCalledTimes(1);
    expect(d.charge).toHaveBeenCalledTimes(1);
    expect(d.exhaust).not.toHaveBeenCalled();
  });
  it('never starts a provider attempt when logical charging is refused', async () => {
    const d = deps();
    d.charge.mockRejectedValueOnce(new Error('Daily cap reached'));
    await expect(routeModelCall(modelLineup('text', readEnv({})), d)).rejects.toThrow(
      'Daily cap reached',
    );
    expect(d.attempt).not.toHaveBeenCalled();
  });
  it('does not charge or call a provider after the enclosing draft request deadline', async () => {
    const d = deps();
    await expect(
      routeModelCall(modelLineup('text', readEnv({})), { ...d, deadline: now }),
    ).rejects.toMatchObject({ retryAfterMs: 1000 });
    expect(d.charge).not.toHaveBeenCalled();
    expect(d.attempt).not.toHaveBeenCalled();
  });
  it('reuses a model after its cooldown expires and stops on fatal output errors', async () => {
    const models = modelLineup('text', readEnv({}));
    const d = deps();
    d.available.mockResolvedValue([
      { model_key: models[0]!.key, usable_after: new Date(now - 1).toISOString() },
    ] as never);
    expect((await routeModelCall(models, d)).modelId).toBe('qwen/qwen3.8-27b');
    d.attempt.mockRejectedValueOnce(new Error('Invalid extraction schema'));
    await expect(routeModelCall(models, d)).rejects.toThrow('Invalid extraction schema');
  });
  it('returns the earliest usable time after exhausting every model', async () => {
    const d = deps();
    d.attempt.mockRejectedValue({ statusCode: 429, responseHeaders: { 'retry-after': '9' } });
    await expect(routeModelCall(modelLineup('text', readEnv({})), d)).rejects.toMatchObject({
      retryAfterMs: 9000,
    });
    expect(d.charge).toHaveBeenCalledTimes(1);
  });
  it('uses daily reset, retry metadata and a conservative demand cooldown', () => {
    expect(
      providerCooldown(
        { statusCode: 429, responseBody: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' },
        'google',
        now,
      ),
    ).toEqual({ reason: 'quota', until: Date.parse('2026-10-03T07:00:00Z') });
    expect(
      providerCooldown({ statusCode: 429, responseHeaders: { 'retry-after': '12' } }, 'groq', now)
        ?.until,
    ).toBe(now + 12000);
    expect(
      providerCooldown({ statusCode: 503, message: 'high demand' }, 'google', now)?.until,
    ).toBe(now + 60000);
    expect(
      providerCooldown({ statusCode: 400, message: 'Invalid argument' }, 'google', now),
    ).toBeNull();
  });
});
