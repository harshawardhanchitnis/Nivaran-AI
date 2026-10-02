// A complete sample case for the design preview at /demo.
//
// Everything here is invented: "Meridian Mart" is a fictional merchant, and no model produced any
// of it. It exists to show each component with realistic content, and to be the reference for how
// real rows should be mapped into the view models in shared/ui/models.ts.
import type {
  ActivityView,
  DraftSegment,
  FactView,
  PlanView,
  QuestionView,
  SourceView,
} from '../../shared/ui/models';

export const SAMPLE_CASE = {
  title: 'Refund for a cancelled order',
  merchant: 'Meridian Mart',
  today: '2 Oct 2026',
  documents: [
    { evidence: 'E01', name: 'invoice-MM-48213907.pdf', kind: 'Tax invoice' },
    { evidence: 'E02', name: 'cancellation-email.pdf', kind: 'Cancellation email' },
    { evidence: 'E03', name: 'support-chat.png', kind: 'Support chat screenshot' },
  ],
} as const;

const invoiceAmount: SourceView = {
  evidence: 'E01',
  documentName: 'invoice-MM-48213907.pdf',
  documentKind: 'Tax invoice',
  page: 1,
  value: '₹9,999',
  quote: 'Grand Total: ₹9,999.00',
  before: 'Aurora wireless headphones × 1 … ',
  after: ' (inclusive of all taxes)',
};

const emailRefund: SourceView = {
  evidence: 'E02',
  documentName: 'cancellation-email.pdf',
  documentKind: 'Cancellation email',
  page: 1,
  value: '₹9,999',
  quote: 'a refund of ₹9,999 will be credited to your original payment method',
  before: 'Your order has been cancelled and ',
  after: ' within 7 working days.',
};

const chatRefund: SourceView = {
  evidence: 'E03',
  documentName: 'support-chat.png',
  documentKind: 'Support chat screenshot',
  page: null,
  value: '₹8,999',
  quote: 'refund of Rs. 8999 has been initiated',
  before: 'Agent: I can confirm that your ',
  after: ' and will reflect shortly.',
};

/** The fact sheet while the refund amount is still in conflict. */
export const SAMPLE_FACTS: readonly FactView[] = [
  {
    field: 'merchant_name',
    label: 'Merchant',
    value: 'Meridian Mart',
    status: 'document',
    sources: [{ ...invoiceAmount, value: 'Meridian Mart', quote: 'Sold by: Meridian Mart Retail Pvt Ltd', before: '', after: '' }],
  },
  {
    field: 'order_id',
    label: 'Order ID',
    value: 'MM-48213907',
    status: 'document',
    sources: [{ ...invoiceAmount, value: 'MM-48213907', quote: 'Order No. MM-48213907', before: 'Invoice date 28 Aug 2026 · ', after: '' }],
  },
  {
    field: 'amount_paid',
    label: 'Amount paid',
    value: '₹9,999',
    status: 'document',
    sources: [invoiceAmount],
  },
  {
    field: 'cancellation_or_return_date',
    label: 'Cancelled on',
    value: '31 Aug 2026',
    status: 'document',
    sources: [{ ...emailRefund, value: '31 Aug 2026', quote: 'Cancelled on 31 August 2026', before: 'Order MM-48213907 · ', after: '' }],
  },
  {
    field: 'refund_amount',
    label: 'Refund amount',
    value: '₹9,999 or ₹8,999',
    status: 'conflict',
    sources: [emailRefund, chatRefund],
    note: 'Two of your documents give different amounts.',
  },
  {
    field: 'refund_due_date',
    label: 'Refund due by',
    value: '9 Sep 2026',
    status: 'document',
    sources: [{ ...emailRefund, value: 'within 7 working days', quote: 'within 7 working days', before: '… credited to your original payment method ', after: '.' }],
    note: '7 working days after 31 Aug 2026, counted by Nivaran.',
  },
  {
    field: 'refund_reference',
    label: 'Refund reference number',
    value: null,
    status: 'missing',
    sources: [],
    note: 'Your bank needs this to trace a refund. The complaint will ask for it.',
  },
  {
    field: 'refund_received',
    label: 'Refund received',
    value: 'No',
    status: 'user',
    sources: [],
  },
];

export const SAMPLE_QUESTION: QuestionView = {
  id: 'q-refund-amount',
  prompt: 'Which refund amount is right?',
  why: 'The cancellation email says ₹9,999. The support chat says ₹8,999. The complaint can only ask for one.',
  options: [
    { id: 'email', label: '₹9,999', hint: 'E02 · cancellation email' },
    { id: 'chat', label: '₹8,999', hint: 'E03 · support chat' },
    { id: 'unsure', label: 'I am not sure', hint: 'Nivaran will ask for the full amount paid and say why' },
  ],
};

