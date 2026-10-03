import { z } from 'zod';
import { FACT_FIELDS } from '../shared/facts.js';
import type { AgentEventRow, AgentRunRow, CaseFactRow, DocumentRow, DraftRow, EvidenceItemRow, PlanRow, QuestionRow } from '../shared/database.js';
import type { CallCounts } from './budget.js';
const expectedFact = z.object({status:z.enum(['document','conflict','missing','absent']),value:z.record(z.string(),z.unknown()).optional()});
export const evalCaseSchema = z.object({
  id:z.string().regex(/^[a-z0-9-]+$/),title:z.string(),today:z.iso.date(),
  documents:z.array(z.object({file:z.string().regex(/^[a-z0-9-]+\.(pdf|png)$/),title:z.string(),lines:z.array(z.string()),format:z.enum(['pdf','image','blurred'])})).min(1).max(6),
  expected:z.object({facts:z.partialRecord(z.enum(FACT_FIELDS),expectedFact),outcome:z.enum(['ladder','out_of_scope','bank_delay','needs_input']),
    step:z.number().int().min(0).max(3).nullable(),pauses:z.array(z.object({kind:z.string(),field:z.enum(FACT_FIELDS).nullable()})),draftKind:z.enum(['grievance_officer','helpline']).nullable()}),
  answers:z.partialRecord(z.enum(FACT_FIELDS),z.string()),injectionMarker:z.string().optional(),
});
export type EvalCase = z.infer<typeof evalCaseSchema>;
export type ObservedFact = Pick<CaseFactRow,'field'|'status'|'value_norm'>;
export interface EvaluationObservation {
  caseId:string; repetition:number; mode:'live'; datasetHash:string; startedAt:string;
  status:'finished'|'interrupted'; stopReason:string|null; seconds:number; calls:CallCounts;
  runStatus:string|null; runError:string|null;
  initialFacts:ObservedFact[]; finalFacts:ObservedFact[];
  quotes:{passed:number;total:number}; pauses:Array<{kind:string;field:string|null}>;
  outcome:string|null; step:number|null; draftKind:string|null; injectionMarkerSeen:boolean;
  // Synthetic rows retained for auditing and later saved-run fixtures. No session or key is included.
  saved: { run:AgentRunRow; documents:DocumentRow[]; facts:CaseFactRow[]; evidence:EvidenceItemRow[]; questions:QuestionRow[];
    events:AgentEventRow[]; plan:PlanRow|null; draft:DraftRow|null } | null;
}
