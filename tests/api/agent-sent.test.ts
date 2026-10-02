import { beforeEach, describe, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ requireUser: vi.fn(), rpc: vi.fn() }));
vi.mock('../../server/auth.js', () => ({ requireUser: fake.requireUser }));
vi.mock('../../server/ladder/dates.js', () => ({ indiaToday: () => '2026-10-02' }));
import { POST } from '../../api/agent/sent.js';
import { HttpError } from '../../server/http.js';
const id = '44444444-4444-4444-8444-444444444444';
const request = (body: unknown) =>
  new Request('http://localhost/api/agent/sent', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks();
  fake.requireUser.mockResolvedValue({ supabase: { rpc: fake.rpc } });
});
describe('sent-date endpoint', () => {
  it('requires authentication and refuses invalid or future dates before saving', async () => {
    fake.requireUser.mockRejectedValueOnce(new HttpError(401, 'unauthenticated', 'Sign in.'));
    expect((await POST(request({ planId: id, sentOn: '2026-10-01' }))).status).toBe(401);
    for (const input of [
      { planId: 'bad', sentOn: '2026-10-01' },
      { planId: id, sentOn: '2026-02-30' },
      { planId: id, sentOn: '2026-10-03' },
    ]) expect((await POST(request(input))).status).toBe(400);
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it('passes only the caller plan, sent date and server India date to the transaction', async () => {
    const saved = { plan: { id, sent_on: '2026-10-01' }, fact: { status: 'user' } };
    fake.rpc.mockResolvedValue({ data: saved, error: null });
    const response = await POST(request({ planId: id, sentOn: '2026-10-01', today: '2099-01-01' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(saved);
    expect(fake.rpc).toHaveBeenCalledExactlyOnceWith('mark_plan_sent', {
      p_plan_id: id, p_sent_on: '2026-10-01', p_today: '2026-10-02',
    });
  });
  it('returns a recoverable conflict for an unavailable plan or a transaction failure', async () => {
    fake.rpc.mockResolvedValueOnce({ data: null, error: null });
    const unavailable = await POST(request({ planId: id, sentOn: '2026-10-01' }));
    expect(unavailable.status).toBe(409);
    expect(await unavailable.json()).toMatchObject({ error: { code: 'sent_date_unavailable' } });
    fake.rpc.mockResolvedValue({ data: null, error: { message: 'private database detail' } });
    const failed = await POST(request({ planId: id, sentOn: '2026-10-01' }));
    expect(failed.status).toBe(409);
    expect(await failed.text()).not.toContain('private database detail');
  });
});
