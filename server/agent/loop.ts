import type { AgentAdvanceResponse } from '../../shared/api.js';
import type { AgentRunRow, CaseFactRow, DocumentRow, GuidanceRow } from '../../shared/database.js';
import { isFactField } from '../../shared/facts.js';
import type { CheckedFactSheet } from '../facts/verify-facts.js';
import { buildFactSheet } from '../facts/build-fact-sheet.js';
import { HttpError } from '../http.js';
import type { ModelRole } from '../llm/provider.js';
import type { ReadDocumentResult } from '../reader/read-document.js';
import { StaleTurnError, rateLimitDelay } from './reading.js';
import { executeTool } from './tools/index.js';
import { questionAnswer, run as recordStatement } from './tools/record-user-statement.js';
import type { AgentSnapshot, InvestigationChanges, ToolContext } from './tools/types.js';
import { outcomeStep } from './outcome-step.js';
import {conflictAction,progressFor,toolSignature} from './progress.js';
export type { AgentSnapshot, InvestigationChanges } from './tools/types.js';

export interface InvestigationStore {
  getRun(id: string): Promise<AgentRunRow>;
  claim(id: string, turn: number): Promise<AgentRunRow | null>;
  release(run: AgentRunRow): Promise<void>;
  snapshot(run: AgentRunRow): Promise<AgentSnapshot>;
  finishStep(run: AgentRunRow, changes: InvestigationChanges): Promise<AgentAdvanceResponse | null>;
  searchGuidance(query: string): Promise<GuidanceRow[]>;
}
export interface InvestigationDependencies {
  /** Injected fake calls may charge here; the production chooser charges within its router. */
  charge?(): Promise<void>;
  choose(snapshot: AgentSnapshot, run: AgentRunRow): Promise<{ name: string; input: unknown; modelId?: string }>;
  check(snapshot: AgentSnapshot, role: ModelRole): Promise<CheckedFactSheet>;
  reread(document: DocumentRow, role: ModelRole, question: string): Promise<ReadDocumentResult>;
  nextStep(facts: readonly CaseFactRow[], snapshot: AgentSnapshot): Promise<Record<string, unknown>>;
}

