import { describe, expect, it } from 'vitest';
import { calendarFile } from '../../shared/calendar.js';
const options = {
  planId: '11111111-1111-4111-8111-111111111111',
  title: 'Refund follow-up',
  dates: { acknowledge_by: '2026-10-03', resolve_by: '2026-11-01' },
  now: '2026-10-02T12:00:00Z',
};
describe('browser calendar text', () => {
  it('uses all-day dates, non-inclusive next-day ends and stable event IDs', () => {
    const text = calendarFile(options);
    expect(text).toContain('BEGIN:VCALENDAR\r\nVERSION:2.0');
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(text).toContain('DTSTART;VALUE=DATE:20261003\r\nDTEND;VALUE=DATE:20261004');
    expect(text).toContain('DTEND;VALUE=DATE:20261102');
    expect(text).toContain('UID:11111111-1111-4111-8111-111111111111-acknowledge_by@nivaran');
    expect(text).not.toContain('ATTENDEE');
    expect(text).not.toContain('VALARM');
  });
  it('escapes text and folds at seventy-five UTF-8 octets without splitting a character', () => {
    const text = calendarFile({
      ...options,
      title: 'नाम'.repeat(40) + ';comma,slash\\\nBEGIN:VEVENT',
    });
    expect(text.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(
      true,
    );
    const unfolded = text.replace(/\r\n /g, '');
    expect(unfolded).toContain('नाम'.repeat(40) + '\\;comma\\,slash\\\\\\nBEGIN:VEVENT');
    expect(text.split('\r\n').filter((line) => line === 'BEGIN:VEVENT')).toHaveLength(2);
  });
  it('handles a year-end date and excludes unrelated fields and invalid dates', () => {
    const text = calendarFile({
      ...options,
      dates: { refund_due: '2026-12-31', unknown: '2026-10-02' },
    });
    expect(text).toContain('DTEND;VALUE=DATE:20270101');
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(() => calendarFile({ ...options, dates: { resolve_by: '2026-02-30' } })).toThrow();
    expect(() => calendarFile({ ...options, planId: 'bad\r\nATTENDEE:x' })).toThrow();
  });
  it('records the sent-versus-received date caveat in the downloaded file', () => {
    expect(calendarFile(options).replace(/\r\n /g, '')).toContain('receipt of the complaint');
  });
});
