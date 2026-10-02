import { normaliseDate } from './normalise.js';
export interface CalendarOptions {
  planId: string;
  title: string;
  dates: Readonly<Record<string, string>>;
  now: string;
}
const escapeText = (value: string) =>
  value
    .replaceAll('\\', '\\\\')
    .replace(/\r?\n|\r/g, '\\n')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
function fold(value: string): string {
  let line = '';
  let count = 0;
  const lines: string[] = [];
  for (const character of value) {
    const bytes = new TextEncoder().encode(character).length;
    if (count + bytes > 75) {
      lines.push(line);
      line = ' ';
      count = 1;
    }
    line += character;
    count += bytes;
  }
  lines.push(line);
  return lines.join('\r\n');
}
/** RFC 5545 all-day entries, created locally. No invitations, alarms, personal details or API call. */
export function calendarFile(options: CalendarOptions): string {
  if (
    !/^[a-zA-Z0-9_-]{1,100}$/.test(options.planId) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(options.now) ||
    !Number.isFinite(Date.parse(options.now))
  )
    throw new RangeError('Invalid calendar identity or timestamp.');
  const stamp = new Date(options.now)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nivaran AI//Refund dates//EN',
    'CALSCALE:GREGORIAN',
  ];
  const labels: Record<string, string> = {
    refund_due: 'Refund due',
    acknowledge_by: 'Acknowledgement due',
    resolve_by: 'Resolution due',
  };
  for (const [key, label] of Object.entries(labels)) {
    const date = options.dates[key];
    if (!date) continue;
    if (normaliseDate(date) !== date) throw new RangeError('Invalid calendar date.');
    const end = new Date(date + 'T00:00:00Z');
    end.setUTCDate(end.getUTCDate() + 1);
    const description =
      key === 'refund_due'
        ? 'Recorded refund due date. Review your case and its source; this may be a disclosed working assumption.'
        : 'Calculated from your recorded sent date. Rule 4(5) counts from receipt of the complaint; adjust if receipt was later. Nivaran is not legal advice.';
    lines.push(
      'BEGIN:VEVENT',
      `UID:${options.planId}-${key}@nivaran`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${date.replaceAll('-', '')}`,
      `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replaceAll('-', '')}`,
      `SUMMARY:${escapeText(`${label}: ${options.title}`)}`,
      `DESCRIPTION:${escapeText(description)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
