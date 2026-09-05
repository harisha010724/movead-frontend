import { describe, expect, it } from 'vitest';
import { addIsoDays, compareIsoDates, monthGrid } from './civilDate';

describe('civilDate', () => {
  it('adds days across a month boundary', () => {
    expect(addIsoDays('2026-08-22', 6)).toBe('2026-08-28');
    expect(addIsoDays('2026-08-28', -6)).toBe('2026-08-22');
  });

  it('compares civil dates as strings of the same form', () => {
    expect(compareIsoDates('2026-08-22', '2026-08-23')).toBe(-1);
    expect(compareIsoDates('2026-08-22', '2026-08-22')).toBe(0);
  });

  it('starts a month grid on Sunday and covers six weeks', () => {
    const cells = monthGrid(2026, 7);
    expect(cells).toHaveLength(42);
    expect(cells[0]).toBe('2026-07-26');
    expect(cells[6]).toBe('2026-08-01');
  });
});
