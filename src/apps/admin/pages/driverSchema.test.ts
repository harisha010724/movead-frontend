import { describe, expect, it } from 'vitest';
import { editDriverSchema, onboardDriverSchema, removeDriverSchema } from './driverSchema';

const valid = {
  name: 'Ramesh Babu',
  mobile: '9876543210',
  email: 'ramesh.babu@example.com',
  vehicleType: 'CAB' as const,
  registrationNumber: 'KA01AB1234',
  city: 'Bengaluru',
  location: { label: 'MG Road, Bengaluru', lat: 12.9756, lng: 77.6069 },
};

function errorFor(input: Record<string, unknown>, field: string): string | undefined {
  const result = onboardDriverSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe('onboardDriverSchema', () => {
  it('accepts a complete driver', () => {
    expect(onboardDriverSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['+91 98765 43210', '9876543210'],
    ['098765-43210', '9876543210'],
    ['(9876) 543210', '9876543210'],
  ])('normalises %s to the ten national digits', (input, expected) => {
    const result = onboardDriverSchema.safeParse({ ...valid, mobile: input });
    expect(result.success && result.data.mobile).toBe(expected);
  });

  it.each(['1234567890', '5876543210'])('rejects %s, which cannot start an Indian mobile', (m) => {
    expect(errorFor({ ...valid, mobile: m }, 'mobile')).toMatch(/6, 7, 8 or 9/);
  });

  it('rejects a mobile number that is not ten digits', () => {
    expect(errorFor({ ...valid, mobile: '98765' }, 'mobile')).toMatch(/10-digit/);
  });

  it.each([
    ['ka 01 ab 1234', 'KA01AB1234'],
    ['KA-01-AB-1234', 'KA01AB1234'],
    ['ka05a1234', 'KA05A1234'],
  ])('normalises registration %s to %s', (input, expected) => {
    const result = onboardDriverSchema.safeParse({ ...valid, registrationNumber: input });
    expect(result.success && result.data.registrationNumber).toBe(expected);
  });

  it.each(['KA01AB123', 'K01AB1234', '0101AB1234'])('rejects malformed plate %s', (plate) => {
    expect(errorFor({ ...valid, registrationNumber: plate }, 'registrationNumber')).toMatch(
      /KA 01 AB 1234/,
    );
  });

  it('requires a full name', () => {
    expect(errorFor({ ...valid, name: 'R' }, 'name')).toMatch(/full name/);
  });

  it('requires an email, which is the login', () => {
    expect(errorFor({ ...valid, email: '' }, 'email')).toMatch(/email/);
    expect(errorFor({ ...valid, email: 'not-an-email' }, 'email')).toMatch(/valid email/);
  });

  it('requires an operating pin so the vehicle can match campaign zones', () => {
    expect(errorFor({ ...valid, location: undefined }, 'location')).toMatch(/pin/);
  });
});

describe('editDriverSchema', () => {
  const { city: _city, ...edit } = valid;

  it('accepts the identity fields and the pin, without the city picker', () => {
    expect(editDriverSchema.safeParse(edit).success).toBe(true);
  });

  it('normalises the same way, so a re-typed plate is not treated as a change', () => {
    const result = editDriverSchema.safeParse({ ...edit, registrationNumber: 'ka 01 ab 1234' });
    expect(result.success && result.data.registrationNumber).toBe('KA01AB1234');
  });

  it('still rejects a malformed mobile', () => {
    expect(editDriverSchema.safeParse({ ...edit, mobile: '1234567890' }).success).toBe(false);
  });
});

describe('removeDriverSchema', () => {
  it('accepts a reason a person would actually write', () => {
    const result = removeDriverSchema.safeParse({
      reason: 'Duplicate record — the same driver was onboarded as KA 01 AB 1234.',
    });
    expect(result.success).toBe(true);
  });

  // The API's floor is ten characters, so catching it here saves a round trip
  // that would come back as a 400 the admin has to interpret.
  it.each(['', 'dupe', 'wrong one'])('rejects %o as too short to be a reason', (reason) => {
    const result = removeDriverSchema.safeParse({ reason });
    expect(result.success).toBe(false);
  });

  it('trims before measuring, so spaces are not a reason', () => {
    expect(removeDriverSchema.safeParse({ reason: '          ' }).success).toBe(false);
  });
});
