import { vi } from 'vitest';
import type { AgentRunRow } from '@shared/database';
import { ApiError } from './api.service';
import { continueReading } from './reading-loop';

const run = (turn = 0, phase: AgentRunRow['phase'] = 'reading') => ({ id: 'run', status: phase === 'done' ? 'plan_ready' : 'running', phase, turn }) as AgentRunRow;

describe('resumable browser reading loop', () => {
  it('starts once and advances reading and investigation serially until a plan', async () => {
    let inFlight = 0;
    const turns: number[] = [];
    const start = vi.fn(async () => run());
    const advance = vi.fn(async (current: AgentRunRow) => {
      inFlight += 1; expect(inFlight).toBe(1); turns.push(current.turn);
      await Promise.resolve(); inFlight -= 1;
      return { run: run(current.turn + 1, current.turn === 2 ? 'done' : current.turn === 1 ? 'investigating' : 'reading'), events: [] };
    });
    const refresh = vi.fn(async () => {});
    await continueReading(null, { start, advance, current: async () => run(), refresh, wait: async () => {}, delay: () => {}, signal: new AbortController().signal });
    expect(start).toHaveBeenCalledTimes(1); expect(turns).toEqual([0, 1, 2]); expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('returns a saved plan without starting or advancing', async () => {
    const start = vi.fn(); const advance = vi.fn();
    await continueReading(run(7, 'done'), { start, advance, current: vi.fn(), refresh: vi.fn(), wait: vi.fn(), delay: vi.fn(), signal: new AbortController().signal });
    expect(start).not.toHaveBeenCalled(); expect(advance).not.toHaveBeenCalled();
  });

  it('waits for a provider delay and reuses the unchanged turn', async () => {
    const advance = vi.fn().mockResolvedValueOnce({ run: run(4), events: [], retryAfterMs: 4000 })
      .mockResolvedValueOnce({ run: run(5, 'done'), events: [] });
    const wait = vi.fn(async () => {}); const delay = vi.fn(); const cooldown = vi.fn();
    await continueReading(run(4), { start: vi.fn(), advance, current: vi.fn(), refresh: vi.fn(), wait, delay, cooldown, signal: new AbortController().signal });
    expect(advance.mock.calls.map(c => c[0].turn)).toEqual([4, 4]);
    expect(wait).toHaveBeenCalledWith(4000); expect(delay).toHaveBeenCalledWith(true);
    expect(cooldown).toHaveBeenCalledExactlyOnceWith(4000);
    expect(delay).toHaveBeenLastCalledWith(false);
  });

  it('reloads the stored turn after a conflict instead of repeating the old request', async () => {
    const advance = vi.fn().mockRejectedValueOnce(new ApiError(409, 'stale_turn', 'Refresh'))
      .mockResolvedValueOnce({ run: run(3, 'done'), events: [] });
    const current = vi.fn(async () => run(2));
    await continueReading(run(1), { start: vi.fn(), advance, current, refresh: vi.fn(), wait: vi.fn(), delay: vi.fn(), signal: new AbortController().signal });
    expect(advance.mock.calls.map(c => c[0].turn)).toEqual([1, 2]);
  });

  it.each([new ApiError(429, 'quota_exhausted', 'Daily limit reached.'), new ApiError(0, 'network_error', 'Offline')])('stops on %s without losing stored progress', async (error) => {
    const advance = vi.fn().mockRejectedValue(error);
    await expect(continueReading(run(), { start: vi.fn(), advance, current: vi.fn(), refresh: vi.fn(), wait: vi.fn(), delay: vi.fn(), signal: new AbortController().signal })).rejects.toBe(error);
    expect(advance).toHaveBeenCalledTimes(1);
  });

  it('does not make another request after leaving the screen during a call', async () => {
    const controller = new AbortController();
    const advance = vi.fn(async () => { controller.abort(); return { run: run(1), events: [] }; });
    const refresh = vi.fn();
    await continueReading(run(), { start: vi.fn(), advance, current: vi.fn(), refresh, wait: vi.fn(), delay: vi.fn(), signal: controller.signal });
    expect(advance).toHaveBeenCalledTimes(1); expect(refresh).not.toHaveBeenCalled();
  });
  it('pauses for an unanswered question and resumes a saved answer after a network drop', async () => {
    const waiting = { ...run(4, 'investigating'), status: 'waiting_for_user' as const };
    const advance = vi.fn().mockResolvedValue({ run: run(5, 'done'), events: [] });
    const deps = { start: vi.fn(), advance, current: vi.fn(), refresh: vi.fn(), wait: vi.fn(), delay: vi.fn(), signal: new AbortController().signal };
    await continueReading(waiting, deps); expect(advance).not.toHaveBeenCalled();
    await continueReading(waiting, { ...deps, resumeWaiting: true }); expect(advance).toHaveBeenCalledTimes(1);
  });
});
