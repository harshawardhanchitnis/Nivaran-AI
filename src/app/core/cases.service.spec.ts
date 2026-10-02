import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { CaseRow } from '@shared/database';
import { EVIDENCE_BUCKET, MAX_FILE_BYTES } from '@shared/limits';

import { CasesService, CaseUploadError } from './cases.service';
import { SupabaseService } from './supabase.service';

const owner = '11111111-1111-4111-8111-111111111111';
const caseRow: CaseRow = {
  id: '22222222-2222-4222-8222-222222222222', user_id: owner,
  title: 'Refund not received', merchant_name: null, status: 'open', ladder_step: null,
  is_sample: false, created_at: '2026-10-02T00:00:00Z', updated_at: '2026-10-02T00:00:00Z',
};
const file = (name: string) => new File(['synthetic evidence'], name, { type: 'image/png' });

describe('CasesService uploads', () => {
  const upload = vi.fn();
  const remove = vi.fn();
  const deleteCase = vi.fn();
  const insertDocuments = vi.fn();
  const insertCase = vi.fn();
  const ensureSignedIn = vi.fn();
  const from = vi.fn();
  const bucket = vi.fn();
  let service: CasesService;

  beforeEach(() => {
    vi.resetAllMocks();
    ensureSignedIn.mockResolvedValue({ user: { id: owner } });
    upload.mockResolvedValue({ error: null });
    remove.mockResolvedValue({ error: null });
    deleteCase.mockResolvedValue({ error: null });
    insertCase.mockReturnValue({ select: () => ({ single: async () => ({ data: caseRow, error: null }) }) });
    insertDocuments.mockReturnValue({ select: () => ({ returns: async () => ({ data: [], error: null }) }) });
    from.mockImplementation((table: string) => table === 'cases'
      ? { insert: insertCase, delete: () => ({ eq: deleteCase }) }
      : { insert: insertDocuments });
    bucket.mockReturnValue({ upload, remove });
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: {
        ensureSignedIn, client: { from, storage: { from: bucket } },
      } }],
    });
    service = TestBed.inject(CasesService);
  });

  it.each([
    { consent: false, files: [file('invoice.png')], reason: 'consent' },
    { consent: true, files: [], reason: 'document' },
    { consent: true, files: [new File(['x'], 'notes.txt', { type: 'text/plain' })], reason: 'PNG' },
    { consent: true, files: Array.from({ length: 7 }, (_, i) => file(`${i}.png`)), reason: '6 files' },
  ])('refuses invalid input before any account or storage call: $reason', async ({ consent, files, reason }) => {
    await expect(service.createWithDocuments(files, consent)).rejects.toThrow(reason);
    expect(ensureSignedIn).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('creates one case and three private files with matching document IDs and ordered labels', async () => {
    const files = [file('invoice.png'), file('cancel message.png'), file('chat.png')];
    const result = await service.createWithDocuments(files, true);

    expect(result.case.id).toBe(caseRow.id);
    expect(insertCase).toHaveBeenCalledExactlyOnceWith({ title: 'Refund not received' });
    expect(bucket).toHaveBeenCalledWith(EVIDENCE_BUCKET);
    expect(upload).toHaveBeenCalledTimes(3);
    const rows = insertDocuments.mock.calls[0]![0] as Array<{
      id: string; case_id: string; label: string; file_name: string; storage_path: string;
      mime_type: string; size_bytes: number;
    }>;
    expect(rows.map((row) => row.label)).toEqual(['E01', 'E02', 'E03']);
    rows.forEach((row, i) => {
      expect(row.case_id).toBe(caseRow.id);
      expect(row.storage_path).toBe(`${owner}/${caseRow.id}/${row.id}-${files[i]!.name.replace(/[^\w.\-]+/g, '_')}`);
      expect(row.mime_type).toBe('image/png');
      expect(row.size_bytes).toBe(files[i]!.size);
      expect(upload).toHaveBeenNthCalledWith(i + 1, row.storage_path, files[i], {
        contentType: 'image/png', upsert: false,
      });
    });
  });

  it('rejects oversized files even if called outside the screen', async () => {
    const huge = new File([new Uint8Array(MAX_FILE_BYTES + 1)], 'huge.png', { type: 'image/png' });
    await expect(service.createWithDocuments([huge], true)).rejects.toThrow('larger than 5 MB');
    expect(from).not.toHaveBeenCalled();
  });

  it('cleans only the new case and attempted files after an upload failure', async () => {
    upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: 'offline' } });
    await expect(service.createWithDocuments([file('one.png'), file('two.png')], true)).rejects.toThrow('try again');
    expect(insertDocuments).not.toHaveBeenCalled();
    expect(remove.mock.calls[0]![0]).toEqual(upload.mock.calls.map((call) => call[0]));
    expect(deleteCase).toHaveBeenCalledExactlyOnceWith('id', caseRow.id);
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(deleteCase.mock.invocationCallOrder[0]!);
  });

  it('cleans storage before deleting the new case if document rows cannot be saved', async () => {
    insertDocuments.mockReturnValue({ select: () => ({ returns: async () => ({ data: null, error: { message: 'database offline' } }) }) });
    await expect(service.createWithDocuments([file('one.png')], true)).rejects.toThrow('try again');
    expect(remove).toHaveBeenCalledTimes(1);
    expect(deleteCase).toHaveBeenCalledTimes(1);
  });

  it('keeps the partial case and exposes its ID if file cleanup fails', async () => {
    upload.mockResolvedValue({ error: { message: 'offline' } });
    remove.mockResolvedValue({ error: { message: 'offline' } });
    const error = await service.createWithDocuments([file('one.png')], true).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(CaseUploadError);
    expect(error).toMatchObject({ caseId: caseRow.id });
    expect(deleteCase).not.toHaveBeenCalled();
  });
});
