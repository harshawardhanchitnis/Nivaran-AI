import type { CaseFactRow } from '../../shared/database.js';
import type { FactField } from '../../shared/facts.js';
import type { LadderStep } from '../../shared/ladder.js';
import { dateValue } from './dates.js';
import { refundNotReceived } from './refund-not-received.js';

export type LadderFacts = readonly Pick<CaseFactRow, 'field' | 'status' | 'value_norm' | 'confirmed_by_user'>[];
/** Explicit context from checked evidence or a saved user outcome; never inferred from an ID. */
export interface LadderContext { refundProcessed?: boolean; helplineUnresolved?: boolean }
export type LadderReason = { code: string; text: string; fields: FactField[]; guidanceIds: string[] };
export type LadderDecision = {
  outcome: 'resolved' | 'needs_input' | 'bank_delay' | 'ladder'; step?: LadderStep;
  reasons: LadderReason[]; dates: Record<string, string>; notes: string[];
  requiredFields: FactField[]; canDraft: boolean;
};
/** All inputs are data and today is injectable. No clock, database or model call in the engine. */
export function nextStep(facts: LadderFacts, today: string, context: LadderContext = {}): LadderDecision {
  dateValue(today);
  return refundNotReceived(facts, today, context);
}
