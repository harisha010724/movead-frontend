import { describe, expect, it } from 'vitest';
import { isPublicAuthPath } from './session';

describe('isPublicAuthPath', () => {
  it('skips the session probe on sign-in and invitation pages', () => {
    expect(isPublicAuthPath('/login')).toBe(true);
    expect(isPublicAuthPath('/invitation/abc')).toBe(true);
    expect(isPublicAuthPath('/driver/invitation/abc')).toBe(true);
  });

  it('still skips it on the retired login URLs, which only redirect', () => {
    expect(isPublicAuthPath('/admin/login')).toBe(true);
    expect(isPublicAuthPath('/driver/login')).toBe(true);
  });

  it('restores the session on protected pages', () => {
    expect(isPublicAuthPath('/')).toBe(false);
    expect(isPublicAuthPath('/admin')).toBe(false);
    expect(isPublicAuthPath('/admin/advertisers')).toBe(false);
    expect(isPublicAuthPath('/driver')).toBe(false);
    expect(isPublicAuthPath('/driver/earnings')).toBe(false);
  });
});
