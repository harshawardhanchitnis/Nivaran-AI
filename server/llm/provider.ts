// Provider construction only. Task order, charging and cooldowns belong to routed-call/router.
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import type { LanguageModel } from 'ai';

import { type ServerEnv, readEnv } from '../env.js';
import { HttpError } from '../http.js';
import { googleFetch } from './google-fetch.js';
import { groqFetch } from './groq-fetch.js';

/** Compatibility for continuation state saved by T2; it no longer chooses a provider. */
export type ModelRole = 'primary' | 'fallback';

export interface ModelHandle {
  role: ModelRole;
  provider: 'google' | 'groq';
  modelId: string;
  model: LanguageModel;
}

export function getModelById(provider: 'google' | 'groq', modelId: string, env: ServerEnv = readEnv()): ModelHandle {
  if (provider === 'google') {
    if (!env.googleApiKey) throw new HttpError(503, 'model_not_configured', 'The Google model key is not set on the server.');
    const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey, fetch: googleFetch });
    return { role: 'primary', provider, modelId, model: google(modelId) };
  }
  if (!env.groqApiKey) throw new HttpError(503, 'model_not_configured', 'The Groq model key is not set on the server.');
  return { role: 'fallback', provider, modelId, model: createGroq({ apiKey: env.groqApiKey,fetch:groqFetch })(modelId) };
}
