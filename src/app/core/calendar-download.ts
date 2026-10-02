import type { PlanRow } from '@shared/database';
import { calendarFile } from '@shared/calendar';
/** A local file download, without calling an API or creating a calendar invitation. */
export function downloadPlanDates(plan: Pick<PlanRow, 'id' | 'dates'>, title: string): void {
  const content = calendarFile({
    planId: plan.id,
    title,
    dates: plan.dates,
    now: new Date().toISOString(),
  });
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'nivaran-refund-dates.ics';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