/** One charged model call OR a deferred read/check per request, and one atomic turn commit. */
export async function advanceInvestigation(store: InvestigationStore, deps: InvestigationDependencies, runId: string, expectedTurn: number): Promise<AgentAdvanceResponse> {
  const current = await store.getRun(runId);
  if (current.turn !== expectedTurn) throw new StaleTurnError(current);
  const initial = await store.snapshot(current);
  const latestQuestion = initial.questions.at(-1);
  const answered = latestQuestion?.answer !== null && latestQuestion?.answered_at && latestQuestion.id !== current.agent_state.answered_question_id ? latestQuestion : undefined;
  if (current.status === 'waiting_for_user' && !answered) return { run: current, events: [] };
  if (current.status !== 'running' && current.status !== 'waiting_for_user') return { run: current, events: [] };
  const run = await store.claim(runId, expectedTurn);
  if (!run) throw new StaleTurnError(await store.getRun(runId));
  let finished = false;
  const commit = async (changes: InvestigationChanges) => {
    const result = await store.finishStep(run, changes);
    if (!result) throw new StaleTurnError(await store.getRun(runId));
    finished = true; return result;
  };
  try {
    const snapshot = await store.snapshot(run);
    const context: ToolContext = { snapshot, state: run.agent_state, searchGuidance: query => store.searchGuidance(query), nextStep: facts => deps.nextStep(facts, snapshot) };
    if (run.status === 'waiting_for_user' && answered) {
      const value = questionAnswer(answered);
      if (!value || value.length > 4000) throw new HttpError(400, 'answer_invalid', 'Please enter an answer or choose one of the options.');
      const changes = answered.field && isFactField(answered.field) ? recordStatement({ field: answered.field, value }, context).changes : {};
      return await commit({ ...changes, status: 'running', state: { ...run.agent_state, next_step: undefined, answered_question_id: answered.id },
        events: [{ type: 'answer', payload: { field: answered.field, questionId: answered.id, message: 'Saved your answer. Continuing the case.' } }] });
    }
    const pending = run.agent_state.pending_reread;
    if (pending) {
      const document = snapshot.documents.find(document => document.id === pending.document_id);
      if (!document) throw new HttpError(404, 'document_not_found', 'The requested document is no longer available.');
      let result: ReadDocumentResult;
      try {
        result = await deps.reread(document, pending.role, pending.question);
      } catch (error) {
        if (error instanceof HttpError) throw error;
        const delay = rateLimitDelay(error); if (delay !== null) return { run: current, events: [], retryAfterMs: delay };
        return await commit({ state: { ...run.agent_state, pending_reread: undefined },
          events: [{ type: 'error', payload: { tool: 'reread_document', message: `Could not reread ${document.label}. Your earlier facts are saved.` } }] });
      }
      return await commit({ state: { ...run.agent_state, pending_reread: undefined, quotes_checked: false, next_step: undefined }, model: result.modelId,
        reread: { document_id: document.id, read_status: result.readable ? 'read' : 'unreadable', doc_type: result.docType, facts: result.facts },
        events: [{ type: 'tool_result', payload: { tool: 'reread_document', label: document.label, modelId:result.modelId,rejectedFactCount:result.rejectedFactCount??0, message: `Took another look at ${document.label}.` } }] });
    }
    if (!run.agent_state.quotes_checked) {
      let checked: CheckedFactSheet;
      try {
        checked = await deps.check(snapshot, run.agent_state.image_quote_role ?? 'primary');
      } catch (error) {
        if (error instanceof HttpError) throw error;
        const delay = rateLimitDelay(error); if (delay !== null) return { run: current, events: [], retryAfterMs: delay };
        const evidence = snapshot.evidence.map(item => ({ ...item, quote_verified: item.quote_verified ?? false }));
        return await commit({ state: { ...run.agent_state, quotes_checked: true, image_quote_role: undefined }, evidence,
          facts: buildFactSheet(evidence, undefined, snapshot.facts),
          events: [{ type: 'error', payload: { tool: 'check_quotes', message: 'Some source quotes need your check. Your case is still available.' } }] });
      }
      return await commit({ state: { ...run.agent_state, quotes_checked: true, image_quote_role: undefined }, evidence: checked.evidence, model:checked.modelId,
        facts: checked.facts, events: [{ type: 'tool_result', payload: { tool: 'check_quotes', modelId:checked.modelId, message: 'Checked source quotes and built the fact sheet.' } }] });
    }
    if (run.agent_state.outcome_update && !run.agent_state.outcome_decision_done)
      return await commit(await outcomeStep(context));
    if (run.agent_steps >= run.max_agent_steps) return await commit({ status: 'failed', phase: 'done', error: 'Nivaran could not finish within its step limit. Your facts are saved.',
      events: [{ type: 'error', payload: { message: 'Nivaran could not finish within its step limit. Your facts are saved.' } }] });
    await deps.charge?.();
    let selection: Awaited<ReturnType<InvestigationDependencies['choose']>>;
    try { selection = await deps.choose(snapshot, run); }
    catch (error) {
      if (error instanceof HttpError) throw error;
      const delay = rateLimitDelay(error); if (delay !== null) return { run: current, events: [], retryAfterMs: delay };
      return await commit({ count_step: true, events: [{ type: 'error', payload: { message: 'The model could not choose a usable step. Your facts are saved.' } }] });
    }
    const progress=progressFor(snapshot,run),signature=toolSignature(selection.name,selection.input);
    const repeated=progress.actions.includes(signature);
    const call = { type: 'tool_call' as const, payload: { tool: selection.name, input: selection.input, modelId:selection.modelId, message: `Chose ${selection.name.replaceAll('_', ' ')}.` } };
    if(repeated) {
      const forced=conflictAction(snapshot);
      if(!forced)return await commit({status:'failed',phase:'done',model:selection.modelId,
        error:'The same step was repeated without changing the facts. Your case is saved; please review the missing information.',
        events:[call,{type:'error',payload:{action:'no_progress',message:'Stopped a repeated step that did not change the facts.'}}]});
      const tool=await executeTool(forced.name,forced.input,context);
      return await commit({...tool.changes,model:selection.modelId,count_step:false,
        events:[call,{type:'decision',payload:{action:'repeat_guard',tool:forced.name,field:forced.input.field,message:'A step repeated without changing the facts. Code requested your choice for the open conflict.'}},
          {type:'question',payload:{tool:forced.name,result:tool.result,message:tool.message}}]});
    }
    const state={...run.agent_state,progress:{facts:progress.facts,actions:[...progress.actions,signature].slice(-10)}};
    context.state=state;
    let tool: Awaited<ReturnType<typeof executeTool>>;
    try { tool = await executeTool(selection.name, selection.input, context); }
    catch {
      return await commit({ count_step: true, state, model: selection.modelId,
        events: [call, { type: 'error', payload: { tool: selection.name, modelId:selection.modelId, message: 'Nivaran could not use that step. Your facts are saved.' } }] });
    }
    return await commit({ state, ...tool.changes, count_step: true, model: selection.modelId,
      events: [call, { type: tool.changes?.question ? 'question' : 'tool_result', payload: { tool: selection.name, modelId:selection.modelId, result: tool.result, message: tool.message } }] });
  } finally { if (!finished) await store.release(run); }
}
