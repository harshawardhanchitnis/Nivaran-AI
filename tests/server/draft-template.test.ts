import { describe, expect, it } from 'vitest';
import { assembleComplaint, basicComplaint, templateIssue } from '../../server/draft/template.js';
import { renderDraft } from '../../shared/draft-render.js';
import type { PlanRow } from '../../shared/database.js';
import { context } from '../fixtures/draft.js';

const dated = { ...context, facts: [...context.facts,
  { field: 'merchant_name', status: 'user' as const, value_text: 'Meridian Mart', value_norm: { kind: 'text', value: 'Meridian Mart' }, evidence_item_id: null },
  ...(['refund_promise_date', 'refund_due_date'] as const).map((field, i) => ({ field, status: 'user' as const,
    value_text: i ? '2026-09-24' : '2026-09-14', value_norm: { kind: 'date', value: i ? '2026-09-24' : '2026-09-14' }, evidence_item_id: null })),
  { field: 'refund_received', status: 'user' as const, value_text: 'No', value_norm: { kind: 'boolean', value: false }, evidence_item_id: null },
] };
describe('code-owned complaint chronology', () => {
  it('preserves the exact deployed promise-on versus due-by distinction', () => {
    const draft = renderDraft(assembleComplaint('Please resolve my refund.', dated), dated).text;
    expect(draft).toContain('promise was made on 14 Sept 2026 [your statement]');
    expect(draft).toContain('Refund due by 24 Sept 2026 [your statement]');
    expect(draft).not.toContain('due by 14');
  });
  it.each([
    ['Refund INR 9999.', 'literal_value'], ['Call 1915.', 'literal_value'], ['Rule 4(5).', 'literal_value'],
    ['Refund promised by {{fact:refund_promise_date}}.', 'date_in_model_prose'],
    ['Due {{date:refund_due}}.', 'date_in_model_prose'], ['{{fact:secret}}', 'placeholder_unavailable'],
    ['', 'empty'], ['x'.repeat(20001), 'too_long'], ['{{fact:refund_reference}}', 'placeholder_unavailable'],
  ])('returns a safe validation code for %s', (template, code) => expect(templateIssue(template, dated)).toBe(code));
  it.each([1, 2])('renders an explicit basic complaint at step %s with evidence labels', step => {
    const template = basicComplaint({ ladder_step: step } as PlanRow, dated);
    const draft = renderDraft(template, dated).text;
    expect(draft).toContain('₹9,999 [E02]');
    expect(draft).toContain('Complaint sent on 1 Oct 2026 [your statement]');
    expect(draft).toContain('{{you:contact}}');
    if (step === 2) expect(draft).toContain('Requested remedy');
  });
  it('refuses a basic template with conflicting facts or an arrived refund', () => {
    expect(() => basicComplaint({ ladder_step: 2 } as PlanRow, context)).toThrow();
    expect(() => basicComplaint({ ladder_step: 2 } as PlanRow, { ...dated,
      facts: dated.facts.map(f => f.field === 'refund_received' ? { ...f, value_norm: { kind: 'boolean', value: true } } : f) })).toThrow();
  });
  it('labels a calculated promise period separately from a no-date working assumption', () => {
    const period = { ...dated, facts: dated.facts.map(f => f.field === 'refund_due_date' ? { ...f, value_norm: { kind: 'duration', n: 7, unit: 'working_days' } } : f) };
    const text = renderDraft(assembleComplaint('Please resolve.', period), period).text;
    expect(text).toContain('Promised refund period: 7 working days');
    expect(text).toContain('public holidays are not handled');
    expect(text).not.toContain('working assumption');
    const absent = { ...period, facts: period.facts.map(f => f.field === 'refund_due_date' ? { ...f, status: 'user' as const, value_norm: { kind: 'absent', value: false } } : f) };
    // Only a cancellation-based assumption gets the assumption wording.
    expect(assembleComplaint('Please resolve.', absent)).not.toContain('working assumption');
  });
});
