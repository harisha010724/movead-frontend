import { describe, expect, it } from 'vitest';
import { formatRegistration, normaliseRegistration } from './vehicle';

describe('formatRegistration', () => {
  it('groups a plate the way it is painted', () => {
    expect(formatRegistration('KA01AB1234')).toBe('KA 01 AB 1234');
  });

  it('groups older plates, with a one-digit RTO and a single series letter', () => {
    expect(formatRegistration('KA5A1234')).toBe('KA 5 A 1234');
  });

  it('leaves an unrecognised value alone rather than mangling it', () => {
    expect(formatRegistration('TEMP-123')).toBe('TEMP123');
  });

  it('reads a plate typed with spaces the same as one typed without', () => {
    expect(formatRegistration('ka 01 ab 1234')).toBe(formatRegistration('KA01AB1234'));
  });
});

describe('normaliseRegistration', () => {
  it('strips the punctuation people type and uppercases the rest', () => {
    expect(normaliseRegistration(' ka-01 ab 1234 ')).toBe('KA01AB1234');
  });
});
