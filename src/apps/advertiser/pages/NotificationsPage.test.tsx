import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/shared/api/client';
import NotificationsPage from './NotificationsPage';

const navigate = vi.fn();

vi.mock('@/shared/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('@/shared/auth/useAuth', () => ({
  useAuth: () => ({ user: { portal: 'advertiser' } }),
}));

vi.mock('@/shared/layout/Page', () => ({
  Page: ({ title, children }: { title: string; children: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);

const ITEMS = [
  {
    id: 'n1',
    kind: 'CAMPAIGN' as const,
    title: 'Campaign approved',
    body: '“ABC Summer” has been approved.',
    href: '/campaigns/cmp_1',
    readAt: null,
    createdAt: '2026-10-01T07:30:00.000Z',
  },
  {
    id: 'n2',
    kind: 'CAMPAIGN' as const,
    title: 'We have your campaign',
    body: '“ABC Summer” is with operations.',
    href: '/campaigns/cmp_1',
    readAt: '2026-10-01T06:00:00.000Z',
    createdAt: '2026-09-30T08:00:00.000Z',
  },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    navigate.mockReset();
    get.mockResolvedValue({ items: ITEMS, unreadCount: 1 });
    post.mockResolvedValue({ unreadCount: 0 });
  });

  it('lists the inbox and clears the badge when the page opens', async () => {
    renderPage();

    expect(await screen.findByText('Campaign approved')).toBeInTheDocument();
    expect(screen.getByText('We have your campaign')).toBeInTheDocument();

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('/v1/notifications/read-all');
    });
  });

  it('opens the campaign the row is about', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Campaign approved/ }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/campaigns/cmp_1');
    });
  });

  it('asks for a campaign when the inbox is empty', async () => {
    get.mockResolvedValue({ items: [], unreadCount: 0 });

    renderPage();

    expect(await screen.findByText('Nothing yet')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});
