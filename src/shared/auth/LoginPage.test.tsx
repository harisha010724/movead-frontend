import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/shared/api/client';
import { ApiError } from '@/shared/api/errors';
import { useToastStore } from '@/shared/ui/toast';
import { AuthProvider } from './AuthProvider';
import { LoginPage } from './LoginPage';
import type { Portal } from './portals';

vi.mock('@/shared/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

const post = vi.mocked(api.post);
const get = vi.mocked(api.get);

const userFor = (audience: Portal) => ({
  id: 'u1',
  email: 'someone@movead.in',
  fullName: 'Someone',
  status: 'ACTIVE' as const,
  audience,
  advertiserId: null,
  driverId: null,
  organisationName: 'MoveAd',
  roles: [],
  permissions: ['*'],
  mfaEnabled: false,
  lastLoginAt: null,
});

/** Reports the URL the app settled on, so a redirect is observable. */
function Landed() {
  return <span data-testid="landed">{useLocation().pathname}</span>;
}

function renderLogin({ from }: { from?: string } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: '/login', state: from ? { from } : null }]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Landed />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function signIn(email = 'someone@movead.in') {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-passphrase' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

const landedOn = async (path: string) =>
  waitFor(() => {
    expect(screen.getByTestId('landed')).toHaveTextContent(path);
  });

beforeEach(() => {
  vi.clearAllMocks();
  useToastStore.getState().clear();
});

/**
 * One sign-in URL for three products. Everything below is the consequence:
 * where you end up is decided by the account, and the page has to say so when
 * that is not where you asked to go.
 */
describe('where sign-in sends you', () => {
  it.each([
    ['advertiser', '/'],
    ['admin', '/admin'],
    ['driver', '/driver'],
  ] as const)('sends a signed-in %s to %s', async (audience, home) => {
    post.mockResolvedValue({ status: 'authenticated', audience, user: userFor(audience) });

    renderLogin();
    signIn();

    await landedOn(home);
  });

  /**
   * The session is cached under a key derived from the account's audience,
   * while the provider watches a key derived from the URL — and the URL is
   * `/login` for everybody. Reading the audience straight off the response is
   * what stops an admin from signing in successfully and then sitting on the
   * login page forever.
   */
  it('does not wait for a session cache the login URL cannot name', async () => {
    post.mockResolvedValue({
      status: 'authenticated',
      audience: 'admin',
      user: userFor('admin'),
    });

    renderLogin();
    signIn();

    await landedOn('/admin');
    // The page never asked who was signed in; the login response already said.
    expect(get).not.toHaveBeenCalled();
  });

  it('returns you to the page you were bounced off, when it is yours', async () => {
    post.mockResolvedValue({
      status: 'authenticated',
      audience: 'admin',
      user: userFor('admin'),
    });

    renderLogin({ from: '/admin/payouts' });
    signIn();

    await landedOn('/admin/payouts');
  });

  it('sends you home instead when that page belongs to another product, and says why', async () => {
    post.mockResolvedValue({
      status: 'authenticated',
      audience: 'driver',
      user: userFor('driver'),
    });

    renderLogin({ from: '/admin/payouts' });
    signIn();

    await landedOn('/driver');
    await waitFor(() => {
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
    expect(useToastStore.getState().toasts[0]?.title).toBe('Taken to your dashboard instead');
  });
});

describe('when the credentials are refused', () => {
  const refuse = () =>
    post.mockRejectedValue(
      new ApiError({
        status: 401,
        code: 'unauthenticated',
        message: 'Email or password is incorrect.',
      }),
    );

  it('keeps you on the page and raises the reason as a toast', async () => {
    refuse();

    renderLogin();
    signIn();

    await waitFor(() => {
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });

    const [raised] = useToastStore.getState().toasts;
    expect(raised?.variant).toBe('danger');
    expect(raised?.description).toBe('Email or password is incorrect.');
    expect(screen.queryByTestId('landed')).not.toBeInTheDocument();
  });

  it('leaves one message after repeated attempts, not one per attempt', async () => {
    refuse();

    renderLogin();
    signIn();
    await waitFor(() => {
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });

    signIn();
    await waitFor(() => {
      expect(post).toHaveBeenCalledTimes(2);
    });
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });
});

describe('a second factor', () => {
  it('is asked for, and carries the account to its own product afterwards', async () => {
    post.mockResolvedValueOnce({
      status: 'mfa_required',
      audience: 'admin',
      challengeToken: 'chl_1',
    });

    renderLogin();
    signIn();

    const code = await screen.findByLabelText('Verification code');

    post.mockResolvedValueOnce({
      status: 'authenticated',
      audience: 'admin',
      user: userFor('admin'),
    });

    fireEvent.change(code, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));

    await landedOn('/admin');
  });

  it('reports a rejected code without losing the challenge', async () => {
    post.mockResolvedValueOnce({
      status: 'mfa_required',
      audience: 'admin',
      challengeToken: 'chl_1',
    });

    renderLogin();
    signIn();

    const code = await screen.findByLabelText('Verification code');

    post.mockRejectedValueOnce(
      new ApiError({
        status: 401,
        code: 'unauthenticated',
        message: 'That code is not valid or has expired.',
      }),
    );

    fireEvent.change(code, { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));

    await waitFor(() => {
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
    expect(useToastStore.getState().toasts[0]?.title).toBe('That code was not accepted');
    // Still on the code step, so the user can simply try the next code.
    expect(screen.getByLabelText('Verification code')).toBeInTheDocument();
  });
});
