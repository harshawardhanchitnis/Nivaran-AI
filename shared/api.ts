// Request and response shapes for /api. The server validates requests with the schemas here;
// the browser imports the types only (`import type`), so zod stays out of the client bundle.
import { z } from 'zod';

/** Every error response from /api has this body. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export interface HealthResponse {
  ok: true;
  service: 'nivaran-ai';
  time: string;
  region: string;
  configured: {
    supabase: boolean;
    primaryModel: boolean;
    fallbackModel: boolean;
  };
}

export interface WhoAmIResponse {
  userId: string;
  isAnonymous: boolean;
  /** Result of a row-level-security read made with the caller's own token. */
  database: { ok: true; caseCount: number } | { ok: false; message: string };
}

export const llmCheckRequestSchema = z.object({
  role: z.enum(['primary', 'fallback']).default('primary'),
});
export type LlmCheckRequest = z.input<typeof llmCheckRequestSchema>;

export interface LlmCheckResponse {
  role: 'primary' | 'fallback';
  provider: string;
  modelId: string;
  milliseconds: number;
  text: string;
}
