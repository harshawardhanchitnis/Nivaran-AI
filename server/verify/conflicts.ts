import type { EvidenceItemRow } from '../../shared/database.js';
import type { FactField } from '../../shared/facts.js';
import { normaliseFact, type NormalisedFact } from './normalise.js';

export interface NormalisedEvidence { item: EvidenceItemRow; value: NormalisedFact | null }

export function normaliseEvidence(field: FactField, items: readonly EvidenceItemRow[]): NormalisedEvidence[] {
  // Do not trust stored model-written normalisations; compute every value again.
  return items.filter(item => item.field === field).map(item => ({ item, value: normaliseFact(field, item.value_text) }));
}

export function findConflicts(values: readonly NormalisedEvidence[]): NormalisedEvidence[][] {
  const groups = new Map<string, NormalisedEvidence[]>();
  for (const value of values) {
    if (!value.value) continue;
    const key = JSON.stringify(value.value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups.size > 1 ? [...groups.values()] : [];
}
