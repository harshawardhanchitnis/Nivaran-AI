import type { AgentEventRow, AgentRunRow, CaseFactRow, DocumentRow, DraftRow, EvidenceItemRow, GuidanceRow, PlanRow, QuestionRow } from './database.js';

export const SAMPLE_CASES = [
  { id: 'clean-overdue', title: 'Refund overdue', description: 'Read the sources, dates and saved grievance complaint.' },
  { id: 'conflicting-amounts', title: 'Two refund amounts', description: 'See the actual question and the recorded consumer answer.' },
  { id: 'not-yet-due', title: 'Still within the promised date', description: 'A saved waiting plan from the earlier measured pass.' },
  { id: 'already-complained', title: 'Already complained', description: 'A helpline plan, with its draft-generation failure disclosed.' },
  { id: 'out-of-scope', title: 'Outside the refund journey', description: 'See the stopped run and its failed document read.' },
] as const;
export interface SavedSample {
  id: string; title: string; today: string; recordedAt: string; provenance: string; warning: string | null;
  logicalCalls: number; providerAttempts: number; models: Record<string, number>;
  run: AgentRunRow; documents: DocumentRow[]; facts: CaseFactRow[]; evidence: EvidenceItemRow[];
  questions: QuestionRow[]; events: AgentEventRow[]; plan: PlanRow | null; draft: DraftRow | null; guidance: GuidanceRow[];
}
export function sampleCase(id: string | null) { return SAMPLE_CASES.find(sample => sample.id === id) ?? null; }
/** Only repository-owned synthetic files can be opened by a public sample. */
export function sampleDocumentPath(sample: SavedSample, document: DocumentRow): string {
  if (!sampleCase(sample.id) || !sample.documents.some(row => row.id === document.id && row.file_name === document.file_name) ||
      !/^[a-z0-9-]+\.(pdf|png)$/.test(document.file_name)) throw new Error('This sample document is unavailable.');
  return `/samples/${sample.id}/${document.file_name}`;
}
