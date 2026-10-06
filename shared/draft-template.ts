import type { DraftRenderContext } from './draft-render.js';
import { renderDraft, DraftPlaceholderError } from './draft-render.js';
import type { PlanRow } from './database.js';

export type TemplateIssue = 'empty' | 'too_long' | 'literal_value' | 'date_in_model_prose' | 'placeholder_unavailable';
export function prosePlaceholders(context: DraftRenderContext): string[] {
  return context.facts.filter(f => ['document', 'user'].includes(f.status) && f.value_norm &&
    !['absent', 'date', 'duration'].includes(String(f.value_norm['kind'])))
    .map(f => `{{fact:${f.field}}}`);
}
/** Codes contain no document text, fact values, or rejected template content. */
export function templateIssue(template: string, context: DraftRenderContext): TemplateIssue | null {
  if (!template.trim()) return 'empty';
  if (template.length > 20000) return 'too_long';
  if (/\d/.test(template.replace(/{{[^{}]+}}/g, ''))) return 'literal_value';
  const allowed = new Set([...prosePlaceholders(context), '{{you:name}}', '{{you:contact}}', '{{you:address}}']);
  for (const match of template.matchAll(/{{[^{}]+}}/g)) {
    if (/{{(?:date:|today|fact:(?:order_date|cancellation_or_return_date|refund_promise_date|refund_due_date|complaint_sent_date))/.test(match[0])) return 'date_in_model_prose';
    if (!allowed.has(match[0])) return 'placeholder_unavailable';
  }
  try { renderDraft(template, context); }
  catch (error) { if (error instanceof DraftPlaceholderError) return 'placeholder_unavailable'; throw error; }
  return null;
}

/** Code owns the chronology sentences, not just their inserted values. */
export function caseChronology(context: DraftRenderContext): string {
  const has = (field: string) => context.facts.some(f => f.field === field && ['document', 'user'].includes(f.status) &&
    f.value_norm && f.value_norm['kind'] !== 'absent');
  const lines: string[] = [];
  if (has('order_id')) lines.push('Order: {{fact:order_id}}.');
  if (has('order_date')) lines.push('Order placed on {{fact:order_date}}.');
  if (has('cancellation_or_return_date')) lines.push('Cancellation or return recorded on {{fact:cancellation_or_return_date}}.');
  if (has('refund_amount')) lines.push('Refund amount: {{fact:refund_amount}}.');
  if (has('refund_promise_date') && context.facts.find(f => f.field === 'refund_promise_date')?.value_norm?.['kind'] === 'date')
    lines.push('The refund promise was made on {{fact:refund_promise_date}}.');
  if (has('refund_due_date') && context.facts.find(f => f.field === 'refund_due_date')?.value_norm?.['kind'] === 'date')
    lines.push('Refund due by {{fact:refund_due_date}}.');
  else if (context.dates['refund_due']) {
    const due = context.facts.find(f => f.field === 'refund_due_date' && ['document', 'user'].includes(f.status));
    if (due?.value_norm?.['kind'] === 'duration') {
      lines.push('Promised refund period: {{fact:refund_due_date}}. Calculated refund date: {{date:refund_due}}.');
      if (due.value_norm['unit'] === 'working_days') lines.push('This calculation skips weekends; public holidays are not handled.');
    } else if (due?.status === 'user' && due.value_norm?.['kind'] === 'absent' && has('cancellation_or_return_date'))
      lines.push("Working refund date: {{date:refund_due}}. This is Nivaran's working assumption, not a legal deadline.");
  }
  if (has('complaint_sent_date')) lines.push('Complaint sent on {{fact:complaint_sent_date}}.');
  const receipt = context.facts.find(f => f.field === 'refund_received' && ['document', 'user'].includes(f.status));
  if (receipt?.value_norm?.['kind'] === 'boolean') lines.push('Refund received: {{fact:refund_received}}.');
  return lines.join('\n');
}
export function assembleComplaint(prose: string, context: DraftRenderContext): string {
  return `Case details\n${caseChronology(context)}\n\n${prose}`;
}
/** Explicit consumer-selected recovery. No model call, invented contacts, or rule prose. */
export function basicComplaint(plan: PlanRow, context: DraftRenderContext): string {
  const has = (field: string) => context.facts.some(f => f.field === field && ['document', 'user'].includes(f.status) && f.value_norm && f.value_norm['kind'] !== 'absent');
  if (!has('order_id') || !has('refund_amount') || !has('merchant_name') ||
      !context.facts.some(f => f.field === 'refund_received' && ['document','user'].includes(f.status) && f.value_norm?.['value'] === false))
    throw new DraftPlaceholderError();
  const request = 'Please help resolve the pending refund, or provide its bank tracing reference if it has already been processed.';
  const prose = plan.ladder_step === 2
    ? `Problem\nI am requesting assistance with an owed online-order refund from {{fact:merchant_name}}.\n\nRequested remedy\n${request}\n\nEvidence\nThe attached evidence index identifies my order and refund correspondence.`
    : `To the grievance officer of {{fact:merchant_name}}\n\nI am requesting resolution of my pending online-order refund.\n\n${request}\n\nThe attached evidence index identifies my order and refund correspondence.`;
  return `{{today}}\n\n${assembleComplaint(prose, context)}\n\n{{you:name}}\n{{you:contact}}\n{{you:address}}`;
}
