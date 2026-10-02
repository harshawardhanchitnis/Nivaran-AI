import type { CaseFactRow, GuidanceRow, PlanRow } from '@shared/database';
import { LADDER_STEP_LABELS, LADDER_STEPS } from '@shared/ladder';
import type { LadderStep } from '@shared/ladder';
import { normaliseDate } from '@shared/normalise';
import type { PlanView, ReasonView, TimelineItemView } from '../shared/ui/models';

const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && normaliseDate(value) === value;
const formatDate = (value: string) => new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00Z`));
export function indiaCalendarDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export const COMPLAINT_DATE_BASIS = "Calculated from your recorded sent date. Rule 4(5) counts from receipt of the complaint; adjust these dates if receipt was later.";

/** Stored code decisions and human-checked rule rows drive the existing presentation. */
export function workspacePlan(plan: PlanRow | null, guidance: readonly GuidanceRow[], facts: readonly Pick<CaseFactRow, 'field' | 'status' | 'value_norm'>[], today: string): PlanView | null {
  if (!plan || plan.rejected_at || !LADDER_STEPS.includes(plan.ladder_step as LadderStep) || !validDate(today) || !plan.guidance_ids.length) return null;
  const step = plan.ladder_step as LadderStep;
  const rules = [...new Set(plan.guidance_ids)].map(id => guidance.find(row => row.id === id));
  if (rules.some(row => !row || !validDate(row.checked_on) || row.checked_on > today || !/^https?:\/\//i.test(row.source_url) || !row.applies_to_steps.includes(step))) return null;
  const reasons: ReasonView[] = plan.reasons.flatMap(value => {
    if (!value || typeof value !== 'object' || !('text' in value) || typeof value.text !== 'string') return [];
    return [{ text: value.text }];
  });
  for (const row of rules) if (row) reasons.push({ text: row.body, sourceName: row.source_name, sourceUrl: row.source_url, checkedOn: row.checked_on });
  const timeline: Array<TimelineItemView & { iso: string }> = [{ id: 'today', label: 'Today in India', date: formatDate(today), tone: 'today', iso: today }];
  const history: Record<string, string> = { order_date: 'Order placed', cancellation_or_return_date: 'Cancelled or return accepted', refund_promise_date: 'Refund promised', complaint_sent_date: 'Complaint sent' };
  for (const fact of facts) {
    const label = history[fact.field]; const value = fact.value_norm?.['value'];
    if (!label || (fact.status !== 'document' && fact.status !== 'user') || fact.value_norm?.['kind'] !== 'date' || !validDate(value)) continue;
    timeline.push({ id: fact.field, label, date: formatDate(value), tone: value > today ? 'upcoming' : value === today ? 'today' : 'past', iso: value });
  }
  const deadlines: Record<string, string> = { refund_due: 'Refund due', acknowledge_by: 'Acknowledge by', resolve_by: 'Resolve by' };
  for (const [id, label] of Object.entries(deadlines)) {
    const value = plan.dates[id]; if (!validDate(value)) continue;
    timeline.push({ id, label, date: formatDate(value), tone: value < today ? 'overdue' : value === today ? 'today' : 'upcoming', iso: value,
      ...(id !== 'refund_due' ? { note: COMPLAINT_DATE_BASIS } : {}) });
  }
  return { id: plan.id, step, headline: LADDER_STEP_LABELS[step], summary: plan.summary ?? 'Review this next step and its sources.', reasons,
    timeline: timeline.sort((a, b) => a.iso.localeCompare(b.iso)).map(({ iso: _iso, ...item }) => item) };
}
