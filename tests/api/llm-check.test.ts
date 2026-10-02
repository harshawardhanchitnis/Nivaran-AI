import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routingClient } from '../server/routed-test-client.js';

const fake = vi.hoisted(() => ({
  rpc: vi.fn(),
  requireUser: vi.fn(),
  getModel: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock('../../server/auth.js', () => ({ requireUser: fake.requireUser }));
vi.mock('../../server/llm/provider.js', () => ({ getModelById: fake.getModel }));
vi.mock('ai', () => ({ generateText: fake.generateText }));

import { POST } from '../../api/llm-check.js';
import { HttpError } from '../../server/http.js';

function request(task: string = 'vision'): Request {
  return new Request('http://localhost/api/llm-check', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer fake-token' },
    body: JSON.stringify({ task }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('ENABLE_LLM_CHECK', 'true');
  vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY','fake'); vi.stubEnv('GROQ_API_KEY','fake');
  vi.stubEnv('MODEL_COOLDOWN_SIGNING_SECRET','test-secret-with-at-least-32-characters');
  fake.requireUser.mockResolvedValue({ supabase: routingClient(fake.rpc) });
  fake.rpc.mockResolvedValue({ data: { allowed: true }, error: null });
  fake.getModel.mockImplementation((provider: 'google' | 'groq') => ({
    provider,
    modelId: 'fake-model',
    model: 'fake-model-handle',
  }));
  fake.generateText.mockResolvedValue({ text: 'ok' });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/llm-check usage limits', () => {
  it.each(['vision', 'text'])('charges before the %s model call', async (task) => {
    const response = await POST(request(task));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ task, text: 'ok' });
    expect(fake.rpc).toHaveBeenCalledExactlyOnceWith('charge_model_call');
    expect(fake.generateText).toHaveBeenCalledTimes(1);
    expect(fake.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      fake.generateText.mock.invocationCallOrder[0]!,
    );
  });

  it.each(['user_limit', 'global_limit'])('stops when the charge refuses: %s', async (reason) => {
    fake.rpc.mockResolvedValue({ data: { allowed: false, reason }, error: null });

    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: { code: 'quota_exhausted' } });
    expect(fake.generateText).not.toHaveBeenCalled();
  });

  it('stops if the database cannot charge the call', async () => {
    fake.rpc.mockResolvedValue({ data: null, error: { message: 'database unavailable' } });

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: 'usage_check_failed' } });
    expect(fake.generateText).not.toHaveBeenCalled();
  });

  it.each([null, {}, { allowed: 'true' }])('stops on a malformed charge result: %j', async (data) => {
    fake.rpc.mockResolvedValue({ data, error: null });

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(fake.generateText).not.toHaveBeenCalled();
  });

  it('does not charge when diagnostics are disabled', async () => {
    vi.stubEnv('ENABLE_LLM_CHECK', 'false');

    expect((await POST(request())).status).toBe(403);
    expect(fake.requireUser).not.toHaveBeenCalled();
    expect(fake.rpc).not.toHaveBeenCalled();
    expect(fake.generateText).not.toHaveBeenCalled();
  });

  it('does not charge an unauthenticated caller', async () => {
    fake.requireUser.mockRejectedValue(new HttpError(401, 'unauthenticated', 'Sign in to continue.'));

    expect((await POST(request())).status).toBe(401);
    expect(fake.rpc).not.toHaveBeenCalled();
    expect(fake.generateText).not.toHaveBeenCalled();
  });

  it('does not charge an invalid request', async () => {
    expect((await POST(request('unknown'))).status).toBe(400);
    expect(fake.rpc).not.toHaveBeenCalled();
    expect(fake.generateText).not.toHaveBeenCalled();
  });

  it('does not charge when the model is not configured', async () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY',''); vi.stubEnv('GROQ_API_KEY','');

    expect((await POST(request())).status).toBe(503);
    expect(fake.rpc).not.toHaveBeenCalled();
    expect(fake.generateText).not.toHaveBeenCalled();
  });
});
