import { describe, expect, it, vi } from 'vitest';
import { startReading, type StartReadingStore } from '../../server/agent/start.js';

function dependencies() {
  return {
    requireCase: vi.fn(async () => undefined),
    activeRun: vi.fn(),
    hasDocuments: vi.fn(async () => true),
    insertRun: vi.fn(),
  } satisfies StartReadingStore;
}

describe('start document reading', () => {
  it('returns an existing run without creating another', async () => {
    const deps = dependencies();
    const run = { id: 'existing' };
    deps.activeRun.mockResolvedValue(run);
    expect(await startReading(deps, 'case')).toEqual(run);
    expect(deps.requireCase).toHaveBeenCalledWith('case');
    expect(deps.insertRun).not.toHaveBeenCalled();
  });

  it('requires an owned case and at least one document before creating a run', async () => {
    const deps = dependencies();
    deps.activeRun.mockResolvedValue(null);
    deps.hasDocuments.mockResolvedValue(false);
    await expect(startReading(deps, 'case')).rejects.toMatchObject({ status: 400, code: 'no_documents' });
    expect(deps.insertRun).not.toHaveBeenCalled();
  });

  it('creates one reading run and resolves a simultaneous start through the unique index', async () => {
    const deps = dependencies();
    deps.activeRun.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'winner' });
    deps.insertRun.mockRejectedValue({ code: '23505' });
    expect(await startReading(deps, 'case')).toEqual({ id: 'winner' });
    expect(deps.insertRun).toHaveBeenCalledExactlyOnceWith('case');
  });

  it('does not hide a failed insertion as a successful start', async () => {
    const deps = dependencies();
    deps.activeRun.mockResolvedValue(null);
    deps.insertRun.mockRejectedValue({ code: 'database_down' });
    await expect(startReading(deps, 'case')).rejects.toMatchObject({ status: 503, code: 'run_start_failed' });
  });
});
