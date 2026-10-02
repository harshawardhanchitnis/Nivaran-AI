import { z } from 'zod';
import type { AgentAdvanceResponse } from '../../shared/api.js';
import type { AgentRunRow } from '../../shared/database.js';

// RPCs return scalar JSON, not a PostgREST row set. Validate that boundary explicitly.
export const agentRunSchema = z.object({
  id: z.uuid(), case_id: z.uuid(), user_id: z.uuid(),
  status: z.enum(['running', 'waiting_for_user', 'plan_ready', 'completed', 'out_of_scope', 'failed']),
  phase: z.enum(['reading', 'investigating', 'done']),
  turn: z.number().int().nonnegative(), agent_steps: z.number().int().nonnegative(),
  max_agent_steps: z.number().int().positive(), model: z.string().nullable(), error: z.string().nullable(),
  processing_token: z.uuid().nullable(), processing_started_at: z.string().nullable(),
  reader_state: z.object({ fallback_document_id: z.uuid().optional() }),
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
