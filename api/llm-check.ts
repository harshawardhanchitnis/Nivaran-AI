// POST /api/llm-check: spends ONE model call to prove a provider key works. Used by the /status
// page. Signed-in callers only, and only while ENABLE_LLM_CHECK=true.
import { generateText } from 'ai';

import { type LlmCheckResponse, llmCheckRequestSchema } from '../shared/api.js';
import { requireUser } from '../server/auth.js';
import { readEnv } from '../server/env.js';
import { HttpError, handle, json, readJson } from '../server/http.js';
import { getModel } from '../server/llm/provider.js';
import { chargeModelCall } from '../server/usage.js';

export const POST = handle(async (request) => {
  const env = readEnv();
  if (!env.llmCheckEnabled) {
    throw new HttpError(403, 'llm_check_disabled', 'The model check is switched off on this deployment.');
  }
  const { supabase } = await requireUser(request, env);
  const { role } = await readJson(request, llmCheckRequestSchema);
  const selected = getModel(role, env);

  await chargeModelCall(supabase);

  const started = Date.now();
  let text: string;
  try {
    const result = await generateText({
      model: selected.model,
      prompt: 'Reply with the single word: ok',
      maxRetries: 0,
    });
    text = result.text;
  } catch (error) {
    console.error('[llm-check] provider call failed', error);
    const reason = error instanceof Error ? error.message.slice(0, 300) : 'unknown error';
    throw new HttpError(502, 'model_call_failed', `The ${selected.provider} call failed: ${reason}`);
  }

  const body: LlmCheckResponse = {
    role,
    provider: selected.provider,
    modelId: selected.modelId,
    milliseconds: Date.now() - started,
    text: text.trim().slice(0, 200),
  };
  return json(body);
});
