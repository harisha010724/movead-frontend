import { describe, expect, it } from 'vitest';
import { compareMoney } from './money';

/**
 * This decides whether a campaign budget fits inside an advertiser's available
 * wallet balance (AC-34.6), so the boundary cases are the point of the test.
 */
describe('compareMoney', () => {
  it('treats equal amounts written differently as equal', () => {
    expect(compareMoney('117839', '117839.0000')).toBe(0);
    expect(compareMoney('0', '0.0000')).toBe(0);
  });

  it('orders amounts either side of a wallet balance', () => {
    expect(compareMoney('117840', '117839.0000')).toBe(1);
    expect(compareMoney('117838', '117839.0000')).toBe(-1);
  });

  it('separates amounts one hundredth of a rupee apart', () => {
    expect(compareMoney('100.01', '100.00')).toBe(1);
    expect(compareMoney('100.00', '100.01')).toBe(-1);
  });

  it('stays exact where binary floats do not', () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point; scaled integers are unaffected.
    expect(compareMoney('0.3', '0.3000')).toBe(0);
    expect(compareMoney('1000000000000.01', '1000000000000.00')).toBe(1);
  });

  it('handles negative balances', () => {
    expect(compareMoney('-50.00', '10.00')).toBe(-1);
    expect(compareMoney('10.00', '-50.00')).toBe(1);
  });
});
