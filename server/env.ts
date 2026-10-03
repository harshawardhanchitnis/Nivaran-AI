// Server-side configuration, read from environment variables.
// Nothing here may be imported by browser code.

export interface ServerEnv {
  supabaseUrl: string;
  supabasePublishableKey: string;
  googleApiKey: string | undefined;
  groqApiKey: string | undefined;
  llmCheckEnabled: boolean;
  visionLineup: string[];
  textLineup: string[];
  modelAttemptTimeoutMs: number;
  modelCooldownSigningSecret: string | undefined;
  evaluationGroqTpm:number;
  evaluationGroqRpm:number;
}

export const DEFAULT_VISION_LINEUP = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash', 'qwen/qwen3.8-27b'];
export const DEFAULT_TEXT_LINEUP = ['qwen/qwen3.8-27b', 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.7-flash'];

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function readEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const list = (key: string, defaults: string[]) => [...new Set((clean(source[key])?.split(',') ?? defaults).map(value=>value.trim()).filter(Boolean))];
  const timeout = Number(source['LLM_ATTEMPT_TIMEOUT_MS'] ?? 8000);
  return {
    supabaseUrl: clean(source['SUPABASE_URL']) ?? '',
    supabasePublishableKey: clean(source['SUPABASE_PUBLISHABLE_KEY']) ?? '',
    googleApiKey: clean(source['GOOGLE_GENERATIVE_AI_API_KEY']),
    groqApiKey: clean(source['GROQ_API_KEY']),
    llmCheckEnabled: clean(source['ENABLE_LLM_CHECK'])?.toLowerCase() === 'true',
    visionLineup: list('LLM_VISION_LINEUP', DEFAULT_VISION_LINEUP), textLineup: list('LLM_TEXT_LINEUP', DEFAULT_TEXT_LINEUP),
    modelAttemptTimeoutMs: Number.isInteger(timeout) && timeout >= 1000 && timeout <= 8000 ? timeout : 8000,
    modelCooldownSigningSecret: clean(source['MODEL_COOLDOWN_SIGNING_SECRET']),
    evaluationGroqTpm:Number(source['EVAL_GROQ_TPM']??8000),
    evaluationGroqRpm:Number(source['EVAL_GROQ_RPM']??30),
  };
}
