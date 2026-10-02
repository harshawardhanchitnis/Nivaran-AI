import type { CaseRow } from '@shared/database';

import { caseSummary } from './case-summary';

const row: CaseRow = {
  id: 'case-one', user_id: 'owner', title: 'Refund not received', merchant_name: null,
  status: 'open', ladder_step: null, is_sample: false,
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
};

describe('caseSummary', () => {
  it('does not invent a step or date for a newly uploaded case', () => {
    expect(caseSummary(row, 3, {}, '2026-10-02')).toMatchObject({
      id: row.id, title: row.title, documentCount: 3, status: 'Documents added',
      step: null, nextDate: null,
    });
  });

  it.each([
    { dates: { resolve_by: '2026-11-01', acknowledge_by: '2026-10-03' }, today: '2026-10-02', date: '2026-10-03', overdue: false },
    { dates: { refund_due: '2026-10-02' }, today: '2026-10-02', date: '2026-10-02', overdue: false },
    { dates: { refund_due: '2026-09-14', acknowledge_by: '2026-09-20' }, today: '2026-10-02', date: '2026-09-20', overdue: true },
  ])('shows the next stored deadline, or the latest overdue deadline: $date', ({ dates, today, date, overdue }) => {
    const summary = caseSummary({ ...row, status: 'plan_ready', ladder_step: 1 }, 2, dates, today);
    expect(summary.step).toContain('grievance officer');
    expect(summary.nextDate).toMatchObject({ date, overdue });
  });

  it.each(['resolved', 'out_of_scope'] as const)('has no pending deadline for a %s case', (status) => {
    expect(caseSummary({ ...row, status }, 1, { resolve_by: '2026-10-03' }, '2026-10-02').nextDate).toBeNull();
  });

  it('ignores unknown, invalid or assumed deadline values', () => {
    const summary = caseSummary(row, 0, { unknown: '2026-10-03', refund_due: '2026-02-30', acknowledge_by: 'tomorrow' }, '2026-10-02');
    expect(summary.nextDate).toBeNull();
  });
});
