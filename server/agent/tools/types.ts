import type { CaseFactRow, DocumentRow, EvidenceItemRow, GuidanceRow, QuestionKind, QuestionRow, AgentState } from '../../../shared/database.js';
import type { FactSheetValue } from '../../facts/build-fact-sheet.js';
import type { AgentEventType, AgentRunStatus, AgentRunPhase } from '../../../shared/database.js';

export interface AgentSnapshot { documents: DocumentRow[]; evidence: EvidenceItemRow[]; facts: CaseFactRow[]; questions: QuestionRow[] }
export interface InvestigationChanges {
  status?: AgentRunStatus; phase?: AgentRunPhase; state?: AgentState; count_step?: boolean; model?: string; error?: string;
  evidence?: Array<Pick<EvidenceItemRow, 'id' | 'value_norm' | 'quote_verified'>>;
  facts?: FactSheetValue[];
  events: Array<{ type: AgentEventType; payload: Record<string, unknown> }>;
  question?: { id: string; kind: QuestionKind; field: string | null; prompt: string; options: unknown[] };
  statement?: { field: string; value_text: string };
  reread?: { document_id: string; read_status: string; doc_type: string; facts: unknown[] };
  plan?: { ladder_step: number; summary: string; reasons: unknown[]; dates: Record<string, string>; guidance_ids: string[] };
}
export interface ToolContext {
  snapshot: AgentSnapshot; state: AgentState;
  searchGuidance(query: string): Promise<GuidanceRow[]>;
  nextStep(facts: readonly CaseFactRow[]): Promise<Record<string, unknown>>;
}
export interface ToolResult { changes?: Omit<InvestigationChanges, 'events'>; result: Record<string, unknown>; message: string }
