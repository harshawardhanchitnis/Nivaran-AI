import type { CaseFactRow, EvidenceItemRow } from '../../shared/database.js';
import { FACT_FIELDS, isFactField, type FactField } from '../../shared/facts.js';
import { findConflicts, normaliseEvidence } from '../verify/conflicts.js';
import { normaliseFact } from '../verify/normalise.js';

export type FactSheetValue = Pick<CaseFactRow, 'field' | 'status' | 'value_text' | 'value_norm' | 'evidence_item_id' | 'confirmed_by_user'>;
type UserDecision = Pick<CaseFactRow, 'field' | 'value_text' | 'confirmed_by_user'>;

/** Every status, conflict and canonical value is decided in code. No model score. */
export function buildFactSheet(
  items: readonly EvidenceItemRow[], required: readonly FactField[] = FACT_FIELDS,
  decisions: readonly UserDecision[] = [],
): FactSheetValue[] {
  const fields = new Set<FactField>(required);
  items.forEach(item => { if (isFactField(item.field)) fields.add(item.field); });
  return FACT_FIELDS.filter(field => fields.has(field)).map<FactSheetValue>(field => {
    const decision = decisions.find(row => row.field === field && row.confirmed_by_user && row.value_text !== null);
    if (decision?.value_text) return { field, status: 'user', value_text: decision.value_text,
      value_norm: normaliseFact(field, decision.value_text), evidence_item_id: null, confirmed_by_user: true };
    const values = normaliseEvidence(field, items);
    const first = values[0];
    if (!first) return { field, status: 'missing', value_text: null, value_norm: null, evidence_item_id: null, confirmed_by_user: false };
    const unchecked = values.some(({ item, value }) => !value || (item.source === 'document' && (!item.document_id || !item.quote?.trim() || item.quote_verified !== true)));
    const status = unchecked ? 'needs_check' : findConflicts(values).length ? 'conflict'
      : values.some(value => value.item.source === 'document') ? 'document' : 'user';
    return { field, status, value_text: status === 'conflict' ? null : first.item.value_text,
      value_norm: status === 'conflict' ? null : first.value,
      evidence_item_id: status === 'conflict' ? null : first.item.id, confirmed_by_user: false };
  });
}
