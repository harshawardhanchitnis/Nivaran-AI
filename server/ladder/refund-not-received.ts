import type { CaseFactRow, EvidenceItemRow } from '../../shared/database.js';
import type { FactField } from '../../shared/facts.js';
import { normaliseDate } from '../../shared/normalise.js';
import { addCalendarDays, addCalendarMonths, addWorkingDays } from './dates.js';
import type { LadderContext, LadderDecision, LadderFacts, LadderReason } from './engine.js';

const row = (facts: LadderFacts, field: FactField) => facts.find(fact => fact.field === field);
const usable = (fact: LadderFacts[number] | undefined) => fact && (fact.status === 'document' || fact.status === 'user');
const uncertain = (fact: LadderFacts[number] | undefined) => fact?.status === 'conflict' || fact?.status === 'needs_check';
function date(fact: LadderFacts[number] | undefined): string | null {
  const value = usable(fact) && fact?.value_norm;
  return value && value['kind'] === 'date' && typeof value['value'] === 'string' && normaliseDate(value['value']) === value['value'] ? value['value'] : null;
}
function boolean(fact: LadderFacts[number] | undefined): boolean | null {
  const value = usable(fact) && fact?.value_norm;
  return value && value['kind'] === 'boolean' && typeof value['value'] === 'boolean' ? value['value'] : null;
}
const reason = (code: string, text: string, fields: FactField[], guidanceIds: string[] = []): LadderReason => ({ code, text, fields, guidanceIds });

