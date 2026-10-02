import { z } from 'zod';
import type { AgentAdvanceResponse } from '../../shared/api.js';
import type { AgentRunRow, GuidanceRow, PlanRow, QuestionRow } from '../../shared/database.js';

export const guidanceRowSchema = z.object({ id: z.string(), title: z.string(), body: z.string(), source_name: z.string(),
  source_url: z.string(), checked_on: z.string(), applies_to_steps: z.array(z.number().int()) }) satisfies z.ZodType<GuidanceRow>;
export const questionRowSchema = z.object({ id: z.uuid(), run_id: z.uuid(), case_id: z.uuid(), user_id: z.uuid(),
  kind: z.enum(['conflict', 'missing', 'confirm', 'document_request']), field: z.string().nullable(), prompt: z.string(),
  options: z.array(z.unknown()), answer: z.unknown().nullable(), answered_at: z.string().nullable(), created_at: z.string() }) satisfies z.ZodType<QuestionRow>;
export const planRowSchema = z.object({ id: z.uuid(), case_id: z.uuid(), user_id: z.uuid(), run_id: z.uuid().nullable(),
  ladder_step: z.number().int().min(0).max(3), summary: z.string().nullable(), reasons: z.array(z.unknown()),
  dates: z.record(z.string(), z.string()), guidance_ids: z.array(z.string()), approved_at: z.string().nullable(),
  rejected_at: z.string().nullable().default(null), draft_claim_token: z.string().nullable().default(null), draft_claimed_at: z.string().nullable().default(null),
  sent_on: z.string().nullable(), outcome: z.enum(['refunded', 'acknowledged', 'no_reply', 'refused']).nullable(), created_at: z.string() }) satisfies z.ZodType<PlanRow>;

// RPCs return scalar JSON, not a PostgREST row set. Validate that boundary explicitly.
export const agentRunSchema = z.object({
  id: z.uuid(), case_id: z.uuid(), user_id: z.uuid(),
  status: z.enum(['running', 'waiting_for_user', 'plan_ready', 'completed', 'out_of_scope', 'failed']),
  phase: z.enum(['reading', 'investigating', 'done']),
  turn: z.number().int().nonnegative(), agent_steps: z.number().int().nonnegative(),
  max_agent_steps: z.number().int().positive(), model: z.string().nullable(), error: z.string().nullable(),
  processing_token: z.uuid().nullable(), processing_started_at: z.string().nullable(),
  reader_state: z.object({ fallback_document_id: z.uuid().optional() }),
  agent_state: z.object({ quotes_checked: z.boolean().optional(), image_quote_role: z.enum(['primary', 'fallback']).optional(),
    pending_reread: z.object({ document_id: z.uuid(), question: z.string(), role: z.enum(['primary', 'fallback']) }).optional(),
    next_step: z.record(z.string(), z.unknown()).optional(), checked_guidance: z.array(guidanceRowSchema).optional(),
    answered_question_id: z.uuid().optional() }).default({}),
  started_at: z.string(), ended_at: z.string().nullable(),
}) satisfies z.ZodType<AgentRunRow>;

export const readingResponseSchema = z.object({
  run: agentRunSchema,
  events: z.array(z.object({
    id: z.uuid(), run_id: z.uuid(), case_id: z.uuid(), user_id: z.uuid(), seq: z.number().int().nonnegative(),
    type: z.enum(['tool_call', 'tool_result', 'question', 'answer', 'decision', 'error']),
    payload: z.record(z.string(), z.unknown()), created_at: z.string(),
  })),
}) satisfies z.ZodType<AgentAdvanceResponse>;

export const investigationResponseSchema = readingResponseSchema.extend({ question: questionRowSchema.optional(), plan: planRowSchema.optional() });
