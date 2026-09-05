import { describe, expect, it } from 'vitest';
import { formatINR, formatINRCompact, formatRate } from './money';
import { formatKm, formatPercent, formatSignedPercent } from './units';
import { formatDate, formatDateTime } from './datetime';

describe('money formatting', () => {
  it('uses Indian lakh grouping rather than thousands grouping', () => {
    // A western locale would render this as ₹1,00,000 → "₹100,000".
    expect(formatINR('100000.0000')).toBe('₹1,00,000.00');
    expect(formatINR('1234567.89')).toBe('₹12,34,567.89');
  });

  it('preserves paise', () => {
    expect(formatINR('313.80')).toBe('₹313.80');
    expect(formatINR('0.6000')).toBe('₹0.60');
  });

  it('renders a dash rather than NaN for missing values', () => {
    expect(formatINR(null)).toBe('—');
    expect(formatINR(undefined)).toBe('—');
    expect(formatINR('')).toBe('—');
    expect(formatINR('not-a-number')).toBe('—');
  });

  it('abbreviates to lakhs and crores', () => {
    expect(formatINRCompact('182400')).toBe('₹1.82\u00a0L');
    expect(formatINRCompact('41000000')).toBe('₹4.10\u00a0Cr');
  });

  it('separates the unit with a non-breaking space so it cannot wrap', () => {
    // A normal space lets "₹80.0 K" break across two lines in a chart axis.
    expect(formatINRCompact('80000')).not.toContain(' ');
    expect(formatINRCompact('80000')).toBe('₹80.0\u00a0K');
  });

  it('formats per-kilometre rates', () => {
    expect(formatRate('5.0000')).toBe('₹5.00/km');
    expect(formatRate('1.2000')).toBe('₹1.20/km');
  });
});

describe('unit formatting', () => {
  it('shows distance to one decimal place', () => {
    expect(formatKm(62.44)).toBe('62.4 km');
    expect(formatKm(0)).toBe('0.0 km');
  });

  it('treats percentages as ratios', () => {
    expect(formatPercent(0.163)).toBe('16.3%');
    expect(formatSignedPercent(0.163)).toBe('+16.3%');
    expect(formatSignedPercent(-0.052)).toBe('-5.2%');
  });
});

describe('date formatting', () => {
  it('renders in the platform timezone regardless of the host timezone', () => {
    // 18:45 UTC is 00:15 the next day in Asia/Kolkata. A browser in London
    // must still agree with the billing engine about which day this is.
    expect(formatDate('2026-08-17T18:45:00Z')).toBe('18 Aug 2026');
    expect(formatDateTime('2026-08-17T18:45:00Z')).toContain('18 Aug 2026');
  });

  it('renders a dash for missing dates', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('nonsense')).toBe('—');
  });
});
