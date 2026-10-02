import { describe, expect, it } from 'vitest';
import { lintDraft } from '../../shared/draft-lint.js';
const facts = [
  {
    field: 'refund_amount',
    status: 'document' as const,
    value_norm: { kind: 'amount', currency: 'INR', decimal: '9999.00' },
  },
  { field: 'order_id', status: 'user' as const, value_norm: { kind: 'id', value: 'MM-123456' } },
  {
    field: 'order_date',
    status: 'user' as const,
    value_norm: { kind: 'date', value: '2026-09-14' },
  },
];
describe('shared draft value checks', () => {
  it.each([
    '₹8,999',
    'Rs. 8999',
    'INR 8999',
    '8999',
    '₹-9999',
    '-9999',
    'INR 9999.123',
    '13/09/2026',
    '2026-02-30',
    '13 September 2026',
    'September 13, 2026',
    'TX99887766',
  ])('flags unsupported amount/date/ID %s', (text) => {
    expect(lintDraft(text, { facts, dates: {}, today: '2026-10-02' })).toHaveLength(1);
  });
  it('accepts an all-numeric order ID without treating it as an unsupported amount', () => {
    expect(
      lintDraft('123456789', {
        facts: [
          { field: 'order_id', status: 'user', value_norm: { kind: 'id', value: '123456789' } },
        ],
        dates: {},
        today: '2026-10-02',
      }),
    ).toEqual([]);
  });
  it('accepts normalised fact values and code dates without counting nested numbers again', () => {
    expect(
      lintDraft('INR 9,999.00 MM-123456 14 Sept 2026 01/11/2026 2 Oct 2026', {
        facts,
        dates: { resolve_by: '2026-11-01' },
        today: '2026-10-02',
      }),
    ).toEqual([]);
  });
  it('checks conflicts, unchecked facts, partial IDs and false source labels', () => {
    expect(
      lintDraft('₹9,999 MM-123456', {
        facts: facts.map((f) => ({ ...f, status: 'conflict' })),
        dates: {},
        today: '2026-10-02',
      }),
    ).toHaveLength(2);
    expect(
      lintDraft('TX99887766 [E02] MM-1234567', { facts, dates: {}, today: '2026-10-02' }),
    ).toHaveLength(2);
  });
  it('ignores only code-inserted spans and explicit personal spans', () => {
    expect(
      lintDraft('₹8,999 TX99887766', {
        facts,
        dates: {},
        today: '2026-10-02',
        ignore: [{ start: 0, end: 6 }],
      }),
    ).toMatchObject([{ text: 'TX99887766' }]);
  });
  it('keeps only a value the user explicitly marked as their statement', () => {
    expect(
      lintDraft('TX99887766 TX99887767', {
        facts,
        dates: {},
        today: '2026-10-02',
        userStatements: ['TX99887766'],
      }),
    ).toMatchObject([{ text: 'TX99887767' }]);
  });
  it('documents that amounts written only in words and prose claims are outside this scanner', () => {
    expect(
      lintDraft('They owe me nine thousand rupees and promised compensation.', {
        facts,
        dates: {},
        today: '2026-10-02',
      }),
    ).toEqual([]);
  });
});
