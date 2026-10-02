// The fact contract shared by the browser, the server and the database.
// Keep this file free of browser-only and Node-only APIs.

/** How a fact came to be known. These five values are the only statuses the product shows. */
export const FACT_STATUSES = ['document', 'user', 'conflict', 'missing', 'needs_check'] as const;
export type FactStatus = (typeof FACT_STATUSES)[number];

export const FACT_STATUS_LABELS: Record<FactStatus, string> = {
  document: 'Stated in document',
  user: 'Your statement',
  conflict: 'Conflicting',
  missing: 'Missing',
  needs_check: 'Needs your check',
};

/** The facts Nivaran tracks for the one supported case type: an online refund that has not arrived. */
export const FACT_FIELDS = [
  'merchant_name',
  'order_id',
  'order_date',
  'item_description',
  'amount_paid',
  'cancellation_or_return_date',
  'refund_amount',
  'refund_promise_date',
  'refund_due_date',
  'refund_reference',
  'complaint_sent_date',
  'complaint_acknowledged',
  'complaint_refused',
  'refund_received',
] as const;
export type FactField = (typeof FACT_FIELDS)[number];

export const FACT_FIELD_LABELS: Record<FactField, string> = {
  merchant_name: 'Merchant',
  order_id: 'Order ID',
  order_date: 'Order date',
  item_description: 'Item',
  amount_paid: 'Amount paid',
  cancellation_or_return_date: 'Cancellation or return date',
  refund_amount: 'Refund amount',
  refund_promise_date: 'Date the refund was promised',
  refund_due_date: 'Refund due by',
  refund_reference: 'Refund reference number',
  complaint_sent_date: 'Complaint sent on',
  complaint_acknowledged: 'Complaint acknowledged',
  complaint_refused: 'Refund refused in writing',
  refund_received: 'Refund received',
};

export function isFactField(value: string): value is FactField {
  return (FACT_FIELDS as readonly string[]).includes(value);
}

export function isFactStatus(value: string): value is FactStatus {
  return (FACT_STATUSES as readonly string[]).includes(value);
}
