import { describe, expect, it, vi } from 'vitest';
import { markPlanSent } from '../../server/plans/mark-sent.js';
import type { SentPlanResult } from '../../shared/database.js';
describe('recording a sent date without a model', () => {
  const save = vi.fn(async () => ({ plan: { id: 'plan' } }) as SentPlanResult);
  it.each(['2026-02-30', '03/10/2026', '2026-10-03'])(
    'refuses invalid or future sent date %s',
    async (sentOn) => {
      save.mockClear();
      await expect(markPlanSent(save, 'plan', sentOn, '2026-10-02')).rejects.toThrow();
      expect(save).not.toHaveBeenCalled();
    },
  );
  it('calls the caller-owned transaction once with the explicit date', async () => {
    save.mockClear();
    await markPlanSent(save, 'plan', '2026-09-30', '2026-10-02');
    expect(save).toHaveBeenCalledExactlyOnceWith('plan', '2026-09-30', '2026-10-02');
  });
  it('reports a stale, unapproved or unavailable plan plainly', async () => {
    await expect(
      markPlanSent(async () => null, 'plan', '2026-09-30', '2026-10-02'),
    ).rejects.toMatchObject({ status: 409, code: 'sent_date_unavailable' });
  });
});
