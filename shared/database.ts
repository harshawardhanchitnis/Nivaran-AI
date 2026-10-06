// Row shapes for the tables in supabase/migrations/0001_init.sql.
// Hand-written: when a migration changes a table, change the matching type here in the same commit.
import type { FactStatus } from './facts.js';
import type { AllowedMimeType } from './limits.js';

/** Advice only; charge_model_call still checks and charges before provider attempts. */
export interface ModelBudgetStatus { day: string; remaining: number; reason: 'user_limit' | 'global_limit' | null; reset_at: string }
export interface ResumeDocumentReadingRequest { caseId: string; documentId: string }

export type CaseStatus =
  | 'open'
  | 'investigating'
  | 'waiting_for_user'
  | 'plan_ready'
  | 'approved'
  | 'sent'
  | 'resolved'
  | 'out_of_scope';

export interface CaseRow {
  id: string;
  user_id: string;
  title: string;
  merchant_name: string | null;
  status: CaseStatus;
  ladder_step: number | null;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export type DocumentReadStatus = 'pending' | 'read' | 'unreadable' | 'failed';

export interface DocumentRow {
  id: string;
  case_id: string;
  user_id: string;
  /** Evidence label shown to the user: E01, E02, ... */
  label: string;
  file_name: string;
  storage_path: string;
  mime_type: AllowedMimeType;
  size_bytes: number;
  sha256: string | null;
  doc_type: string | null;
  page_count: number | null;
  read_status: DocumentReadStatus;
  created_at: string;
}

/** One value seen in one source. Several items for the same field can disagree. */
export interface EvidenceItemRow {
  id: string;
  case_id: string;
  user_id: string;
  source: 'document' | 'user';
  document_id: string | null;
  field: string;
  value_text: string;
  value_norm: Record<string, unknown> | null;
  page: number | null;
  quote: string | null;
  /** null = not checked yet. */
  quote_verified: boolean | null;
  created_at: string;
}

/** The fact sheet: one row per field. */
export interface CaseFactRow {
  id: string;
  case_id: string;
  user_id: string;
  field: string;
  status: FactStatus;
  value_text: string | null;
  value_norm: Record<string, unknown> | null;
  evidence_item_id: string | null;
  confirmed_by_user: boolean;
  created_at: string;
  updated_at: string;
}

export type AgentRunStatus =
  | 'running'
  | 'waiting_for_user'
  | 'plan_ready'
  | 'completed'
  | 'out_of_scope'
  | 'failed';
export type AgentRunPhase = 'reading' | 'investigating' | 'done';

/** Structured continuation state only; no raw document text or model instructions. */
export interface AgentState {
  quotes_checked?: boolean;
  image_quote_role?: 'primary' | 'fallback';
  pending_reread?: { document_id: string; question: string; role: 'primary' | 'fallback' };
  next_step?: Record<string, unknown>;
  checked_guidance?: GuidanceRow[];
  answered_question_id?: string;
  /** Signatures of tool choices since the last semantic fact change, never raw source text. */
  progress?: { facts: string; actions: string[] };
  /** Caller-recorded outcome; code recomputes the ladder after any new reply is read. */
  outcome_update?: {
    plan_id: string;
    request_id: string;
    outcome: PlanOutcome;
    recorded_on: string;
    reply_document_id?: string;
  };
  outcome_decision_done?: boolean;
}

export interface AgentRunRow {
  id: string;
  case_id: string;
  user_id: string;
  status: AgentRunStatus;
  phase: AgentRunPhase;
  /** Processed /api/agent/advance calls. The browser must send the turn it expects. */
  turn: number;
  agent_steps: number;
  max_agent_steps: number;
  model: string | null;
  error: string | null;
  processing_token: string | null;
  processing_started_at: string | null;
  /** A deferred image fallback is performed on the next HTTP request. No raw document text. */
  reader_state: { fallback_document_id?: string };
  agent_state: AgentState;
  started_at: string;
  ended_at: string | null;
}

export type AgentEventType =
  | 'tool_call'
  | 'tool_result'
  | 'question'
  | 'answer'
  | 'decision'
  | 'error';

export interface AgentEventRow {
  id: string;
  run_id: string;
  case_id: string;
  user_id: string;
  seq: number;
  type: AgentEventType;
  payload: Record<string, unknown>;
  created_at: string;
}

export type QuestionKind = 'conflict' | 'missing' | 'confirm' | 'document_request';

export interface QuestionRow {
  id: string;
  run_id: string;
  case_id: string;
  user_id: string;
  kind: QuestionKind;
  field: string | null;
  prompt: string;
  options: unknown[];
  answer: unknown | null;
  answered_at: string | null;
  created_at: string;
}

export type PlanOutcome = 'refunded' | 'acknowledged' | 'no_reply' | 'refused';

export interface PlanRow {
  id: string;
  case_id: string;
  user_id: string;
  run_id: string | null;
  ladder_step: number;
  summary: string | null;
  reasons: unknown[];
  dates: Record<string, string>;
  guidance_ids: string[];
  approved_at: string | null;
  rejected_at: string | null;
  draft_claim_token: string | null;
  draft_claimed_at: string | null;
  sent_on: string | null;
  outcome: PlanOutcome | null;
  created_at: string;
}

export type DraftKind = 'grievance_officer' | 'helpline';

export interface DraftRow {
  id: string;
  case_id: string;
  user_id: string;
  plan_id: string;
  kind: DraftKind;
  version: number;
  /** Model prose or code template with fact placeholders and no raw values. */
  template_md: string;
  /** Placeholders replaced by code. */
  rendered_md: string | null;
  lint: Record<string, unknown>;
  edited_by_user: boolean;
  created_at: string;
}
/** Migration 0013 records origin separately and preserves the run model for code-only drafts. */
export type DraftGenerationKind = 'model' | 'code_basic';

/** Caller-owned mark_plan_sent transaction in migration 0009. */
export interface SentPlanResult {
  plan: PlanRow;
  fact: CaseFactRow;
}

export interface GuidanceRow {
  id: string;
  title: string;
  body: string;
  source_name: string;
  source_url: string;
  checked_on: string;
  applies_to_steps: number[];
}

/** Returned by the `charge_model_call()` database function. */
export interface ModelChargeResult {
  allowed: boolean;
  reason: 'user_limit' | 'global_limit' | null;
  user_calls: number;
  user_limit: number;
}

/** Dashboard-managed app_settings limits; callers cannot read or change them through the API. */
export interface AppModelLimits {
  /** Charged once per logical call; fallback attempts share the charge. */
  per_user_daily_model_calls: number;
  global_daily_model_calls: number;
}

/** Public read-only retry metadata. Only the signed server receipt function can write it. */
export interface ModelAvailabilityRow {
  model_key: string;
  usable_after: string;
  reason: 'quota' | 'rate_limit' | 'high_demand' | 'timeout';
  updated_at: string;
}
