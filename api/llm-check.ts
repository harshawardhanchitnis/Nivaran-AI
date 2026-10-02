// POST /api/llm-check: spends ONE model call to prove a provider key works. Used by the /status
// page. Signed-in callers only, and only while ENABLE_LLM_CHECK=true.
import { generateText } from 'ai';
import { z } from 'zod';

import { type LlmCheckResponse, llmCheckRequestSchema } from '../shared/api.js';
import { requireUser } from '../server/auth.js';
import { readEnv } from '../server/env.js';
import { HttpError, handle, json, readJson } from '../server/http.js';
import { getModel } from '../server/llm/provider.js';

const chargeResultSchema = z.object({ allowed: z.boolean() });

export const POST = handle(async (request) => {
  const env = readEnv();
  if (!env.llmCheckEnabled) {
    throw new HttpError(403, 'llm_check_disabled', 'The model check is switched off on this deployment.');
  }
  const { supabase } = await requireUser(request, env);
  const { role } = await readJson(request, llmCheckRequestSchema);
  const selected = getModel(role, env);

  const { data, error } = await supabase.rpc('charge_model_call');
  const charge = chargeResultSchema.safeParse(data);
  if (error || !charge.success) {
    throw new HttpError(503, 'usage_check_failed', 'Could not check the model call limit. Please try again.');
  }
  if (!charge.data.allowed) {
    throw new HttpError(429, 'quota_exhausted', 'Today\'s model call limit has been reached. Please try again tomorrow.');
  }

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
