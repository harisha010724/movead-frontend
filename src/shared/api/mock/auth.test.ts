import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, resetMockSession } from './mockFetch';

/**
 * The mock is the worked example of the auth contract, so the states a real
 * backend has to move through are asserted rather than assumed.
 *
 * These run as the advertiser portal — `__PORTAL__` is replaced at transform
 * time by the Vitest config — so this file covers the branch where a password
 * is enough. Admin's mandatory second factor is the server's decision and is
 * covered by the backend's integration tests.
 */
describe('auth session', () => {
  beforeEach(() => {
    resetMockSession();
  });

  const me = () => mockFetch('GET', '/v1/auth/me');
  const signIn = (password = 'anything') =>
    mockFetch('POST', '/v1/auth/login', { email: 'priya@abcadvertising.in', password });

  it('reports nobody signed in until credentials are presented', async () => {
    expect((await me()).status).toBe(401);
  });

  it('signs an advertiser in without a second factor', async () => {
    const response = await signIn();
    expect(response.status).toBe(200);

    const body = (await response.json()) as { status: string; audience: string };
    expect(body.status).toBe('authenticated');
    // The audience is what tells the shared login page where to send the browser.
    expect(body.audience).toBe('advertiser');
    expect((await me()).status).toBe(200);
  });

  it('rejects bad credentials without saying which half was wrong', async () => {
    const response = await signIn('wrong');
    expect(response.status).toBe(401);

    // The two are named together and neither is singled out, so the response
    // cannot be used to work out which addresses are registered.
    const body = (await response.json()) as { message: string };
    expect(body.message).toBe('That email and password do not match.');
    expect(body.message).not.toMatch(/unknown|no such|not found|incorrect password/i);
  });

  it('leaves the session signed out after a failed sign-in', async () => {
    await signIn('wrong');
    expect((await me()).status).toBe(401);
  });

  it('does not accept a second factor outside a challenge', async () => {
    const response = await mockFetch('POST', '/v1/auth/mfa/verify', { code: '123456' });
    expect(response.status).toBe(401);
    expect((await me()).status).toBe(401);
  });

  it('ends the session on sign-out', async () => {
    await signIn();
    expect((await mockFetch('POST', '/v1/auth/logout')).status).toBe(204);
    expect((await me()).status).toBe(401);
  });
});

describe('driver password session', () => {
  const home = window.location.pathname;

  beforeEach(() => {
    resetMockSession();
    window.history.replaceState({}, '', '/driver');
  });

  afterEach(() => {
    window.history.replaceState({}, '', home || '/');
  });

  const signIn = (password = 'anything') =>
    mockFetch('POST', '/v1/auth/login', { email: 'rahul.kumar@example.com', password });

  it('signs a driver in with email and password', async () => {
    const response = await signIn();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; audience: string };
    expect(body.status).toBe('authenticated');
    expect(body.audience).toBe('driver');
    expect((await mockFetch('GET', '/v1/auth/me')).status).toBe(200);
    expect((await mockFetch('GET', '/v1/driver/me')).status).toBe(200);
  });

  it('rejects a bad password without opening a session', async () => {
    const response = await signIn('wrong');
    expect(response.status).toBe(401);
    expect((await mockFetch('GET', '/v1/auth/me')).status).toBe(401);
  });

  it('does not share the session with the advertiser portal', async () => {
    await signIn();
    window.history.replaceState({}, '', '/');
    expect((await mockFetch('GET', '/v1/auth/me')).status).toBe(401);
  });
});

/**
 * There is one sign-in URL for all three products, so the path cannot say who
 * is signing in. The credentials have to, which is how the real API has always
 * decided it — the mock used to read the URL and would now call everybody an
 * advertiser.
 */
