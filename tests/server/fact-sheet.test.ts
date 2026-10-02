import { describe, expect, it } from 'vitest';
import type { EvidenceItemRow } from '../../shared/database.js';
import { buildFactSheet } from '../../server/facts/build-fact-sheet.js';

const evidence = (id: string, value: string, overrides: Partial<EvidenceItemRow> = {}): EvidenceItemRow => ({
  id, case_id: 'case', user_id: 'owner', source: 'document', document_id: `document-${id}`,
  field: 'refund_amount', value_text: value, value_norm: null, page: 1,
  quote: `Refund ${value}`, quote_verified: true, created_at: '2026-10-02T00:00:00Z', ...overrides,
});

describe('fact sheet in code', () => {
  it('merges mixed amount formats into a document fact', () => {
    const sheet = buildFactSheet([evidence('one', '₹9,999.00'), evidence('two', 'Rs. 9999'), evidence('three', 'INR 9,999')], ['refund_amount']);
    expect(sheet).toEqual([expect.objectContaining({ field: 'refund_amount', status: 'document', value_norm: { kind: 'amount', currency: 'INR', decimal: '9999.00' }, evidence_item_id: 'one' })]);
  });
  it('keeps two different refund dates in conflict', () => {
    const sheet = buildFactSheet([evidence('one', '14 Sep 2026', { field: 'refund_due_date' }), evidence('two', '15/09/2026', { field: 'refund_due_date' })], ['refund_due_date']);
    expect(sheet[0]?.status).toBe('conflict'); expect(sheet[0]?.value_text).toBeNull();
  });
  it.each([null, false])('does not promote a quote that is %s', quote_verified => {
    expect(buildFactSheet([evidence('one', '9999', { quote_verified })], ['refund_amount'])[0]?.status).toBe('needs_check');
  });
  it('does not let an unconfirmed contradiction overrule a confirmed source silently', () => {
    expect(buildFactSheet([evidence('one', '9999'), evidence('two', '8999', { quote_verified: false })], ['refund_amount'])[0]?.status).toBe('needs_check');
  });
  it('keeps an unparseable amount for human checking even with a matching quote', () => {
    expect(buildFactSheet([evidence('one', 'about nine thousand')], ['refund_amount'])[0]).toMatchObject({ status: 'needs_check', value_norm: null });
  });
  it('creates missing rows only for the requested required fields', () => {
    expect(buildFactSheet([], ['order_id'])).toEqual([expect.objectContaining({ field: 'order_id', status: 'missing', value_text: null, evidence_item_id: null })]);
  });
  it('labels a user-only value as a statement without claiming a document quote', () => {
    const sheet = buildFactSheet([evidence('one', '9999', { source: 'user', document_id: null, quote: null, quote_verified: null })], ['refund_amount']);
    expect(sheet[0]).toMatchObject({ status: 'user', confirmed_by_user: false });
  });
  it('preserves an explicit user decision on a conflict as Your statement', () => {
    const rows = [evidence('one', '9999'), evidence('two', '8999')];
    const sheet = buildFactSheet(rows, ['refund_amount'], [{ field: 'refund_amount', value_text: '8999', confirmed_by_user: true }]);
    expect(sheet[0]).toMatchObject({ status: 'user', value_text: '8999', evidence_item_id: null, confirmed_by_user: true });
  });
});
