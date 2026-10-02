import type { DraftRenderContext } from '../../shared/draft-render.js';
export const context: DraftRenderContext = {
  facts: [
    {
      field: 'refund_amount',
      status: 'document',
      value_text: 'Rs 9999',
      value_norm: { kind: 'amount', currency: 'INR', decimal: '9999.00' },
      evidence_item_id: 'reading',
    },
    {
      field: 'order_id',
      status: 'user',
      value_text: 'MM-123456',
      value_norm: { kind: 'id', value: 'MM-123456' },
      evidence_item_id: null,
    },
    {
      field: 'complaint_sent_date',
      status: 'user',
      value_text: '2026-10-01',
      value_norm: { kind: 'date', value: '2026-10-01' },
      evidence_item_id: null,
    },
  ],
  evidence: [{ id: 'reading', source: 'document', document_id: 'doc' }],
  documents: [{ id: 'doc', label: 'E02' }],
  dates: { refund_due: '2026-09-24', resolve_by: '2026-11-01' },
  today: '2026-10-02',
};
