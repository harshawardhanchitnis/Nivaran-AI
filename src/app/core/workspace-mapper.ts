import type { AgentRunRow, CaseFactRow, DocumentRow, EvidenceItemRow, QuestionRow } from '@shared/database';
import { FACT_FIELDS, FACT_FIELD_LABELS } from '@shared/facts';
import { normaliseFact } from '@shared/normalise';
import { isFactField } from '@shared/facts';
import type { ActivityView, FactView, SourceView, QuestionView } from '../shared/ui/models';

export interface DocumentPreview { url?: string; pageImages?: Record<number, string>; loading?: boolean; error?: string }
const DOCUMENT_KINDS: Record<string, string> = {
  invoice: 'Invoice', order_confirmation: 'Order confirmation', cancellation: 'Cancellation',
  return_confirmation: 'Return confirmation', refund_message: 'Refund message', support_chat: 'Support chat',
  complaint_sent: 'Complaint sent', merchant_reply: 'Merchant reply', other: 'Document',
};

/** Candidate readings are not promoted to document facts before T4's quote checks. */
export function workspaceFacts(
  documents: readonly DocumentRow[], items: readonly EvidenceItemRow[], stored: readonly CaseFactRow[],
  previews: Readonly<Record<string, DocumentPreview>>,
): FactView[] {
  return FACT_FIELDS.map(field => {
    const fact = stored.find(row => row.field === field);
    const readings = items.filter(item => item.field === field);
    const sources: SourceView[] = readings.flatMap(item => {
      const doc = documents.find(doc => doc.id === item.document_id);
      if (!doc || item.source !== 'document') return [];
      const preview = previews[doc.id];
      return [{ id: item.id, evidence: doc.label, documentId: doc.id, documentName: doc.file_name,
        documentKind: DOCUMENT_KINDS[doc.doc_type ?? 'other'] ?? 'Document', page: item.page,
        value: item.value_text, quote: item.quote ?? '',
        imageUrl: doc.mime_type === 'application/pdf' ? null : preview?.url,
        pdfUrl: doc.mime_type === 'application/pdf' ? preview?.url : null,
        pdfImageUrl: preview?.pageImages?.[item.page ?? 1],
        previewLoading: preview?.loading, previewError: preview?.error }];
    });
    const stated = readings.find(item => item.source === 'user');
    const status = fact?.status ?? (sources.length ? 'needs_check' : stated ? 'user' : 'missing');
    return { field, label: FACT_FIELD_LABELS[field], status,
      value: fact ? fact.value_text : readings[0]?.value_text ?? null,
      sources: status === 'user' ? [] : sources,
      ...(!fact && sources.length ? { note: 'Quote checks are pending. Open the sources to check the reading.' } : {}),
    };
  });
}

export function workspaceActivity(events: readonly {
  id: string; seq: number; type: string; payload: Record<string, unknown>; created_at: string;
}[]): ActivityView[] {
  return [...events].sort((a, b) => a.seq - b.seq).map(event => {
    const message = event.payload['message'];
    const kind = event.type === 'error' ? 'error' : event.payload['tool'] === 'read_document' ? 'read'
      : event.type === 'question' ? 'ask' : event.type === 'answer' ? 'answer'
      : event.payload['tool'] === 'check_quotes' ? 'check' : event.payload['tool'] === 'search_guidance' ? 'search'
      : event.payload['tool'] === 'propose_plan' ? 'plan' : 'decide';
    const date = new Date(event.created_at);
    return { id: event.id, kind, title: typeof message === 'string' ? message : 'Saved a case step.',
      time: Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-IN', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
      }).format(date) : '' };
  });
}

export function questionOptions(question: QuestionRow, documents: readonly DocumentRow[], items: readonly EvidenceItemRow[]): QuestionView['options'] {
  return question.options.flatMap(option => {
    if (!option || typeof option !== 'object' || !('id' in option) || !('label' in option) || typeof option.id !== 'string' || typeof option.label !== 'string') return [];
    const field = question.field;
    const norm = field && isFactField(field) ? normaliseFact(field, 'value' in option && typeof option.value === 'string' ? option.value : option.label) : null;
    const seen = new Set<string>();
    const sources = norm ? items.flatMap(item => {
      if (item.field !== field || item.source !== 'document' || item.quote_verified !== true || !item.quote || !field || !isFactField(field)) return [];
      if (JSON.stringify(normaliseFact(field, item.value_text)) !== JSON.stringify(norm)) return [];
      const doc = documents.find(d => d.id === item.document_id);
      const key = JSON.stringify([doc?.id, item.page, item.quote]);
      if (seen.has(key)) return [];
      seen.add(key);
      return doc ? [{ evidence: doc.label, documentName: doc.file_name, page: item.page, quote: item.quote }] : [];
    }) : [];
    return [{ id: option.id, label: option.label, sources }];
  });
}

export function workspaceQuestion(questions: readonly QuestionRow[], run: AgentRunRow | null, documents: readonly DocumentRow[] = [], items: readonly EvidenceItemRow[] = []): QuestionView | null {
  const question = questions.at(-1);
  if (run?.status !== 'waiting_for_user' || !question || question.answer !== null) return null;
  const options = questionOptions(question, documents, items);
  const why = question.kind === 'conflict' ? 'The sources give different values. Your choice will be saved as Your statement.'
    : question.kind === 'document_request' ? 'A missing or unclear document prevents the next step.'
    : question.kind === 'confirm' && question.field === null ? 'Your requested change will be considered before a new plan is proposed.'
    : question.kind === 'confirm' ? 'Please check this reading before it is used.' : 'This detail is needed to decide the next step.';
  return { id: question.id, prompt: question.prompt, why, options, documentRequest: question.kind === 'document_request' };
}

export function workspaceStage(run: Pick<AgentRunRow, 'status' | 'phase'> | null): string {
  if (!run) return 'Documents added';
  if (run.status === 'running') return run.phase === 'reading' ? 'Reading documents' : 'Checking the next step';
  return ({ waiting_for_user: 'Needs your answer', plan_ready: 'Plan ready', completed: 'Finished',
    out_of_scope: 'Outside Nivaran’s scope', failed: 'Could not finish' } as const)[run.status];
}