export const SAMPLE_ACTIVITY_BEFORE: readonly ActivityView[] = [
  { id: 'a1', kind: 'read', title: 'Read E01, the tax invoice', detail: 'Found the merchant, order ID, order date and amount paid.', time: '10:02' },
  { id: 'a2', kind: 'read', title: 'Read E02, the cancellation email', detail: 'Found the cancellation date, the refund amount and “within 7 working days”.', time: '10:02' },
  { id: 'a3', kind: 'read', title: 'Read E03, the support chat', detail: 'Found a second refund amount.', time: '10:03' },
  { id: 'a4', kind: 'check', title: 'Checked every quote against its document', detail: '7 of 7 quotes found in the source.', time: '10:03' },
  { id: 'a5', kind: 'found', title: 'Found two different refund amounts', detail: 'E02 says ₹9,999. E03 says ₹8,999.', time: '10:03' },
  { id: 'a6', kind: 'read', title: 'Looked again at E02 and E03 for a refund reference number', detail: 'Neither document has one.', time: '10:04' },
  { id: 'a7', kind: 'ask', title: 'Asked you which refund amount is right', time: '10:04' },
];

export const SAMPLE_ACTIVITY_AFTER: readonly ActivityView[] = [
  { id: 'a8', kind: 'answer', title: 'You chose ₹9,999', detail: 'Recorded with its source, E02.', time: '10:05' },
  { id: 'a9', kind: 'search', title: 'Looked up the grievance officer timelines', detail: 'Used one hand-checked guidance note.', time: '10:05' },
  { id: 'a10', kind: 'decide', title: 'Worked out the next step from your dates', detail: 'The refund was due on 9 Sep 2026 and no complaint has been sent yet.', time: '10:05' },
  { id: 'a11', kind: 'plan', title: 'Proposed a plan and stopped for your approval', time: '10:05' },
];

export const SAMPLE_PLAN: PlanView = {
  step: 1,
  headline: "Write to Meridian Mart's grievance officer",
  summary:
    'Your refund is 23 days overdue and you have not yet complained in writing. A written complaint starts two clocks that the next step depends on.',
  reasons: [
    {
      text: 'The refund was promised within 7 working days of 31 Aug 2026. That date, 9 Sep 2026, has passed.',
      sourceName: 'Your cancellation email, E02',
    },
    {
      text: 'An online seller’s grievance officer must acknowledge a complaint within 48 hours and resolve it within one month.',
      sourceName: 'Consumer Protection (E-Commerce) Rules, 2020, rule 4(5)',
      checkedOn: null,
    },
    {
      text: 'You have no refund reference number. Asking for it lets your bank trace the money if the seller says it was sent.',
    },
  ],
  timeline: [
    { id: 't1', label: 'Order placed', date: '28 Aug 2026', tone: 'past' },
    { id: 't2', label: 'Order cancelled, refund promised', date: '31 Aug 2026', tone: 'past' },
    { id: 't3', label: 'Refund was due', date: '9 Sep 2026', tone: 'overdue', note: '23 days overdue' },
    { id: 't4', label: 'Today', date: '2 Oct 2026', tone: 'today', note: 'Send the complaint' },
    { id: 't5', label: 'Acknowledgement due', date: '48 hours after you send', tone: 'upcoming' },
    { id: 't6', label: 'Resolution due', date: 'One month after you send', tone: 'upcoming', note: 'If not, the next step is the National Consumer Helpline.' },
  ],
};

export const SAMPLE_DRAFT: readonly DraftSegment[] = [
  { kind: 'text', text: 'To the Grievance Officer, ' },
  { kind: 'value', text: 'Meridian Mart', evidence: 'E01' },
  { kind: 'break' },
  { kind: 'text', text: 'Subject: Refund not received for order ' },
  { kind: 'value', text: 'MM-48213907', evidence: 'E01' },
  { kind: 'break' },
  { kind: 'text', text: 'I paid ' },
  { kind: 'value', text: '₹9,999', evidence: 'E01' },
  { kind: 'text', text: ' for this order. It was cancelled on ' },
  { kind: 'value', text: '31 Aug 2026', evidence: 'E02' },
  { kind: 'text', text: ', and your email of that date confirmed a refund of ' },
  { kind: 'value', text: '₹9,999', evidence: 'E02' },
  { kind: 'text', text: ' within 7 working days, that is by ' },
  { kind: 'value', text: '9 Sep 2026', evidence: 'E02' },
  { kind: 'text', text: '. As of today the refund has not reached my account.' },
  { kind: 'break' },
  { kind: 'text', text: 'Please credit the refund, or send me the refund reference number and the date it was processed so that my bank can trace it. Please acknowledge this complaint within 48 hours and resolve it within one month.' },
  { kind: 'break' },
  { kind: 'text', text: 'Copies of the invoice, the cancellation email and the support chat are attached as E01 to E03.' },
  { kind: 'break' },
  { kind: 'you', text: 'Your name' },
  { kind: 'text', text: ' · ' },
  { kind: 'you', text: 'Your phone or email' },
];

/** Shown when the "try a fake ID" control is used in the preview. */
export const SAMPLE_FLAG: readonly DraftSegment[] = [
  { kind: 'break' },
  { kind: 'text', text: 'The refund was sent under transaction ID ' },
  { kind: 'flag', text: 'TXN88431' },
  { kind: 'text', text: '.' },
];
