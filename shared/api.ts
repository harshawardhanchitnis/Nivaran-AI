// Request and response shapes for /api. The server validates requests with the schemas here;
// the browser imports the types only (`import type`), so zod stays out of the client bundle.
import { z } from 'zod';
import type { AgentEventRow, AgentRunRow, DraftRow, PlanRow, QuestionRow } from './database.js';

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
  task: z.enum(['vision', 'text']).default('text'),
});
export type LlmCheckRequest = z.input<typeof llmCheckRequestSchema>;

export interface LlmCheckResponse {
  task: 'vision' | 'text';
  provider: string;
  modelId: string;
  milliseconds: number;
  text: string;
}

export const agentStartRequestSchema = z.object({ caseId: z.uuid() });
export const agentAdvanceRequestSchema = z.object({
  runId: z.uuid(),
  expectedTurn: z.number().int().nonnegative(),
});
export const agentAnswerRequestSchema = z.object({
  questionId: z.uuid(),
  answer: z.union([
    z.object({ optionId: z.string().min(1).max(100) }),
    z.string().trim().min(1).max(4000),
  ]),
});
export type AgentAnswerRequest = z.infer<typeof agentAnswerRequestSchema>;
export interface AgentStartResponse {
  run: AgentRunRow;
}
export interface AgentAdvanceResponse {
  run: AgentRunRow;
  events: AgentEventRow[];
  question?: QuestionRow;
  plan?: PlanRow;
  retryAfterMs?: number;
}
export const agentDraftRequestSchema = z.object({ planId: z.uuid() });
export interface AgentDraftResponse {
  draft?: DraftRow;
  retryAfterMs?: number;
}
export const agentDraftEditRequestSchema = z.object({
  draftId: z.uuid(),
  text: z.string().trim().min(1).max(20000),
  userStatements: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
});
export type AgentDraftEditRequest = z.infer<typeof agentDraftEditRequestSchema>;
export const markSentRequestSchema = z.object({
  planId: z.uuid(),
  sentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const recordOutcomeRequestSchema = z.object({
  planId: z.uuid(),
  requestId: z.uuid(),
  outcome: z.enum(['refunded', 'acknowledged', 'no_reply', 'refused']),
  replyDocumentId: z.uuid().optional(),
}).refine(input => input.outcome === 'refused' ? !!input.replyDocumentId : !input.replyDocumentId, {
  message: 'Add the written reply for a refusal. Other outcomes do not need a reply file.',
});
export type RecordOutcomeRequest = z.infer<typeof recordOutcomeRequestSchema>;
