import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentRunRow, DocumentRow } from '../../shared/database.js';
import { HttpError } from '../../server/http.js';
import { advanceReading, StaleTurnError, type ReadingStore, type FinishReading } from '../../server/agent/reading.js';

const initial: AgentRunRow = {
  id: '44444444-4444-4444-8444-444444444444', case_id: '22222222-2222-4222-8222-222222222222',
  user_id: '11111111-1111-4111-8111-111111111111', status: 'running', phase: 'reading', turn: 0,
  agent_steps: 0, max_agent_steps: 10, model: null, error: null, started_at: '2026-10-02T00:00:00Z',
  ended_at: null, processing_token: null, processing_started_at: null, reader_state: {}, agent_state: {},
};
const doc: DocumentRow = {
  id: '33333333-3333-4333-8333-333333333333', case_id: initial.case_id, user_id: initial.user_id,
  label: 'E01', file_name: 'invoice.pdf', storage_path: 'owner/case/invoice.pdf', mime_type: 'application/pdf',
  size_bytes: 12, sha256: null, doc_type: null, page_count: null, read_status: 'pending', created_at: initial.started_at,
};

describe('one reading advance', () => {
  let run: AgentRunRow;
  const claim = vi.fn();
  const release = vi.fn();
  const pendingDocument = vi.fn();
  const finish = vi.fn();
  const read = vi.fn();
  let store: ReadingStore;

  beforeEach(() => {
    vi.resetAllMocks();
    run = { ...initial, reader_state: {} };
    claim.mockImplementation(async () => ({ ...run, processing_token: 'claim-token' }));
    release.mockResolvedValue(undefined);
    pendingDocument.mockResolvedValue(doc);
    finish.mockImplementation(async (input: FinishReading) => {
      run = { ...run, turn: run.turn + 1, reader_state: input.readerState, phase: input.documentId ? 'reading' : 'investigating' };
      return { run, events: [{ type: input.event.type, payload: input.event.payload }] };
    });
    read.mockResolvedValue({ docType: 'invoice', readable: true, facts: [{ field: 'order_id', value_text: 'MM-123456', quote: 'MM-123456', page: 1 }] });
    store = { claim, release, pendingDocument, finish, getRun: async () => run };
  });

  it('reads one pending document and commits one turn', async () => {
    read.mockResolvedValue({ docType:'invoice',readable:true,facts:[],modelId:'qwen/qwen3.8-27b' });
    const result = await advanceReading(store, read, run.id, 0);
    expect(read).toHaveBeenCalledExactlyOnceWith(doc, 'primary');
    expect(result.run.turn).toBe(1);
    expect(finish.mock.calls[0]![0]).toMatchObject({ documentId: doc.id, readStatus: 'read',model:'qwen/qwen3.8-27b',event:{payload:{modelId:'qwen/qwen3.8-27b'}} });
  });

  it('records an unreadable document without facts', async () => {
    read.mockResolvedValue({ docType: 'other', readable: false, facts: [] });
    await advanceReading(store, read, run.id, 0);
    expect(finish.mock.calls[0]![0]).toMatchObject({ readStatus: 'unreadable' });
  });

  it('returns the current run in a stale 409 before a model call', async () => {
    claim.mockResolvedValue(null);
    const error = await advanceReading(store, read, run.id, 0).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(StaleTurnError);
    expect(error).toMatchObject({ status: 409, run: { id: run.id } });
    expect(read).not.toHaveBeenCalled();
  });

  it('returns quota refusal without changing the turn', async () => {
    read.mockRejectedValue(new HttpError(429, 'quota_exhausted', 'Limit reached.'));
    await expect(advanceReading(store, read, run.id, 0)).rejects.toMatchObject({ status: 429 });
    expect(finish).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
    expect(run.turn).toBe(0);
  });

  it('leaves the turn unchanged and returns a delay on provider rate limiting', async () => {
    read.mockRejectedValue({ statusCode: 429, responseHeaders: { 'retry-after': '4' } });
    const result = await advanceReading(store, read, run.id, 0);
    expect(result).toMatchObject({ run: { turn: 0 }, events: [], retryAfterMs: 4000 });
    expect(finish).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('does not retry a fatal image error on the next request outside the task router', async () => {
    pendingDocument.mockResolvedValue({ ...doc, mime_type: 'image/png' });
    read.mockRejectedValueOnce(new Error('primary failed'));
    const first = await advanceReading(store, read, run.id, 0);
    expect(read).toHaveBeenCalledTimes(1);
    expect(first.run.reader_state).toEqual({});
    expect(finish.mock.calls[0]![0]).toMatchObject({ readStatus: 'failed' });
  });

  it('never sends a PDF to the fallback', async () => {
    read.mockRejectedValue(new Error('primary failed'));
    await advanceReading(store, read, run.id, 0);
    expect(read).toHaveBeenCalledTimes(1);
    expect(finish.mock.calls[0]![0]).toMatchObject({ readStatus: 'failed', readerState: {} });
  });

  it('records bounded diagnostic details without exposing provider credentials', async () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'fake-secret-key');
    read.mockRejectedValue(new Error('Invalid argument fake-secret-key'));
    try {
      await advanceReading(store, read, run.id, 0);
      const diagnostic = finish.mock.calls[0]![0].event.payload.diagnostic;
      expect(diagnostic).toMatchObject({ message: 'Invalid argument [redacted]' });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('moves to investigating with no model call when no document remains', async () => {
    pendingDocument.mockResolvedValue(null);
    const result = await advanceReading(store, read, run.id, 0);
    expect(result.run.phase).toBe('investigating');
    expect(read).not.toHaveBeenCalled();
  });
});
