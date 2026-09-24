import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/shared/api/client';
import CampaignDetailPage from './CampaignDetailPage';

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }));

/** The top bar wants a session and a notification query; neither is under test. */
vi.mock('@/shared/layout/Page', () => ({
  Page: ({ title, children }: { title: string; children: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

/** Permission gating is covered where it is defined, not on every page. */
vi.mock('@/shared/auth/guards', () => ({
  Can: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/shared/maps/LiveFleetMap', () => ({
  LiveFleetMap: () => <div data-testid="map" />,
}));

/**
 * Recharts measures its container, and jsdom reports every container as zero
 * by zero, so the real chart draws nothing to click. The stand-in keeps the
 * one contract the page depends on: a day can be selected, and the day handed
 * back is the civil date rather than the shortened label.
 */
vi.mock('@/shared/ui/charts', () => ({
  KmImpressionsChart: ({
    data,
    onSelectDay,
  }: {
    data: { date: string; label: string }[];
    onSelectDay?: (date: string) => void;
  }) => (
    <div>
      {data.map((point) => (
        <button key={point.date} type="button" onClick={() => onSelectDay?.(point.date)}>
          {point.label}
        </button>
      ))}
    </div>
  ),
}));

const get = vi.mocked(api.get);

const CAMPAIGN = {
  id: 'cmp_1',
  name: 'ABC Summer',
  brandName: 'ABC Foods',
  status: 'ACTIVE',
  city: 'Bengaluru',
  vehicleType: 'AUTO',
  startDate: '2026-09-01',
  endDate: '2026-10-31',
  budget: '500000.00',
  spent: '186400.00',
  remaining: '313600.00',
  vehicleCount: 12,
  verifiedKm: 4820.4,
  impressions: 0,
};

const IMPRESSIONS = {
  campaignId: 'cmp_1',
  campaignName: 'ABC Summer',
  modelVersion: '1.0.0',
  verifiedKm: 4820.4,
  impressions: 612_400,
  charge: '186400.00',
  cpm: '304.37',
  byZone: [
    { zone: 'prime', verifiedKm: 1200.5, impressions: 402_100, charge: '6002.50' },
    // Nothing for `network`: the campaign has never driven there.
    { zone: 'secondary', verifiedKm: 3619.9, impressions: 210_300, charge: '7239.80' },
  ],
  byDay: [
    { date: '2026-09-20', verifiedKm: 210.2, impressions: 28_400 },
    { date: '2026-09-21', verifiedKm: 244.8, impressions: 33_100 },
  ],
  baselineMix: { cellHour: 0.62, cell: 0.23, zoneDefault: 0.15 },
};

const DAY = {
  campaignId: 'cmp_1',
  date: '2026-09-21',
  modelVersion: '1.0.0',
  verifiedKm: 244.8,
  impressions: 33_100,
  charge: '9130.00',
  cpm: '275.83',
  byZone: [],
  byDay: [],
  baselineMix: { cellHour: 0.7, cell: 0.2, zoneDefault: 0.1 },
  working: {
    jamDensity: 150,
    occupantsPerVehicle: 1.5,
    lineOfSightShare: 0.3,
    wrapQuality: 0.85,
    zones: [
      { zone: 'prime', lanes: 4, pedestrianDensity: 120 },
      { zone: 'secondary', lanes: 3, pedestrianDensity: 50 },
    ],
    medianObservedKmh: 12.4,
    medianBaselineKmh: 34,
  },
};

const DASHBOARD = {
  topVehicles: [
    {
      vehicleNumber: 'KA05AB9012',
      driverName: 'Ramesh Babu',
      area: 'Koramangala',
      km: 812.3,
      zoneKm: { prime: 300, secondary: 512.3, network: 0 },
      impressions: 104_200,
      spend: '4100.00',
      state: 'RUNNING',
    },
  ],
};

/** Everything the page asks for, keyed the way the server routes it. */
function respond(overrides: Record<string, unknown> = {}) {
  get.mockImplementation((path: string) => {
    const table: Record<string, unknown> = {
      '/v1/campaigns/cmp_1': CAMPAIGN,
      '/v1/campaigns/cmp_1/impressions': IMPRESSIONS,
      '/v1/campaigns/cmp_1/impressions/days/2026-09-21': DAY,
      '/v1/dashboard/advertiser': DASHBOARD,
      '/v1/vehicles/live-positions': { items: [], updatedAt: '2026-09-21T10:00:00+05:30' },
      ...overrides,
    };
    if (!(path in table)) return Promise.reject(new Error(`unexpected path ${path}`));
    return Promise.resolve(table[path]);
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/campaigns/cmp_1']}>
        <Routes>
          <Route path="/campaigns/:campaignId" element={<CampaignDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** A headline figure. StatCard renders the value as the label's next sibling. */
function figureValue(label: string): string {
  return screen.getByText(label).nextElementSibling?.textContent ?? '';
}

beforeEach(() => {
  get.mockReset();
  respond();
});

describe('campaign detail', () => {
  it('reports the modelled audience, not the campaign record, which nothing writes to', async () => {
    renderPage();
    await screen.findByText('612K');

    // The campaigns list reads `campaign.impressions`, which the API hard-codes
    // to zero. This page must not inherit that number.
    expect(CAMPAIGN.impressions).toBe(0);
    expect(figureValue('Modelled Impressions')).toBe('612K');
  });

  /*
   * A campaign that has reached six hundred thousand people should never
   * render "0 impressions", not even for the frame before the query lands.
   * Absent is honest; zero is a claim.
   */
  it('leaves the audience figures blank until they arrive, never zero', async () => {
    respond({ '/v1/campaigns/cmp_1/impressions': new Promise(() => undefined) });
    renderPage();
    await screen.findByText('Verified Distance');

    expect(figureValue('Modelled Impressions')).toBe('—');
    expect(figureValue('Cost per 1,000 Impressions')).toBe('—');
  });

  it('says how much of the audience is measured rather than assumed', async () => {
    renderPage();

    // 62% this road and hour, plus 23% this road across the week.
    expect(await screen.findByText('85.0%')).toBeInTheDocument();
  });

  it('opens a day by its civil date, not by the label the chart shows', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '09/21' }));

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith('/v1/campaigns/cmp_1/impressions/days/2026-09-21');
    });
  });

  /*
   * Both figures are medians of their own distributions, so dividing one by
   * the other would not be the median congestion. If someone ever replaces
   * this pair with a single percentage, this fails.
   */
  it('shows the two speeds the congestion was read from', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '09/21' }));

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('12.4 km/h')).toBeInTheDocument();
    expect(within(dialog).getByText('34.0 km/h')).toBeInTheDocument();
  });

  it('publishes every coefficient the model applied', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '09/21' }));

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Jam density')).toBeInTheDocument();
    expect(within(dialog).getByText('150 vehicles per lane-km')).toBeInTheDocument();
    expect(within(dialog).getByText('Line of sight')).toBeInTheDocument();
    expect(within(dialog).getByText('30.0%')).toBeInTheDocument();
    expect(within(dialog).getByText('85.0%')).toBeInTheDocument();
    expect(within(dialog).getByText('1.50')).toBeInTheDocument();
  });

  it('says a day could not be read rather than implying free-flowing roads', async () => {
    respond({
      '/v1/campaigns/cmp_1/impressions/days/2026-09-21': {
        ...DAY,
        working: { ...DAY.working, medianObservedKmh: null, medianBaselineKmh: null },
      },
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '09/21' }));

    expect(await screen.findByText(/No speeds were recorded for this day/)).toBeInTheDocument();
  });

  /*
   * The API omits a zone the campaign never drove in. The split bar needs all
   * three or it silently rescales, showing a two-zone campaign as though the
   * missing zone were not part of the rate card at all.
   */
  it('keeps a zone in the split even when nothing was driven there', async () => {
    renderPage();

    const bar = await screen.findByRole('img', { name: /^Zone mix:/ });
    expect(bar).toHaveAccessibleName(/Network 0\.0%/);
  });

  it('lists the vehicles and what each was charged for', async () => {
    renderPage();

    const row = (await screen.findByText('KA 05 AB 9012')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Ramesh Babu')).toBeInTheDocument();
    expect(within(row).getByText('₹4,100.00')).toBeInTheDocument();
  });
});
