// Server-side configuration, read from environment variables.
// Nothing here may be imported by browser code.

export interface ServerEnv {
  supabaseUrl: string;
  supabasePublishableKey: string;
  googleApiKey: string | undefined;
  groqApiKey: string | undefined;
  primaryModelId: string;
  fallbackModelId: string;
  llmCheckEnabled: boolean;
}

export const DEFAULT_PRIMARY_MODEL = 'gemini-3.8-flash';
export const DEFAULT_FALLBACK_MODEL = 'qwen/qwen3.8-27b';

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function readEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  return {
    supabaseUrl: clean(source['SUPABASE_URL']) ?? '',
    supabasePublishableKey: clean(source['SUPABASE_PUBLISHABLE_KEY']) ?? '',
    googleApiKey: clean(source['GOOGLE_GENERATIVE_AI_API_KEY']),
    groqApiKey: clean(source['GROQ_API_KEY']),
    primaryModelId: clean(source['LLM_PRIMARY_MODEL']) ?? DEFAULT_PRIMARY_MODEL,
    fallbackModelId: clean(source['LLM_FALLBACK_MODEL']) ?? DEFAULT_FALLBACK_MODEL,
    llmCheckEnabled: clean(source['ENABLE_LLM_CHECK'])?.toLowerCase() === 'true',
  };
}
