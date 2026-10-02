import { describe, expect, it, vi } from 'vitest';
import type { DocumentRow, EvidenceItemRow } from '../../shared/database.js';
import { verifyFacts } from '../../server/facts/verify-facts.js';

const doc = { id: 'image', mime_type: 'image/png' } as DocumentRow;
const item = { id: 'one', document_id: 'image', source: 'document', field: 'refund_amount', value_text: 'INR 9,999', quote: 'Refund INR 9,999', page: 1, quote_verified: null } as EvidenceItemRow;
describe('fact verification orchestration', () => {
  it('propagates the image checker model ID for the event and run',async()=> {
    const result=await verifyFacts([doc],[item],[],{download:vi.fn(),images:async()=>({checks:{one:true},modelId:'gemini-3.5-flash-lite'})},['refund_amount']);
    expect(result.modelId).toBe('gemini-3.5-flash-lite');expect(result.facts[0]?.status).toBe('document');
  });
  it('checks all unchecked image quotes together and builds the five-status sheet', async () => {
    const images = vi.fn(async () => ({ one: true, two: false })); const download = vi.fn();
    const result = await verifyFacts([doc], [item, { ...item, id: 'two', field: 'refund_due_date', value_text: '24 Sep 2026' }], [], { images, download }, ['refund_amount', 'refund_due_date']);
    expect(images).toHaveBeenCalledTimes(1); expect(download).not.toHaveBeenCalled();
    expect(result.facts.map(f => f.status)).toEqual(['document', 'needs_check']);
    expect(result.evidence[0]?.value_norm).toEqual({ kind: 'amount', currency: 'INR', decimal: '9999.00' });
  });
  it('does not spend another image pass on already checked quotes', async () => {
    const images = vi.fn();
    await verifyFacts([doc], [{ ...item, quote_verified: false }], [], { images, download: vi.fn() }, ['refund_amount']);
    expect(images).not.toHaveBeenCalled();
  });
});
