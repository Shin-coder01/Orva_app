import { describe, expect, it } from '@jest/globals';

import { formatDate, formatINR, isValidDateOnly, toDateOnly } from './format';

describe('formatINR', () => {
  const cases: [number, string][] = [
    [500, '\u20B9500'],
    [5000, '\u20B95,000'],
    [100000, '\u20B91,00,000'],
    [12345678, '\u20B91,23,45,678'],
  ];

  it.each(cases)('formats %i with Indian digit grouping', (amount, expected) => {
    expect(formatINR(amount)).toBe(expected);
  });
});

describe('date formatting', () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  it('displays a day-precision date without UTC conversion', () => {
    expect(formatDate('2026-10-03', 'DAY', months)).toBe('03 Oct 2026');
  });

  it('displays only the year for year-precision dates', () => {
    expect(formatDate('2025-01-01', 'YEAR', months)).toBe('2025');
  });

  it('converts a local date without changing its calendar day', () => {
    expect(toDateOnly(new Date(2026, 9, 3))).toBe('2026-10-03');
  });

  it('validates real calendar dates, including leap years', () => {
    expect(isValidDateOnly('2024-02-29')).toBe(true);
    expect(isValidDateOnly('2025-02-29')).toBe(false);
    expect(isValidDateOnly('2026-13-01')).toBe(false);
  });
});
