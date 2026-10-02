import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routingClient } from './routed-test-client.js';
vi.mock('../../server/reader/pdf-text.js',()=>({pdfTextPages:async()=>['Order MM-123456']}));
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentRow } from '../../shared/database.js';
import { createDocumentReader } from '../../server/reader/read-document.js';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
beforeEach(()=>vi.stubEnv('MODEL_COOLDOWN_SIGNING_SECRET','test-secret-with-at-least-32-characters'));
describe('reader through the real SDK with a fake HTTP transport', () => {
  it('sends a text-layer PDF through the real Groq SDK as page text with no tools', async ()=> {
    vi.stubEnv('GROQ_API_KEY','fake-key');
    const extraction={doc_type:'invoice',readable:true,facts:[{field:'order_id',value_text:'MM-123456',quote:'Order MM-123456',page:1}]};
    const http=vi.fn(async (_input:Parameters<typeof fetch>[0],_init?:RequestInit)=>new Response(JSON.stringify({
      id:'fake',object:'chat.completion',created:1,model:'qwen/qwen3.8-27b',choices:[{index:0,message:{role:'assistant',content:JSON.stringify(extraction)},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}
    }),{headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',http);
    const rpc=vi.fn(async()=>({data:{allowed:true},error:null}));
    const client={...routingClient(rpc),storage:{from:()=>({download:async()=>({data:new Blob(['pdf']),error:null})})}} as unknown as SupabaseClient;
    const result=await createDocumentReader(client)({mime_type:'application/pdf',storage_path:'source',file_name:'invoice.pdf'} as DocumentRow);
    expect(result.modelId).toBe('qwen/qwen3.8-27b'); expect(result.facts).toEqual(extraction.facts);
    expect(http).toHaveBeenCalledTimes(1);expect(rpc).toHaveBeenCalledExactlyOnceWith('charge_model_call');
    const body=JSON.parse(String(http.mock.calls[0]![1]?.body));
    expect(JSON.stringify(body.messages)).toContain('Order MM-123456'); expect(JSON.stringify(body.messages)).not.toContain('application/pdf'); expect(body.tools).toBeUndefined();
  });
  it.each(['application/pdf', 'image/png'] as const)('serializes %s and parses constrained output without a network call', async (mime_type) => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'fake-key');
    const extraction = { doc_type: 'invoice', readable: true,
      facts: [{ field: 'order_id', value_text: 'MM-123456', quote: 'Order MM-123456', page: 1 }] };
    const http = vi.fn(async (_input: Parameters<typeof fetch>[0], _init?: RequestInit) => new Response(JSON.stringify({
      candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(extraction) }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 8, totalTokenCount: 12 },
    }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', http);
    const rpc = vi.fn(async () => ({ data: { allowed: true }, error: null }));
    const client = { ...routingClient(rpc), storage: { from: () => ({ download: async () => ({ data: new Blob(['fake-file']), error: null }) }) } } as unknown as SupabaseClient;
    const doc = { mime_type, storage_path: 'owner/case/file', file_name: 'file' } as DocumentRow;
    const result = await createDocumentReader(client)(doc, 'primary');
    expect(result.facts).toEqual(extraction.facts);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('charge_model_call');
    expect(http).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(http.mock.calls[0]![1]?.body));
    expect(body.generationConfig.responseFormat.text.mimeType).toBe('APPLICATION_JSON');
    expect(body.generationConfig).not.toHaveProperty('responseJsonSchema');
    if(mime_type==='application/pdf') {
      expect(body.contents[0].parts[0].text).toContain('Order MM-123456');
      expect(body.contents[0].parts[0].inlineData).toBeUndefined();
    } else expect(body.contents[0].parts[0].inlineData.mimeType).toBe(mime_type);
    expect(body.tools).toBeUndefined();
  });
});
