import type { AgentRunRow } from '../../shared/database.js';
import { isFactField } from '../../shared/facts.js';
import type { FactField } from '../../shared/facts.js';
import type { AgentSnapshot } from './loop.js';
import type { toolSchemas } from './tools/index.js';

export function actionableFields(snapshot: AgentSnapshot, run: AgentRunRow): FactField[] {
  const conflicts = snapshot.facts.filter(f => f.status === 'conflict').map(f => f.field).filter(isFactField);
  if (conflicts.length) return conflicts;
  const decision = run.agent_state.next_step;
  if (decision?.['outcome'] === 'needs_input') return Array.isArray(decision['requiredFields']) ? decision['requiredFields'].filter(isFactField) : [];
  if (decision?.['canDraft'] === true) {
    return (['merchant_name','order_id','refund_amount','refund_received'] as const).filter(field =>
      !snapshot.facts.some(f => f.field === field && ['document','user'].includes(f.status) && f.value_norm !== null));
  }
  return [];
}
export function needsClearerDocument(snapshot: AgentSnapshot): boolean {
  const latestReplacement = snapshot.questions.filter(q => q.kind === 'document_request' && q.answered_at && q.answer && typeof q.answer === 'object' && 'documentId' in q.answer)
    .map(q => snapshot.documents.find(d => d.id === (q.answer as Record<string,unknown>)['documentId']))
    .filter(d => d !== undefined).sort((a,b) => a.created_at.localeCompare(b.created_at)).at(-1);
  return snapshot.documents.some(d => ['unreadable','failed'].includes(d.read_status) && (!latestReplacement || d.created_at >= latestReplacement.created_at));
}
export function requiredGuidanceLoaded(run: AgentRunRow): boolean {
  const decision = run.agent_state.next_step;
  const reasons = decision?.['reasons'];
  const ids = Array.isArray(reasons) ? reasons.flatMap(r => r && typeof r === 'object' && 'guidanceIds' in r && Array.isArray(r.guidanceIds) ? r.guidanceIds.filter((id:unknown):id is string => typeof id === 'string') : []) : [];
  const dates = decision?.['dates']; const today = dates && typeof dates === 'object' && 'today' in dates ? dates.today : null;
  return ids.length > 0 && typeof today === 'string' && ids.every(id => run.agent_state.checked_guidance?.some(g =>
    g.id === id && /^\d{4}-\d{2}-\d{2}$/.test(g.checked_on) && g.checked_on <= today && /^https?:\/\//.test(g.source_url) && g.applies_to_steps.includes(Number(decision?.['step']))));
}
/** Offer useful actions only. The ladder itself remains the SPEC section-four pure function. */
export function activeToolNames(snapshot: AgentSnapshot, run: AgentRunRow): Array<keyof typeof toolSchemas> {
  if (snapshot.facts.some(f => f.status === 'conflict')) return ['ask_user'];
  if (needsClearerDocument(snapshot)) return ['request_document'];
  if (actionableFields(snapshot, run).length) return ['ask_user','reread_document','request_document'];
  const decision = run.agent_state.next_step;
  if (decision?.['outcome'] === 'ladder') return requiredGuidanceLoaded(run) ? ['propose_plan'] : ['search_guidance'];
  return ['get_next_step','mark_out_of_scope'];
}
