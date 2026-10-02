import { normaliseDate } from '../../shared/normalise.js';

export function dateValue(iso: string): Date {
  if (normaliseDate(iso) !== iso) throw new RangeError('Use a valid ISO calendar date.');
  return new Date(`${iso}T00:00:00Z`);
}
function count(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 36600) throw new RangeError('Date duration is outside the supported range.');
}
function isoValue(date: Date): string {
  const iso = date.toISOString().slice(0, 10);
  if (normaliseDate(iso) !== iso) throw new RangeError('Computed date is outside the supported range.');
  return iso;
}
export function addCalendarDays(iso: string, days: number): string {
  count(days); const date = dateValue(iso); date.setUTCDate(date.getUTCDate() + days); return isoValue(date);
}
/** The starting day is excluded. Saturdays and Sundays are skipped; holidays are not handled. */
export function addWorkingDays(iso: string, days: number): string {
  count(days); const date = dateValue(iso);
  while (days > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) days--;
  }
  return isoValue(date);
}
/** Clamp the original day to the last day of the destination calendar month. */
export function addCalendarMonths(iso: string, months: number): string {
  count(months); const date = dateValue(iso); const day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last)); return isoValue(date);
}
export function indiaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