describe('audience comes from the account, not the URL', () => {
  const home = window.location.pathname;

  beforeEach(() => {
    resetMockSession();
    window.history.replaceState({}, '', '/login');
  });

  afterEach(() => {
    window.history.replaceState({}, '', home || '/');
  });

  const audienceOf = async (email: string) => {
    const response = await mockFetch('POST', '/v1/auth/login', { email, password: 'anything' });
    const body = (await response.json()) as { audience?: string };
    return body.audience;
  };

  it('reads a driver out of the same URL an advertiser signs in at', async () => {
    expect(await audienceOf('rahul.kumar@example.com')).toBe('driver');
  });

  it('reads an advertiser', async () => {
    expect(await audienceOf('priya@abcadvertising.in')).toBe('advertiser');
  });

  it('reads an admin', async () => {
    expect(await audienceOf('rahul@movead.in')).toBe('admin');
  });

  it('falls back to the portal being reviewed for an address it does not know', async () => {
    expect(await audienceOf('someone.new@movead.in')).toBe('advertiser');
  });

  it('is case and whitespace insensitive, as an email lookup should be', async () => {
    expect(await audienceOf('  Rahul.Kumar@Example.com ')).toBe('driver');
  });
});

/**
 * Admin TOTP is mandatory (ADM-001) but switched off locally while the portal
 * screens are built, so the flag is forced on here rather than left to
 * `.env.local`. The point being covered is that the second factor cannot change
 * who is signing in: the audience has to survive from the password to the code.
 */
describe('an admin second factor', () => {
  const home = window.location.pathname;

  const withMfaOn = async () => {
    vi.stubEnv('VITE_ADMIN_MFA_REQUIRED', 'true');
    vi.resetModules();
    const fresh = await import('./mockFetch');
    fresh.resetMockSession();
    return fresh.mockFetch;
  };

  beforeEach(() => {
    window.history.replaceState({}, '', '/login');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    window.history.replaceState({}, '', home || '/');
  });

  it('is demanded of an admin, and leaves no session behind on its own', async () => {
    const fetchAs = await withMfaOn();

    const response = await fetchAs('POST', '/v1/auth/login', {
      email: 'rahul@movead.in',
      password: 'anything',
    });
    const body = (await response.json()) as { status: string; audience: string };

    expect(body.status).toBe('mfa_required');
    expect(body.audience).toBe('admin');
    expect((await fetchAs('GET', '/v1/auth/me')).status).toBe(401);
  });

  it('still signs the admin in as an admin, from the advertiser sign-in URL', async () => {
    const fetchAs = await withMfaOn();

    await fetchAs('POST', '/v1/auth/login', { email: 'rahul@movead.in', password: 'anything' });
    const verified = await fetchAs('POST', '/v1/auth/mfa/verify', { code: '123456' });
    const body = (await verified.json()) as { status: string; audience: string };

    expect(body.status).toBe('authenticated');
    expect(body.audience).toBe('admin');
  });

  it('is not demanded of an advertiser', async () => {
    const fetchAs = await withMfaOn();

    const response = await fetchAs('POST', '/v1/auth/login', {
      email: 'priya@abcadvertising.in',
      password: 'anything',
    });
    const body = (await response.json()) as { status: string };

    expect(body.status).toBe('authenticated');
  });
});

/**
 * The mock once booted signed in, so opening the app went straight to the
 * dashboard and the login page — the one screen every user meets first — was
 * only reachable by typing its URL.
 */
describe('boot state', () => {
  /**
   * A reload re-evaluates the module from scratch, so `vi.resetModules()` is
   * what makes these tests mean anything — importing the already-loaded module
   * would just read the module state the previous test left behind and pass
   * whatever the boot logic actually did.
   */
  const reboot = async () => {
    vi.resetModules();
    return (await import('./mockFetch')).mockFetch;
  };

  const signIn = () =>
    mockFetch('POST', '/v1/auth/login', {
      email: 'priya@abcadvertising.in',
      password: 'anything',
    });

  it('starts signed out, so the app opens on the login page', async () => {
    // Signed in first, so a pass cannot come from there being no session to
    // find: the cleared storage below is the only reason the reboot is anonymous.
    await signIn();
    window.sessionStorage.clear();

    const fresh = await reboot();
    expect((await fresh('GET', '/v1/auth/me')).status).toBe(401);
  });

  it('survives a reload once signed in, the way a session cookie would', async () => {
    await signIn();

    const reloaded = await reboot();
    expect((await reloaded('GET', '/v1/auth/me')).status).toBe(200);
  });
});
