// POST /api/llm-check: spends ONE logical call to check a task lineup. Used by the /status
// page. Signed-in callers only, and only while ENABLE_LLM_CHECK=true.
import { generateText } from 'ai';

import { type LlmCheckResponse, llmCheckRequestSchema } from '../shared/api.js';
import { requireUser } from '../server/auth.js';
import { readEnv } from '../server/env.js';
import { HttpError, handle, json, readJson } from '../server/http.js';
import { createRoutedModelCall } from '../server/llm/routed-call.js';
import { ModelsUnavailableError } from '../server/llm/router.js';

export const POST = handle(async (request) => {
  const env = readEnv();
  if (!env.llmCheckEnabled) {
    throw new HttpError(403, 'llm_check_disabled', 'The model check is switched off on this deployment.');
  }
  const { supabase } = await requireUser(request, env);
  const { task } = await readJson(request, llmCheckRequestSchema);

  const started = Date.now();
  let result: {value:string;modelId:string;provider:'google'|'groq'};
  try {
    result = await createRoutedModelCall(supabase)(task==='vision'?'vision_image':'text',async (selected,signal)=> (await generateText({
      model: selected.model,
      prompt: 'Reply with the single word: ok',
      maxRetries: 0,
      abortSignal:signal,
    })).text);
  } catch (error) {
    if(error instanceof HttpError) throw error;
    if(error instanceof ModelsUnavailableError) return json({error:{code:'models_unavailable',message:error.message},retryAfterMs:error.retryAfterMs},503);
    throw new HttpError(502, 'model_call_failed', 'The model check failed. Please try again.');
  }

  const body: LlmCheckResponse = {
    task,
    provider: result.provider,
    modelId: result.modelId,
    milliseconds: Date.now() - started,
    text: result.value.trim().slice(0, 200),
  };
  return json(body);
});
