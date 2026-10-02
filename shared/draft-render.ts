import type { CaseFactRow, DocumentRow, EvidenceItemRow } from './database.js';
import { isFactField } from './facts.js';
import { normaliseDate } from './normalise.js';
export interface TextSpan {
  start: number;
  end: number;
}
export type DraftFact = Pick<
  CaseFactRow,
  'field' | 'status' | 'value_text' | 'value_norm' | 'evidence_item_id'
>;
export interface DraftRenderContext {
  facts: readonly DraftFact[];
  evidence: readonly Pick<EvidenceItemRow, 'id' | 'source' | 'document_id'>[];
  documents: readonly Pick<DocumentRow, 'id' | 'label'>[];
  dates: Record<string, string>;
  today: string;
}
export interface RenderedPart {
  kind: 'text' | 'value' | 'you';
  text: string;
  evidence?: string;
  start: number;
  end: number;
}
export interface RenderedDraft {
  text: string;
  parts: RenderedPart[];
  spans: TextSpan[];
}
export class DraftPlaceholderError extends Error {
  constructor() {
    super('The draft used an unknown or unavailable placeholder.');
  }
}
const dateText = (date: string) => {
  if (normaliseDate(date) !== date) throw new DraftPlaceholderError();
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00Z`));
};
function factText(fact: DraftFact): string {
  const value = fact.value_norm;
  if (!value || !['document', 'user'].includes(fact.status)) throw new DraftPlaceholderError();
  if (
    value['kind'] === 'amount' &&
    typeof value['decimal'] === 'string' &&
    /^\d{1,15}\.\d{2}$/.test(value['decimal'])
  ) {
    const [whole, fraction] = value['decimal'].split('.');
    return `₹${new Intl.NumberFormat('en-IN').format(BigInt(whole!))}${fraction === '00' ? '' : '.' + fraction}`;
  }
  if (value['kind'] === 'date' && typeof value['value'] === 'string')
    return dateText(value['value']);
  if (value['kind'] === 'duration' && Number.isSafeInteger(value['n']))
    return `${String(value['n'])} ${String(value['unit']).replaceAll('_', ' ')}`;
  if (value['kind'] === 'boolean' && typeof value['value'] === 'boolean')
    return value['value'] ? 'Yes' : 'No';
  if ((value['kind'] === 'id' || value['kind'] === 'text') && typeof value['value'] === 'string')
    return value['kind'] === 'text' ? (fact.value_text ?? value['value']) : value['value'];
  throw new DraftPlaceholderError();
}
const usable = (context: DraftRenderContext, field: string) =>
  context.facts.find((f) => f.field === field && (f.status === 'document' || f.status === 'user'));
function label(context: DraftRenderContext, field: string): string {
  const fact = usable(context, field);
  if (!fact) throw new DraftPlaceholderError();
  if (fact.status === 'user') return 'your statement';
  const item = context.evidence.find(
    (e) => e.id === fact.evidence_item_id && e.source === 'document',
  );
  const document = context.documents.find((d) => d.id === item?.document_id);
  if (!document || !/^E\d{2}$/.test(document.label)) throw new DraftPlaceholderError();
  return document.label;
}
/** Personal values never enter this server-safe renderer. Browser filling is a separate operation. */
export function renderDraft(template: string, context: DraftRenderContext): RenderedDraft {
  let text = '';
  const parts: RenderedPart[] = [];
  const spans: TextSpan[] = [];
  let previous = 0;
  const append = (kind: RenderedPart['kind'], value: string, evidence?: string) => {
    const start = text.length;
    text += value;
    const end = text.length;
    parts.push({ kind, text: value, start, end, ...(evidence ? { evidence } : {}) });
    if (kind !== 'text') spans.push({ start, end });
  };
  for (const match of template.matchAll(/{{([^{}]+)}}/g)) {
    const ordinary = template.slice(previous, match.index);
    if (ordinary.includes('{{') || ordinary.includes('}}')) throw new DraftPlaceholderError();
    append('text', ordinary);
    const key = match[1]!.trim();
    let value: string;
    let evidence: string;
    if (/^you:(name|contact|address)$/.test(key)) append('you', `{{${key}}}`);
    else {
      if (key === 'today') {
        value = dateText(context.today);
        evidence = 'calculated';
      } else if (key.startsWith('fact:') && isFactField(key.slice(5))) {
        const fact = usable(context, key.slice(5));
        if (!fact) throw new DraftPlaceholderError();
        value = factText(fact);
        evidence = label(context, fact.field);
      } else if (
        key.startsWith('date:') &&
        ['refund_due', 'acknowledge_by', 'resolve_by'].includes(key.slice(5))
      ) {
        const date = context.dates[key.slice(5)];
        if (!date) throw new DraftPlaceholderError();
        value = dateText(date);
        const basis =
          key === 'date:refund_due'
            ? usable(context, 'refund_due_date')
              ? 'refund_due_date'
              : 'cancellation_or_return_date'
            : 'complaint_sent_date';
        evidence = label(context, basis);
      } else throw new DraftPlaceholderError();
      append('value', `${value} [${evidence}]`, evidence);
    }
    previous = match.index + match[0].length;
  }
  const tail = template.slice(previous);
  if (tail.includes('{{') || tail.includes('}}')) throw new DraftPlaceholderError();
  append('text', tail);
  return { text, parts, spans };
}
export function fillPrivateDetails(
  text: string,
  details: Record<'name' | 'contact' | 'address', string>,
): { text: string; spans: TextSpan[] } {
  const spans: TextSpan[] = [];
  let output = '';
  let previous = 0;
  for (const match of text.matchAll(/{{you:(name|contact|address)}}/g)) {
    output += text.slice(previous, match.index);
    const start = output.length;
    output += details[match[1] as keyof typeof details] || `[your ${match[1]}]`;
    spans.push({ start, end: output.length });
    previous = match.index + match[0].length;
  }
  return { text: output + text.slice(previous), spans };
}
/** Preserve source spans after edits only where the exact rendered, labelled value survives. */
export function draftLintSpans(
  template: string,
  text: string,
  context: DraftRenderContext,
): TextSpan[] {
  const spans = [...text.matchAll(/{{you:(?:name|contact|address)}}/g)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
  try {
    for (const part of renderDraft(template, context).parts.filter(
      (part) => part.kind === 'value',
    )) {
      let start = text.indexOf(part.text);
      while (start >= 0) {
        spans.push({ start, end: start + part.text.length });
        start = text.indexOf(part.text, start + part.text.length);
      }
    }
  } catch {
    /* Historical or changed facts are linted without trusting their former spans. */
  }
  return spans;
}
