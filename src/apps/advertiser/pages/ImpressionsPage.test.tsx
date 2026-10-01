import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/shared/api/client';
import ImpressionsPage from './ImpressionsPage';

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }));

vi.mock('@/shared/layout/Page', () => ({
  Page: ({
    title,
    controls,
    children,
  }: {
    title: string;
    controls?: ReactNode;
    children: ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {controls}
      {children}
    </div>
  ),
}));

vi.mock('@/shared/ui/form', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui/form')>();
  return {
    ...actual,
    InlineSelect: ({
      label,
      value,
      onValueChange,
      options,
    }: {
      label: string;
      value: string;
      onValueChange: (value: string) => void;
      options: { value: string; label: string }[];
    }) => (
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  };
});

vi.mock('@/shared/ui/charts', () => ({
  KmImpressionsChart: ({
    data,
    formatImpressions,
    onSelectDay,
  }: {
    data: { date: string; label: string; verifiedKm: number; impressions: number }[];
    formatImpressions: (value: number) => string;
    onSelectDay?: (date: string) => void;
  }) => (
    <div data-testid="km-impressions-chart">
      {data.map((point) => (
        <button key={point.date} type="button" onClick={() => onSelectDay?.(point.date)}>
          {point.label}: {formatImpressions(point.impressions)}
        </button>
      ))}
    </div>
  ),
}));

const get = vi.mocked(api.get);

const CAMPAIGNS = {
  items: [
    {
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
      verifiedKm: 444.4,
      impressions: 0,
    },
    {
      id: 'cmp_2',
      name: 'Winter Push',
      brandName: 'ABC Foods',
      status: 'ACTIVE',
      city: 'Bengaluru',
      vehicleType: 'CAB',
      startDate: '2026-09-01',
      endDate: '2026-10-31',
      budget: '100000.00',
      spent: '0.00',
      remaining: '100000.00',
      vehicleCount: 0,
      verifiedKm: 0,
      impressions: 0,
    },
  ],
  page: 1,
  pageSize: 20,
  total: 2,
};

const REPORT = {
  campaignId: 'cmp_1',
  campaignName: 'ABC Summer',
  modelVersion: 'v1.0.0',
  verifiedKm: 444.4,
  impressions: 104_200,
  charge: '186400.00',
  cpm: '1788.87',
  byZone: [
    { zone: 'prime' as const, verifiedKm: 180.2, impressions: 52_100, charge: '90100.00' },
    { zone: 'secondary' as const, verifiedKm: 200.1, impressions: 36_400, charge: '40020.00' },
    { zone: 'network' as const, verifiedKm: 64.1, impressions: 15_700, charge: '56280.00' },
  ],
  byDay: [
    { date: '2026-09-28', verifiedKm: 220.1, impressions: 58_400 },
    { date: '2026-09-29', verifiedKm: 224.3, impressions: 45_800 },
  ],
  baselineMix: { cellHour: 0.62, cell: 0.24, zoneDefault: 0.14 },
};

const EMPTY = {
  campaignId: 'cmp_2',
  campaignName: 'Winter Push',
  modelVersion: 'v1.0.0',
  verifiedKm: 0,
  impressions: 0,
  charge: '0.0000',
  cpm: '0.00',
  byZone: [],
  byDay: [],
  baselineMix: { cellHour: 0, cell: 0, zoneDefault: 0 },
};

const DAY = {
  ...REPORT,
  date: '2026-09-28',
  verifiedKm: 220.1,
  impressions: 58_400,
  byDay: [{ date: '2026-09-28', verifiedKm: 220.1, impressions: 58_400 }],
  working: {
    jamDensity: 150,
    occupantsPerVehicle: 1.5,
    lineOfSightShare: 0.3,
    wrapQuality: 0.85,
    zones: [
      { zone: 'prime' as const, lanes: 4, pedestrianDensity: 120 },
      { zone: 'secondary' as const, lanes: 3, pedestrianDensity: 50 },
      { zone: 'network' as const, lanes: 2, pedestrianDensity: 15 },
    ],
    medianObservedKmh: 18.4,
    medianBaselineKmh: 34.0,
  },
};

function respond() {
  get.mockImplementation((path: string) => {
    if (path === '/v1/campaigns') return Promise.resolve(CAMPAIGNS);
    if (path === '/v1/campaigns/cmp_1/impressions') return Promise.resolve(REPORT);
    if (path === '/v1/campaigns/cmp_2/impressions') return Promise.resolve(EMPTY);
    if (path === '/v1/campaigns/cmp_1/impressions/days/2026-09-28') return Promise.resolve(DAY);
    return Promise.reject(new Error(`unexpected path ${path}`));
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ImpressionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  get.mockReset();
  respond();
});

describe('impressions', () => {
  it('sketches each panel while that campaign’s audience loads', async () => {
    get.mockImplementation((path: string) => {
      if (path === '/v1/campaigns') return Promise.resolve(CAMPAIGNS);
      return new Promise(() => undefined);
    });
    renderPage();

    expect(await screen.findByLabelText('Loading impressions')).toBeInTheDocument();
    expect(screen.getByText('Modelled impressions')).toBeInTheDocument();
    expect(screen.getByText('Verified distance')).toBeInTheDocument();
    expect(screen.getByText('How much of this is measurement')).toBeInTheDocument();
    expect(screen.getByText('By zone')).toBeInTheDocument();
    expect(screen.getByText('Kilometres and the audience they produced')).toBeInTheDocument();
  });

  it('shows the modelled audience beside the kilometres that produced it', async () => {
    renderPage();

    expect(await screen.findByText('104,200')).toBeInTheDocument();
    expect(screen.getByText('Modelled impressions')).toBeInTheDocument();
    expect(screen.getByText('444.4 km')).toBeInTheDocument();
    expect(
      screen.getByText('Model v1.0.0. Not a count of people, and not what you are billed on.'),
    ).toBeInTheDocument();

    expect(screen.getByText('How much of this is measurement')).toBeInTheDocument();
    expect(screen.getByText(/this audience rests on the fleet/)).toBeInTheDocument();
    expect(screen.getByText('86.0%')).toBeInTheDocument();

    expect(screen.getByRole('table', { name: 'Impressions by zone' })).toHaveTextContent('Prime');
    expect(screen.getByRole('table', { name: 'Impressions by zone' })).toHaveTextContent('52,100');

    const chart = screen.getByTestId('km-impressions-chart');
    expect(chart).toHaveTextContent('58,400');
    expect(chart).toHaveTextContent('45,800');
  });

  it('opens a day so the working can be argued with', async () => {
    renderPage();
    await screen.findByTestId('km-impressions-chart');

    fireEvent.click(screen.getByRole('button', { name: /58,400/ }));

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith('/v1/campaigns/cmp_1/impressions/days/2026-09-28');
    });
    expect(await screen.findByText('How busy the roads were')).toBeInTheDocument();
    expect(screen.getByText(/18\.4 km\/h/)).toBeInTheDocument();
    expect(screen.getByText('Jam density')).toBeInTheDocument();
  });

  it('loads another campaign when the picker changes', async () => {
    renderPage();
    await screen.findByTestId('km-impressions-chart');

    fireEvent.change(screen.getByLabelText('Campaign'), { target: { value: 'cmp_2' } });

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith('/v1/campaigns/cmp_2/impressions');
    });
    expect(await screen.findByText('No modelled audience yet')).toBeInTheDocument();
    expect(screen.queryByTestId('km-impressions-chart')).not.toBeInTheDocument();
  });
});
