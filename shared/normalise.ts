import type { FactField } from './facts.js';

export type AmountValue = { currency: 'INR'; decimal: string };
export type DurationValue = { n: number; unit: 'working_days' | 'calendar_days' | 'calendar_months' };
export type NormalisedFact =
  | ({ kind: 'amount' } & AmountValue) | ({ kind: 'duration' } & DurationValue)
  | { kind: 'date' | 'id' | 'text'; value: string }
  | { kind: 'boolean' | 'absent'; value: boolean };

const clean = (text: string) => text.normalize('NFKC').trim().replace(/\s+/gu, ' ');

/** Decimal strings retain cents exactly; no binary floating point rounding. */
export function normaliseAmount(text: string): AmountValue | null {
  const value = clean(text).replace(/^(?:₹|Rs\.?|INR)\s*/i, '').replace(/\s*\/-$/, '');
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole = '', fraction = ''] = value.replaceAll(',', '').split('.');
  const integer = whole.replace(/^0+(?=\d)/, '');
  if (integer.length > 15) return null;
  return { currency: 'INR', decimal: `${integer}.${fraction.padEnd(2, '0')}` };
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function isoDate(year: number, month: number, day: number): string | null {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

/** Slash dates are day-first for India; invalid dates never roll into another month. */
export function normaliseDate(text: string): string | null {
  const value = clean(text);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const numeric = /^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/.exec(value);
  if (numeric) return isoDate(Number(numeric[4]), Number(numeric[3]), Number(numeric[1]));
  const dayFirst = /^(\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]+) (\d{4})$/i.exec(value);
  if (dayFirst) return isoDate(Number(dayFirst[3]), MONTHS[dayFirst[2]!.toLowerCase()] ?? 0, Number(dayFirst[1]));
  const monthFirst = /^([A-Za-z]+) (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})$/i.exec(value);
  if (monthFirst) return isoDate(Number(monthFirst[3]), MONTHS[monthFirst[1]!.toLowerCase()] ?? 0, Number(monthFirst[2]));
  return null;
}

export function normaliseDuration(text: string): DurationValue | null {
  const match = /^(?:within )?(\d+)(?:\s*[-–—]\s*(\d+))?\s+(?:(working|business|calendar) )?(days?|months?)$/i.exec(clean(text));
  if (!match) return null;
  const first = Number(match[1]); const last = Number(match[2] ?? match[1]);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 1 || last < first) return null;
  const modifier = match[3]?.toLowerCase();
  const months = match[4]!.toLowerCase().startsWith('month');
  if (months && modifier && modifier !== 'calendar') return null;
  return { n: last, unit: months ? 'calendar_months' : modifier === 'working' || modifier === 'business' ? 'working_days' : 'calendar_days' };
}

function booleanValue(value: string, field: FactField): boolean | null {
  const lower = value.toLowerCase().replace(/[.!]$/, '');
  if (['yes', 'true'].includes(lower)) return true;
  if (['no', 'false', 'not yet'].includes(lower)) return false;
  if (field === 'refund_received') {
    if (/^(?:refund )?(?:not received|has not arrived|not arrived)$/.test(lower)) return false;
    if (/^(?:refund )?(?:received|credited)$/.test(lower)) return true;
  }
  if (field === 'complaint_acknowledged') {
    if (/^(?:complaint )?(?:not acknowledged|no acknowledgement|no reply)$/.test(lower)) return false;
    if (/^(?:complaint )?acknowledged$/.test(lower)) return true;
  }
  if (field === 'complaint_refused') {
    if (/^(?:refund )?(?:refused|refused in writing)$/.test(lower)) return true;
    if (/^(?:refund )?not refused$/.test(lower)) return false;
  }
  return null;
}

export function normaliseFact(field: FactField, text: string): NormalisedFact | null {
  const value = clean(text);
  if (!value) return null;
  if (field === 'amount_paid' || field === 'refund_amount') {
    const amount = normaliseAmount(value); return amount ? { kind: 'amount', ...amount } : null;
  }
  if (field === 'refund_due_date' && /^(?:no (?:refund )?date (?:was (?:ever )?)?(?:given|provided)|not given)\.?$/i.test(value)) return { kind: 'absent', value: false };
  if (field.endsWith('_date')) {
    const date = normaliseDate(value);
    if (date) return { kind: 'date', value: date };
    const duration = field === 'refund_due_date' ? normaliseDuration(value) : null;
    return duration ? { kind: 'duration', ...duration } : null;
  }
  if (field === 'refund_reference' || field === 'order_id') {
    if (/^(?:none|not provided|not available|no (?:refund )?reference(?: number)?(?: has been issued| was issued| was provided)?|no order id)\.?$/i.test(value)) return { kind: 'absent', value: false };
    // Identifiers are single tokens, not narrative sentences or document disclaimers.
    return value.length <= 160 && /^[\p{L}\p{N}._/#:-]+$/u.test(value) ? { kind: 'id', value: value.toUpperCase() } : null;
  }
  if (field === 'refund_received' || field === 'complaint_acknowledged' || field === 'complaint_refused') {
    const boolean = booleanValue(value, field); return boolean === null ? null : { kind: 'boolean', value: boolean };
  }
  return { kind: 'text', value: value.toLocaleLowerCase('en-IN') };
}
