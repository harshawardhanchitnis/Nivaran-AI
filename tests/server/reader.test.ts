import { describe, expect, it, vi } from 'vitest';
import type { DocumentRow } from '../../shared/database.js';
import { HttpError } from '../../server/http.js';
import { readDocument, type ReaderDependencies, type ReaderRequest } from '../../server/reader/read-document.js';

export const document: DocumentRow = {
  id: '33333333-3333-4333-8333-333333333333', case_id: '22222222-2222-4222-8222-222222222222',
  user_id: '11111111-1111-4111-8111-111111111111', label: 'E01', file_name: 'invoice.pdf',
  storage_path: 'owner/case/invoice.pdf', mime_type: 'application/pdf', size_bytes: 12,
  sha256: null, doc_type: null, page_count: null, read_status: 'pending', created_at: '2026-10-02T00:00:00Z',
};

const extraction = {
  doc_type: 'invoice', readable: true,
  facts: [{ field: 'order_id', value_text: 'MM-123456', quote: 'Order MM-123456', page: 1 }],
};
function dependencies() {
  return {
    download: vi.fn(async () => new Uint8Array([1, 2, 3])),
    charge: vi.fn(async () => undefined),
    callModel: vi.fn(async (_request: ReaderRequest) => extraction as unknown),
  } satisfies ReaderDependencies;
}

describe('document reader', () => {
  it('downloads as the caller, charges before one schema-constrained, tool-free call and keeps quotes verbatim', async () => {
    const deps = dependencies();
    const result = await readDocument(document, deps);
    expect(result).toMatchObject({ docType: 'invoice', readable: true, facts: extraction.facts });
    expect(deps.download).toHaveBeenCalledWith(document);
    expect(deps.charge).toHaveBeenCalledTimes(1);
    expect(deps.callModel).toHaveBeenCalledTimes(1);
    expect(deps.charge.mock.invocationCallOrder[0]).toBeLessThan(deps.callModel.mock.invocationCallOrder[0]!);
    expect(deps.callModel.mock.calls[0]![0]).not.toHaveProperty('tools');
    expect(deps.callModel.mock.calls[0]![0]).toMatchObject({ mediaType: 'application/pdf', fileName: 'invoice.pdf' });
  });

  it('does not return candidate facts from an unreadable document', async () => {
    const deps = dependencies();
    deps.callModel.mockResolvedValue({ ...extraction, readable: false });
    expect(await readDocument(document, deps)).toMatchObject({ readable: false, facts: [] });
  });

  it('does not call the model if the charge is refused', async () => {
    const deps = dependencies();
    deps.charge.mockRejectedValue(new HttpError(429, 'quota_exhausted', 'Limit reached.'));
    await expect(readDocument(document, deps)).rejects.toMatchObject({ status: 429, code: 'quota_exhausted' });
    expect(deps.callModel).not.toHaveBeenCalled();
  });

  it('does not charge when the file cannot be downloaded', async () => {
    const deps = dependencies();
    deps.download.mockRejectedValue(new HttpError(502, 'document_fetch_failed', 'Could not read the file.'));
    await expect(readDocument(document, deps)).rejects.toMatchObject({ code: 'document_fetch_failed' });
    expect(deps.charge).not.toHaveBeenCalled();
  });

  it.each([
    { ...extraction, facts: [{ ...extraction.facts[0], field: 'invented_field' }] },
    { ...extraction, facts: [{ ...extraction.facts[0], page: 0 }] },
    { ...extraction, facts: [{ ...extraction.facts[0], quote: '' }] },
  ])('rejects unsupported fields, invalid pages and missing quotes', async (output) => {
    const deps = dependencies();
    deps.callModel.mockResolvedValue(output);
    await expect(readDocument(document, deps)).rejects.toThrow();
    expect(deps.callModel).toHaveBeenCalledTimes(1);
  });
});
