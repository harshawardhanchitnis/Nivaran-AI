import { displayValue, uniqueEvidence } from './display-value';

describe('displayValue', () => {
  it.each([
    ['2026-09-24', '24 Sep 2026'],
    ['2026-10-01', '1 Oct 2026'],
    ['INR 9,999.00', '₹9,999'],
    ['Rs. 9999', '₹9,999'],
    ['₹1,23,456.50', '₹1,23,456.50'],
    ['INR 249.5', '₹249.50'],
    ['no', 'No'],
    ['YES', 'Yes'],
  ])('tidies %s as %s', (input, expected) => {
    expect(displayValue(input)).toBe(expected);
  });

  it.each(['MM260901', 'Desk lamp', '14/09/2026', 'within 7 working days', '2026-13-01'])(
    'leaves %s as it is',
    (input) => {
      expect(displayValue(input)).toBe(input);
    },
  );

  it('keeps a missing value missing', () => {
    expect(displayValue(null)).toBeNull();
  });
});

describe('uniqueEvidence', () => {
  it('shows each evidence label once, in order', () => {
    expect(uniqueEvidence([{ evidence: 'E02' }, { evidence: 'E01' }, { evidence: 'E02' }, { evidence: 'E03' }])).toEqual([
      'E01',
      'E02',
      'E03',
    ]);
  });
});
