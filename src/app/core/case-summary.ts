import type { CaseRow, CaseStatus } from '@shared/database';
import { LADDER_STEPS, LADDER_STEP_LABELS } from '@shared/ladder';
import type { CaseSummaryView } from '../shared/ui/models';

const STATUS_LABELS: Record<CaseStatus, string> = {
  open: 'Documents added', investigating: 'Nivaran is working', waiting_for_user: 'Needs your answer',
  plan_ready: 'Plan ready', approved: 'Plan approved', sent: 'Complaint sent',
  resolved: 'Refund received', out_of_scope: 'Outside Nivaran’s scope',
};
const DEADLINE_LABELS: Record<string, string> = {
  refund_due: 'Refund due', acknowledge_by: 'Acknowledgement due', resolve_by: 'Resolution due',
};

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function caseSummary(
  row: CaseRow, documentCount: number, dates: Readonly<Record<string, string | undefined>>, today: string,
): CaseSummaryView {
  const step = LADDER_STEPS.find((step) => step === row.ladder_step);
  const deadlines = Object.entries(dates)
    .filter((entry): entry is [string, string] => Object.hasOwn(DEADLINE_LABELS, entry[0]) && typeof entry[1] === 'string' && isIsoDate(entry[1]))
    .sort((a, b) => a[1].localeCompare(b[1]));
  const next = deadlines.find((entry) => entry[1] >= today) ?? deadlines.at(-1);
  return {
    id: row.id, title: row.title, merchant: row.merchant_name,
    status: STATUS_LABELS[row.status], documentCount,
    step: step === undefined ? null : LADDER_STEP_LABELS[step],
    nextDate: next && row.status !== 'resolved' && row.status !== 'out_of_scope'
      ? { label: DEADLINE_LABELS[next[0]]!, date: next[1], overdue: next[1] < today } : null,
  };
}
