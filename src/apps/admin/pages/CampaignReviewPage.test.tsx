import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/shared/api/client';
import { asMoney, type AdminCampaign, type CampaignStatus } from '@/shared/types/domain';
import CampaignReviewPage from './CampaignReviewPage';

vi.mock('@/shared/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/shared/layout/Page', () => ({
  Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);

function campaign(overrides: Partial<AdminCampaign> = {}): AdminCampaign {
  return {
    id: 'cmp_1',
    name: 'Monsoon Launch',
    brandName: 'Zephyr',
    status: 'ACTIVE',
    city: 'Bengaluru',
    vehicleType: 'CAB',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    budget: asMoney('200000.00'),
    spent: asMoney('0.00'),
    remaining: asMoney('200000.00'),
    vehicleCount: 12,
    verifiedKm: 0,
    impressions: 0,
    advertiser: { id: 'adv_1', legalName: 'Zephyr Beverages Pvt Ltd', brandName: 'Zephyr' },
    createdBy: 'usr_1',
    submittedAt: '2026-08-20T06:00:00.000Z',
    ...overrides,
  };
}

/** The page runs one query per stage; answer each by the status it asked for. */
function respondWith(byStatus: Partial<Record<CampaignStatus, AdminCampaign[]>>) {
  get.mockImplementation((_path: string, options?: { query?: Record<string, unknown> }) => {
    const status = options?.query?.status as CampaignStatus | undefined;
    const items = (status && byStatus[status]) ?? [];
    return Promise.resolve({ items, page: 1, pageSize: 20, total: items.length });
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CampaignReviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The row in the queue whose campaign is named `name`. */
async function rowFor(name: string) {
  return (await screen.findByText(name)).closest('tr') as HTMLElement;
}

/**
 * Radix opens a dropdown on pointerdown, which jsdom does not synthesise from
 * a click. The keyboard path is the one it does understand, and is a route a
 * real operator has too.
 */
async function openMenu(name: string) {
  const trigger = within(await rowFor(name)).getByRole('button', { name: `Actions for ${name}` });
  fireEvent.keyDown(trigger, { key: 'Enter' });
  return screen.findByRole('menu');
}

async function openAction(name: string, action: string) {
  const menu = await openMenu(name);
  fireEvent.click(within(menu).getByRole('menuitem', { name: action }));
  return screen.findByRole('dialog');
}

/** The number shown on the production step tile headed `label`. */
function countFor(label: string): string | undefined {
  const steps = screen.getByRole('list', { name: 'Production steps' });
  const tile = within(steps).getByText(label).closest('li');
  return tile?.querySelector('.numeric:last-of-type')?.textContent ?? undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  post.mockResolvedValue({});
});

/**
 * AC-34.10. Getting a campaign onto the road had four screens; taking it off
 * again had none. A campaign could be started and never stopped, and its
 * vehicles stayed booked to it for good.
 */
describe('campaigns already on the road', () => {
  it('lists running and paused together, since both are on vehicles', async () => {
    respondWith({
      ACTIVE: [campaign()],
      PAUSED: [campaign({ id: 'cmp_2', name: 'Diwali Push', status: 'PAUSED' })],
    });
    renderPage();

    const running = (await screen.findByRole('table', { name: 'On the road' })) as HTMLElement;
    expect(within(running).getByText('Monsoon Launch')).toBeInTheDocument();
    expect(within(running).getByText('Diwali Push')).toBeInTheDocument();
    expect(within(running).getByText('Paused')).toBeInTheDocument();
  });

  it('offers the one transition available from where the campaign is', async () => {
    respondWith({
      ACTIVE: [campaign()],
      PAUSED: [campaign({ id: 'cmp_2', name: 'Diwali Push', status: 'PAUSED' })],
    });
    renderPage();

    const menu = await openMenu('Monsoon Launch');
    expect(within(menu).getByRole('menuitem', { name: 'Pause' })).toBeInTheDocument();
    // Resuming a campaign that is already running is a conflict on the server;
    // offering it here would be inviting one.
    expect(within(menu).queryByRole('menuitem', { name: 'Resume' })).not.toBeInTheDocument();
  });

  /*
   * The reason is the only account the advertiser gets of why their flight
   * stopped, and it is what goes in the audit line.
   */
  it('will not pause without a reason', async () => {
    respondWith({ ACTIVE: [campaign()] });
    renderPage();

    const dialog = await openAction('Monsoon Launch', 'Pause');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pause campaign' }));

    expect(await within(dialog).findByText(/Give a reason/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('pauses with one', async () => {
    respondWith({ ACTIVE: [campaign()] });
    renderPage();

    const dialog = await openAction('Monsoon Launch', 'Pause');
    fireEvent.change(within(dialog).getByLabelText(/Reason/), {
      target: { value: 'Holding the flight until the new creative lands.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pause campaign' }));

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('/v1/admin/campaigns/cmp_1/pause', {
        reason: 'Holding the flight until the new creative lands.',
      });
    });
  });

  /* Nothing to explain about starting again, so nothing to type. */
  it('resumes without one', async () => {
    respondWith({ PAUSED: [campaign({ status: 'PAUSED' })] });
    renderPage();

    const dialog = await openAction('Monsoon Launch', 'Resume');
    expect(within(dialog).queryByLabelText(/Reason/)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Resume campaign' }));

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('/v1/admin/campaigns/cmp_1/resume', undefined);
    });
  });

  /*
   * Completing and stopping do the same thing to the rows and mean opposite
   * things in a report, so they are two menu items and two endpoints.
   */
  it('keeps finishing and cutting short apart', async () => {
    respondWith({ ACTIVE: [campaign()] });
    renderPage();

    const done = await openAction('Monsoon Launch', 'Complete');
    expect(within(done).getByText(/released/)).toBeInTheDocument();
    fireEvent.click(within(done).getByRole('button', { name: 'Complete campaign' }));
    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('/v1/admin/campaigns/cmp_1/complete', undefined);
    });

    const cut = await openAction('Monsoon Launch', 'Stop early');
    fireEvent.change(within(cut).getByLabelText(/Reason/), {
      target: { value: 'The advertiser has run out of wallet balance.' },
    });
    fireEvent.click(within(cut).getByRole('button', { name: 'Stop campaign' }));
    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('/v1/admin/campaigns/cmp_1/stop', {
        reason: 'The advertiser has run out of wallet balance.',
      });
    });
  });
});

/**
 * The four tiles were fixed labels that read the same whether thirty campaigns
 * were waiting on review or none, which is a diagram rather than a screen.
 */
describe('the production steps', () => {
  it('count what is actually in each stage', async () => {
    respondWith({
      PENDING_APPROVAL: [campaign({ id: 'a', status: 'PENDING_APPROVAL' })],
      ACTIVE: [campaign({ id: 'b' })],
      PAUSED: [campaign({ id: 'c', status: 'PAUSED' })],
    });
    renderPage();

    // Running and paused are one stage: both are campaigns on vehicles.
    await waitFor(() => {
      expect(countFor('On the road')).toBe('2');
    });
    expect(countFor('Review brief')).toBe('1');
    expect(countFor('At printer')).toBe('0');
  });
});
