import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ requireUser: vi.fn(), store: { getRun: vi.fn() }, reader: vi.fn(), start: vi.fn(), advance: vi.fn(), investigate: vi.fn() }));
vi.mock('../../server/auth.js', () => ({ requireUser: fake.requireUser }));
vi.mock('../../server/agent/store.js', () => ({ createReadingStore: () => fake.store }));
vi.mock('../../server/reader/read-document.js', () => ({ createDocumentReader: () => fake.reader }));
vi.mock('../../server/agent/start.js', () => ({ startReading: fake.start }));
vi.mock('../../server/agent/reading.js', async (original) => ({ ...await original<object>(), advanceReading: fake.advance }));
vi.mock('../../server/agent/loop.js', () => ({ advanceInvestigation: fake.investigate }));
vi.mock('../../server/agent/investigation-store.js', () => ({ createInvestigationStore: () => fake.store }));
vi.mock('../../server/agent/runtime.js', () => ({ createInvestigationDependencies: () => ({}) }));

import { POST as start } from '../../api/agent/start.js';
import { POST as advance } from '../../api/agent/advance.js';
import { HttpError } from '../../server/http.js';
import { StaleTurnError } from '../../server/agent/reading.js';
import type { AgentRunRow } from '../../shared/database.js';

const id = '44444444-4444-4444-8444-444444444444';
function request(body: unknown) {
  return new Request('http://localhost/api/agent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.resetAllMocks();
  fake.requireUser.mockResolvedValue({ supabase: {} });
  fake.start.mockResolvedValue({ id, turn: 0 });
  fake.advance.mockResolvedValue({ run: { id, turn: 1 }, events: [] });
  fake.store.getRun.mockResolvedValue({ id, phase: 'reading' });
});

describe('reading endpoints', () => {
  it('starts using the authenticated store without a model call', async () => {
    const response = await start(request({ caseId: id }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ run: { id, turn: 0 } });
    expect(fake.start).toHaveBeenCalledExactlyOnceWith(fake.store, id);
    expect(fake.reader).not.toHaveBeenCalled();
  });

  it('validates IDs and the expected turn before advancing', async () => {
    expect((await start(request({ caseId: 'bad' }))).status).toBe(400);
    expect((await advance(request({ runId: id, expectedTurn: -1 }))).status).toBe(400);
    expect(fake.start).not.toHaveBeenCalled();
    expect(fake.advance).not.toHaveBeenCalled();
  });

  it('advances once with the expected turn', async () => {
    const response = await advance(request({ runId: id, expectedTurn: 0 }));
    expect(response.status).toBe(200);
    expect(fake.advance).toHaveBeenCalledExactlyOnceWith(fake.store, fake.reader, id, 0);
  });
  it('dispatches investigation without calling the document reader', async () => {
    fake.store.getRun.mockResolvedValue({ id, phase: 'investigating' });
    fake.investigate.mockResolvedValue({ run: { id, turn: 1 }, events: [] });
    const response = await advance(request({ runId: id, expectedTurn: 0 }));
    expect(response.status).toBe(200); expect(fake.investigate).toHaveBeenCalledTimes(1); expect(fake.advance).not.toHaveBeenCalled();
  });

  it('includes the current run in a stale-turn 409', async () => {
    fake.advance.mockRejectedValue(new StaleTurnError({ id, turn: 3 } as AgentRunRow));
    const response = await advance(request({ runId: id, expectedTurn: 0 }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: 'stale_turn' }, run: { id, turn: 3 } });
  });

  it('requires authentication and returns a quota refusal plainly', async () => {
    fake.requireUser.mockRejectedValueOnce(new HttpError(401, 'unauthenticated', 'Sign in.'));
    expect((await start(request({ caseId: id }))).status).toBe(401);
    fake.advance.mockRejectedValue(new HttpError(429, 'quota_exhausted', 'Limit reached.'));
    const response = await advance(request({ runId: id, expectedTurn: 0 }));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: { code: 'quota_exhausted' } });
  });
});
