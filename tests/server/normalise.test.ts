import { describe, expect, it } from 'vitest';
import { normaliseAmount, normaliseDate, normaliseDuration, normaliseFact } from '../../server/verify/normalise.js';

describe('amount normalisation', () => {
  it.each(['₹9,999.00', 'Rs. 9999', 'INR 9,999', '9999', '₹ 9,999/-'])('normalises %s without floating point arithmetic', value => {
    expect(normaliseAmount(value)).toEqual({ currency: 'INR', decimal: '9999.00' });
  });
  it.each([['₹1,23,456.7', '123456.70'], ['0.01', '0.01'], ['INR 0', '0.00'], ['9,999,999.99', '9999999.99']])('accepts grouped %s', (value, decimal) => {
    expect(normaliseAmount(value)?.decimal).toBe(decimal);
  });
  it.each(['USD 9999', '-9999', '9,99', '9.999', '9,999 or 8,999', 'nine thousand', 'NaN', '1e4', '', '₹9 999'])('refuses ambiguous or invalid %s', value => {
    expect(normaliseAmount(value)).toBeNull();
  });
});

describe('date normalisation', () => {
  it.each(['14 Sep 2026', '14/09/2026', '2026-09-14', 'Sep 14, 2026', '14th September 2026'])('normalises %s', value => {
    expect(normaliseDate(value)).toBe('2026-09-14');
  });
  it.each([['03/04/2026', '2026-04-03'], ['29 Feb 2024', '2024-02-29'], ['Dec 31, 2026', '2026-12-31']])('handles %s', (value, iso) => {
    expect(normaliseDate(value)).toBe(iso);
  });
  it.each(['29 Feb 2026', '31/04/2026', '2026-13-01', '14/09/26', 'tomorrow', '14 Sep 2026 or 15 Sep 2026', ''])('refuses %s without rolling into another month', value => {
    expect(normaliseDate(value)).toBeNull();
  });
});

describe('duration normalisation', () => {
  it.each([
    ['5-7 working days', { n: 7, unit: 'working_days' }],
    ['within 7 business days', { n: 7, unit: 'working_days' }],
    ['5–7 days', { n: 7, unit: 'calendar_days' }],
    ['1 calendar month', { n: 1, unit: 'calendar_months' }],
  ])('takes the stated upper bound: %s', (value, duration) => {
    expect(normaliseDuration(value as string)).toEqual(duration);
  });
  it.each(['7-5 days', '0 days', 'soon', '7 days or 14 days', '-5 days'])('refuses %s', value => {
    expect(normaliseDuration(value)).toBeNull();
  });
});

describe('field-specific values', () => {
  it('rejects the exact footer Qwen misclassified as the clean invoice order ID',()=>{
    expect(normaliseFact('order_id','FICTIONAL TEST DOCUMENT - NO REAL CUSTOMER OR TRANSACTION')).toBeNull();
    expect(normaliseFact('order_id','MM260901')).toEqual({kind:'id',value:'MM260901'});
  });
  it('does not turn an explicit missing bank reference into an ID', () => {
    // Qwen's measured reading: value "None", source quote "No refund reference has been issued".
    expect(normaliseFact('refund_reference', 'None')).toEqual({ kind: 'absent', value: false });
    expect(normaliseFact('refund_reference', 'No refund reference has been issued.')).toEqual({ kind: 'absent', value: false });
    expect(normaliseFact('refund_reference', 'ARN-0123456789')).toEqual({ kind: 'id', value: 'ARN-0123456789' });
  });
  it('retains ID punctuation and leading zeroes', () => {
    expect(normaliseFact('order_id', ' mm-00123 ')).toEqual({ kind: 'id', value: 'MM-00123' });
    expect(normaliseFact('order_id', 'MM00123')).not.toEqual(normaliseFact('order_id', 'MM-00123'));
  });
  it('keeps uncertain booleans and dates for human checking', () => {
    expect(normaliseFact('refund_received', 'not yet')).toEqual({ kind: 'boolean', value: false });
    expect(normaliseFact('refund_received', 'maybe')).toBeNull();
    expect(normaliseFact('refund_due_date', '5-7 working days')).toEqual({ kind: 'duration', n: 7, unit: 'working_days' });
    expect(normaliseFact('refund_due_date', 'No date was given')).toEqual({ kind: 'absent', value: false });
  });
});
