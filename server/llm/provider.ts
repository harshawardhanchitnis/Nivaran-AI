// The only place that knows which model providers exist. Everything else asks for a role:
// "primary" (Gemini, reads images and PDFs) or "fallback" (Groq).
//
// Retry, fallback and quota handling are deliberately NOT here yet: see docs/BUILD_PLAN.md.
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import type { LanguageModel } from 'ai';

import { type ServerEnv, readEnv } from '../env.js';
import { HttpError } from '../http.js';
import { googleFetch } from './google-fetch.js';

export type ModelRole = 'primary' | 'fallback';

export interface ModelHandle {
  role: ModelRole;
  provider: 'google' | 'groq';
  modelId: string;
  model: LanguageModel;
}

export function getModel(role: ModelRole, env: ServerEnv = readEnv()): ModelHandle {
  if (role === 'primary') {
    if (!env.googleApiKey) {
      throw new HttpError(503, 'model_not_configured', 'The primary model key is not set on the server.');
    }
    const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey, fetch: googleFetch });
    return { role, provider: 'google', modelId: env.primaryModelId, model: google(env.primaryModelId) };
  }

  if (!env.groqApiKey) {
    throw new HttpError(503, 'model_not_configured', 'The fallback model key is not set on the server.');
  }
  const groq = createGroq({ apiKey: env.groqApiKey });
  return { role, provider: 'groq', modelId: env.fallbackModelId, model: groq(env.fallbackModelId) };
}
