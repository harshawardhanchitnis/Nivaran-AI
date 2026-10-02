import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const fake = vi.hoisted(() => ({
  getModel: vi.fn(), generateText: vi.fn(), rpc: vi.fn(), download: vi.fn(), from: vi.fn(),
}));
vi.mock('../../server/llm/provider.js', () => ({ getModel: fake.getModel }));
vi.mock('ai', async (original) => ({ ...await original<object>(), generateText: fake.generateText }));

import { createDocumentReader, readerOutputSchema } from '../../server/reader/read-document.js';
import type { DocumentRow } from '../../shared/database.js';
import { z } from 'zod';

const doc: DocumentRow = {
  id: '33333333-3333-4333-8333-333333333333', case_id: '22222222-2222-4222-8222-222222222222',
  user_id: '11111111-1111-4111-8111-111111111111', label: 'E01', file_name: 'invoice.pdf',
  storage_path: 'owner/case/invoice.pdf', mime_type: 'application/pdf', size_bytes: 12,
  sha256: null, doc_type: null, page_count: null, read_status: 'pending', created_at: '2026-10-02T00:00:00Z',
};
const client = { rpc: fake.rpc, storage: { from: fake.from } } as unknown as SupabaseClient;
beforeEach(() => {
  vi.resetAllMocks();
  fake.getModel.mockReturnValue({ model: 'fake-model', modelId: 'fake-model-id' });
  fake.rpc.mockResolvedValue({ data: { allowed: true }, error: null });
  fake.from.mockReturnValue({ download: fake.download });
  fake.download.mockResolvedValue({ data: new Blob(['pdf']), error: null });
  fake.generateText.mockResolvedValue({ output: { doc_type: 'invoice', readable: true, facts: [] } });
});

describe('reader SDK adapter (no real calls)', () => {
  it('uses a portable provider schema while retaining strict local output validation', () => {
    const serialized = JSON.stringify(z.toJSONSchema(readerOutputSchema));
    expect(serialized).not.toContain('exclusiveMinimum');
    expect(serialized).not.toContain('maxLength');
  });

  it.each(['application/pdf', 'image/png'] as const)('sends %s bytes without tools or retries, after charging', async (mime_type) => {
    const result = await createDocumentReader(client)({ ...doc, mime_type }, 'primary');
    expect(result.modelId).toBe('fake-model-id');
    expect(fake.from).toHaveBeenCalledWith('evidence');
    expect(fake.download).toHaveBeenCalledWith(doc.storage_path);
    expect(fake.rpc).toHaveBeenCalledExactlyOnceWith('charge_model_call');
    expect(fake.generateText).toHaveBeenCalledTimes(1);
    expect(fake.rpc.mock.invocationCallOrder[0]).toBeLessThan(fake.generateText.mock.invocationCallOrder[0]!);
    const options = fake.generateText.mock.calls[0]![0];
    expect(options).toMatchObject({ maxRetries: 0 });
    expect(options).not.toHaveProperty('tools');
    expect(options.system).toContain('untrusted data');
    expect(options.messages[0].content[0]).toMatchObject({ type: 'file', mediaType: mime_type });
    expect(options.output).toBeDefined();
  });

  it('refuses PDF fallback before downloading, charging or calling', async () => {
    await expect(createDocumentReader(client)(doc, 'fallback')).rejects.toMatchObject({ code: 'pdf_fallback_unavailable' });
    expect(fake.download).not.toHaveBeenCalled();
    expect(fake.rpc).not.toHaveBeenCalled();
    expect(fake.generateText).not.toHaveBeenCalled();
  });

  it('does not spend a model call for an empty saved file', async () => {
    fake.download.mockResolvedValue({ data: new Blob([]), error: null });
    await expect(createDocumentReader(client)(doc, 'primary')).rejects.toMatchObject({ code: 'document_size_invalid' });
    expect(fake.rpc).not.toHaveBeenCalled();
    expect(fake.generateText).not.toHaveBeenCalled();
  });
});