/** The nine rules in SPEC section 4, plus its information-only unresolved-helpline branch. */
export function refundNotReceived(facts: LadderFacts, today: string, context: LadderContext): LadderDecision {
  const dates: Record<string, string> = { today }; const notes: string[] = [];
  const result = (outcome: LadderDecision['outcome'], reasons: LadderReason[], step?: LadderDecision['step']): LadderDecision =>
    ({ outcome, step, reasons, dates, notes, requiredFields: [], canDraft: outcome === 'ladder' && (step === 1 || step === 2) });
  const ask = (field: FactField, text: string): LadderDecision => ({ ...result('needs_input', [reason('needs_input', text, [field])]), requiredFields: [field] });
  const received = row(facts, 'refund_received');
  if (uncertain(received)) return ask('refund_received', 'Please confirm whether the refund arrived.');
  if (boolean(received) === true) return result('resolved', [reason('refund_received', 'You have recorded that the refund arrived.', ['refund_received'])]);

  const due = row(facts, 'refund_due_date'); let dueDate = date(due);
  if (!dueDate) {
    if (uncertain(due)) return ask('refund_due_date', 'Please resolve or confirm the refund due date.');
    if (due?.status === 'user' && due.value_norm?.['kind'] === 'absent') {
      const cancelled = date(row(facts, 'cancellation_or_return_date'));
      if (!cancelled) return ask('cancellation_or_return_date', 'Please give the cancellation or accepted-return date.');
      dueDate = addCalendarDays(cancelled, 7);
      notes.push("Nivaran's working assumption, not a rule: seven calendar days after cancellation or return because you said no date was given.");
    } else if (usable(due) && due?.value_norm?.['kind'] === 'duration') {
      const promise = date(row(facts, 'refund_promise_date'));
      if (!promise) return ask('refund_promise_date', 'Please confirm when this refund period was promised.');
      const n = due.value_norm['n']; const unit = due.value_norm['unit'];
      if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 1 || n > 36600) return ask('refund_due_date', 'Please confirm the refund period.');
      if (unit === 'working_days') {
        dueDate = addWorkingDays(promise, n); notes.push('Working days skip Saturdays and Sundays. Public holidays are not handled.');
      } else if (unit === 'calendar_days') dueDate = addCalendarDays(promise, n);
      else if (unit === 'calendar_months') dueDate = addCalendarMonths(promise, n);
      else return ask('refund_due_date', 'Please confirm the refund period.');
    } else return ask('refund_due_date', 'Please give the promised refund date, or say if no date was ever given.');
  }
  dates['refund_due'] = dueDate;
  if (today <= dueDate) return result('ladder', [reason('not_yet_due', 'The refund due date has not passed.', ['refund_due_date'], ['ecommerce-refund-payment'])], 0);

  const reference = row(facts, 'refund_reference');
  if (uncertain(reference)) return ask('refund_reference', 'Please resolve or confirm the refund reference.');
  if (usable(reference) && reference?.value_norm?.['kind'] === 'id' && typeof reference.value_norm['value'] === 'string' && reference.value_norm['value'].trim() && context.refundProcessed === true)
    return result('bank_delay', [reason('bank_reference', 'The merchant states that the refund was processed and supplied a reference. Take the reference to your bank to trace it.', ['refund_reference'], ['refund-bank-reference'])]);
  if (context.helplineUnresolved === true) return result('ladder', [reason('helpline_unresolved', 'You recorded that the helpline did not resolve the grievance. This step provides information only.', [], ['nch-unresolved'])], 3);

  const sent = row(facts, 'complaint_sent_date');
  if (uncertain(sent)) return ask('complaint_sent_date', 'Please confirm when the written complaint was sent.');
  const sentDate = date(sent);
  if (!sentDate) return result('ladder', [reason('overdue_no_complaint', 'The refund is overdue and no written complaint date is recorded.', ['refund_due_date', 'complaint_sent_date'], ['ecommerce-grievance-officer'])], 1);
  if (sentDate > today) return ask('complaint_sent_date', 'The complaint date is in the future. Please check it.');
  dates['acknowledge_by'] = addCalendarDays(sentDate, 2); dates['resolve_by'] = addCalendarMonths(sentDate, 1);
  const refused = row(facts, 'complaint_refused');
  if (uncertain(refused)) return ask('complaint_refused', 'Please confirm whether the refund was refused in writing.');
  if (boolean(refused) === true) return result('ladder', [reason('written_refusal', 'A written refusal is recorded after your complaint.', ['complaint_refused'], ['nch-overview'])], 2);
  const acknowledged = row(facts, 'complaint_acknowledged');
  if (boolean(acknowledged) === false && today > dates['acknowledge_by'])
    return result('ladder', [reason('no_acknowledgement', 'More than two calendar days have passed without an acknowledgement.', ['complaint_sent_date', 'complaint_acknowledged'], ['ecommerce-grievance-timelines', 'nch-overview'])], 2);
  if (today > dates['resolve_by']) return result('ladder', [reason('month_elapsed', 'More than one calendar month has passed since your complaint and the refund is still outstanding.', ['complaint_sent_date'], ['ecommerce-grievance-timelines', 'nch-overview'])], 2);
  if (today > dates['acknowledge_by'] && boolean(acknowledged) === null) return ask('complaint_acknowledged', 'Has the merchant acknowledged your complaint?');
  return result('ladder', [reason('complaint_wait', 'Your complaint is within the calculated waiting dates.', ['complaint_sent_date'], ['ecommerce-grievance-timelines'])], 1);
}

/** Narrow affirmative matching on the checked quote supporting the reference; no model inference. */
export function merchantSaysRefundProcessed(facts: readonly CaseFactRow[], evidence: readonly EvidenceItemRow[]): boolean {
  const reference = facts.find(fact => fact.field === 'refund_reference' && fact.status === 'document' && fact.value_norm?.['kind'] === 'id');
  const source = evidence.find(item => item.id === reference?.evidence_item_id && item.source === 'document' && item.quote_verified === true);
  const quote = source?.quote ?? '';
  return !/\b(?:not|never|will|pending|awaiting|scheduled)\b/i.test(quote)
    && /(?:^|[.!?\n])\s*(?:your\s+|the\s+)?refund\s+(?:has\s+been|was|is)\s+processed\b/i.test(quote);
}
