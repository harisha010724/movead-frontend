import { describe, expect, it } from 'vitest';
import { credentialsSchema, mfaSchema } from './authSchemas';

function errorFor(input: Record<string, unknown>, field: string): string | undefined {
  const result = credentialsSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

const valid = { email: 'priya@abcadvertising.in', password: 'correct horse battery' };

describe('credentialsSchema', () => {
  it('accepts an email and password', () => {
    expect(credentialsSchema.safeParse(valid).success).toBe(true);
  });

  it('trims surrounding whitespace rather than rejecting it', () => {
    const result = credentialsSchema.safeParse({ ...valid, email: '  priya@abc.in  ' });
    expect(result.success && result.data.email).toBe('priya@abc.in');
  });

  it('lowercases the address, because the server stores it as CITEXT', () => {
    const result = credentialsSchema.safeParse({ ...valid, email: 'Priya@ABC.in' });
    expect(result.success && result.data.email).toBe('priya@abc.in');
  });

  it.each(['priya.menon', 'priya menon@abc.in', '@abc.in'])('rejects %s', (email) => {
    expect(errorFor({ ...valid, email }, 'email')).toBeTruthy();
  });

  it('requires an email', () => {
    expect(errorFor({ ...valid, email: '' }, 'email')).toMatch(/Enter your email/);
  });

  it('requires a password', () => {
    expect(errorFor({ ...valid, password: '' }, 'password')).toMatch(/Enter your password/);
  });

  it('does not impose a password format, which would leak the policy', () => {
    expect(credentialsSchema.safeParse({ ...valid, password: 'a' }).success).toBe(true);
  });
});

describe('mfaSchema', () => {
  it('accepts a six-digit code', () => {
    expect(mfaSchema.safeParse({ code: '123456' }).success).toBe(true);
  });

  it.each(['12345', '1234567', '12345a'])('rejects %s', (code) => {
    const result = mfaSchema.safeParse({ code });
    expect(result.success).toBe(false);
  });
});
