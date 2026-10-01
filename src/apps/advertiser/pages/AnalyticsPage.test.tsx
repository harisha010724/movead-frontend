import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/shared/api/client';
import AnalyticsPage from './AnalyticsPage';

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
  DonutChart: ({
    data,
    centreValue,
    centreLabel,
  }: {
    data: { label: string; value: number }[];
    centreValue: string;
    centreLabel?: string;
  }) => (
    <div data-testid={centreLabel === 'Peak hours' ? 'daypart-donut' : 'visibility-donut'}>
      <p>{centreLabel}</p>
      <p>{centreValue}</p>
      {data.map((slice) => (
        <p key={slice.label}>
          {slice.label}: {slice.value}
        </p>
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

const MIX = {
  campaignId: 'cmp_1',
  version: 'v1.0.0',
  highKm: 180.2,
  mediumKm: 200.1,
  lowKm: 64.1,
  classifiedKm: 444.4,
  highShare: 0.4055,
  bands: { high: '<15 km/h', medium: '15–35 km/h', low: '>35 km/h' },
  places: [
    {
      kind: 'mall' as const,
      name: 'Forum Mall',
      lat: 12.9342,
      lng: 77.6111,
      km: 12.4,
      seconds: 840,
      visits: 8,
      source: 'osm' as const,
    },
    {
      kind: 'signal' as const,
      name: 'Silk Board',
      lat: 12.9174,
      lng: 77.6231,
      km: 9.1,
      seconds: 620,
      visits: 14,
      source: 'osm' as const,
    },
  ],
  byKind: [
    { kind: 'mall' as const, km: 12.4, count: 1 },
    { kind: 'signal' as const, km: 9.1, count: 1 },
  ],
  when: {
    version: 'v1.0.0',
    morningKm: 90.1,
    middayKm: 80,
    eveningKm: 140.2,
    nightKm: 70,
    readableKm: 380.3,
    peakShare: 0.6058,
    windows: {
      morning: '07:00–11:00 IST',
      midday: '11:00–17:00 IST',
      evening: '17:00–21:00 IST',
      night: '21:00–07:00 IST',
    },
  },
};

const EMPTY_MIX = {
  campaignId: 'cmp_2',
  version: 'v1.0.0',
  highKm: 0,
  mediumKm: 0,
  lowKm: 0,
  classifiedKm: 0,
  highShare: 0,
  bands: { high: '<15 km/h', medium: '15–35 km/h', low: '>35 km/h' },
  places: [],
  byKind: [],
  when: {
    version: 'v1.0.0',
    morningKm: 0,
    middayKm: 0,
    eveningKm: 0,
    nightKm: 0,
    readableKm: 0,
    peakShare: 0,
    windows: {
      morning: '07:00–11:00 IST',
      midday: '11:00–17:00 IST',
      evening: '17:00–21:00 IST',
      night: '21:00–07:00 IST',
    },
  },
};

function respond() {
  get.mockImplementation((path: string) => {
    if (path === '/v1/campaigns') return Promise.resolve(CAMPAIGNS);
    if (path === '/v1/campaigns/cmp_1/visibility') return Promise.resolve(MIX);
    if (path === '/v1/campaigns/cmp_2/visibility') return Promise.resolve(EMPTY_MIX);
    return Promise.reject(new Error(`unexpected path ${path}`));
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AnalyticsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  get.mockReset();
  respond();
});

describe('analytics', () => {
  it('sketches each panel while that campaign’s mix loads', async () => {
    get.mockImplementation((path: string) => {
      if (path === '/v1/campaigns') return Promise.resolve(CAMPAIGNS);
      return new Promise(() => undefined);
    });
    renderPage();

    expect(await screen.findByLabelText('Loading analytics')).toBeInTheDocument();
    expect(screen.getByText('Visibility mix')).toBeInTheDocument();
    expect(screen.getByText('When it was readable')).toBeInTheDocument();
    expect(screen.getByText('Where it was readable')).toBeInTheDocument();
    expect(screen.queryByTestId('visibility-donut')).not.toBeInTheDocument();
  });

  it('draws the visibility mix as a donut with the published cutoffs', async () => {
    renderPage();

    expect(await screen.findByTestId('visibility-donut')).toBeInTheDocument();
    expect(screen.getByText('Visibility mix')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Share of billed kilometres that were slow enough to read while moving. Parked time is omitted. This is not what you are billed on.',
      ),
    ).toBeInTheDocument();

    const donut = await screen.findByTestId('visibility-donut');
    expect(donut).toHaveTextContent('Readable while moving');
    expect(donut).toHaveTextContent('40.6%');
    expect(
      screen.getByText((_, node) => node?.textContent === '180.2 km of 444.4 km billed was under 15 km/h — congested or crawling, not an audience count.'),
    ).toBeInTheDocument();
    expect(donut).toHaveTextContent('High <15 km/h: 180.2');
    expect(donut).toHaveTextContent('Medium 15–35 km/h: 200.1');
    expect(donut).toHaveTextContent('Low >35 km/h: 64.1');

    expect(screen.getByText('Where it was readable')).toBeInTheDocument();
    expect(screen.getByText('Forum Mall')).toBeInTheDocument();
    expect(screen.getByText('Silk Board')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Places by kind' })).toHaveTextContent('Mall / retail');
    expect(screen.getByRole('list', { name: 'Places by kind' })).toHaveTextContent('12.4 km');

    expect(screen.getByText('When it was readable')).toBeInTheDocument();
    const daypart = screen.getByTestId('daypart-donut');
    expect(daypart).toHaveTextContent('Peak hours');
    expect(daypart).toHaveTextContent('60.6%');
    expect(daypart).toHaveTextContent('Morning 07:00–11:00 IST: 90.1');
    expect(daypart).toHaveTextContent('Night 21:00–07:00 IST: 70');
  });

  it('loads another campaign when the picker changes', async () => {
    renderPage();
    await screen.findByTestId('visibility-donut');

    fireEvent.change(screen.getByLabelText('Campaign'), { target: { value: 'cmp_2' } });

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith('/v1/campaigns/cmp_2/visibility');
    });
    expect(await screen.findByText('No classifiable distance yet')).toBeInTheDocument();
    expect(screen.queryByTestId('visibility-donut')).not.toBeInTheDocument();
  });
});
