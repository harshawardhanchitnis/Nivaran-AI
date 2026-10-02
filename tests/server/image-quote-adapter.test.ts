import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routingClient } from './routed-test-client.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentRow, EvidenceItemRow } from '../../shared/database.js';

const fake = vi.hoisted(() => ({ getModel: vi.fn(), generateText: vi.fn(), rpc: vi.fn(), download: vi.fn(), from: vi.fn() }));
vi.mock('../../server/llm/provider.js', () => ({ getModelById: fake.getModel }));
vi.mock('ai', async original => ({ ...await original<object>(), generateText: fake.generateText }));
import { createImageQuoteChecker } from '../../server/verify/quote.js';

const doc = { id: 'image', mime_type: 'image/png', storage_path: 'owner/case/support.png', file_name: 'support.png' } as DocumentRow;
const items = [{ id: 'quote', document_id: 'image', source: 'document', quote: 'Refund INR 9999', page: 1 }] as EvidenceItemRow[];
const client = { ...routingClient(fake.rpc), storage: { from: fake.from } } as unknown as SupabaseClient;
afterEach(()=>vi.unstubAllEnvs());
beforeEach(() => {
  vi.resetAllMocks(); fake.getModel.mockReturnValue({ model: 'fake',modelId:'gemini-3.6-flash' });
  vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY','fake'); vi.stubEnv('GROQ_API_KEY','fake');
  vi.stubEnv('MODEL_COOLDOWN_SIGNING_SECRET','test-secret-with-at-least-32-characters');
  fake.rpc.mockResolvedValue({ data: { allowed: true }, error: null });
  fake.from.mockReturnValue({ download: fake.download });
  fake.download.mockResolvedValue({ data: new Blob(['image']), error: null });
  fake.generateText.mockResolvedValue({ output: { checks: [{ id: 'quote', found: true }] } });
});
describe('image quote SDK adapter', () => {
  it('downloads only named images, charges once, and sends no tools or retries', async () => {
    const results = await createImageQuoteChecker(client)([doc, { ...doc, id: 'unused' }], items);
    expect(results).toEqual({ checks:{quote:true},modelId:'gemini-3.6-flash' }); expect(fake.download).toHaveBeenCalledTimes(1);
    expect(fake.rpc).toHaveBeenCalledExactlyOnceWith('charge_model_call');
    expect(fake.generateText).toHaveBeenCalledTimes(1);
    const options = fake.generateText.mock.calls[0]![0];
    expect(options).toMatchObject({ maxRetries: 0 }); expect(options).not.toHaveProperty('tools');
    expect(options.system).toContain('untrusted data');
    expect(fake.rpc.mock.invocationCallOrder[0]).toBeLessThan(fake.generateText.mock.invocationCallOrder[0]!);
  });
  it('does not charge or call for PDFs or user statements', async () => {
    expect(await createImageQuoteChecker(client)([{ ...doc, mime_type: 'application/pdf' }], items)).toEqual({});
    expect(await createImageQuoteChecker(client)([doc], [{ ...items[0]!, source: 'user' }])).toEqual({});
    expect(fake.rpc).not.toHaveBeenCalled(); expect(fake.generateText).not.toHaveBeenCalled();
  });
  it('uses the configured vision lineup and returns the actual answering model', async () => {
    await createImageQuoteChecker(client)([doc], items);
    expect(fake.getModel.mock.calls[0]?.slice(0,2)).toEqual(['google','gemini-3.6-flash']);
    expect(fake.generateText).toHaveBeenCalledTimes(1);
  });
  it('stops before a model call if storage fails or charging is refused', async () => {
    fake.download.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
    await expect(createImageQuoteChecker(client)([doc], items)).rejects.toMatchObject({ code: 'document_fetch_failed' });
    expect(fake.rpc).not.toHaveBeenCalled();
    fake.rpc.mockResolvedValue({ data: { allowed: false, reason: 'user_limit' }, error: null });
    await expect(createImageQuoteChecker(client)([doc], items)).rejects.toMatchObject({ code: 'quota_exhausted' });
    expect(fake.generateText).not.toHaveBeenCalled();
  });
});
