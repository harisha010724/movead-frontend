import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/shared/api/client';
import { TooltipProvider } from '@/shared/ui';
import CampaignDetailPage from './CampaignDetailPage';
import CampaignTripsPage from './CampaignTripsPage';

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }));

/** The top bar wants a session and a notification query; neither is under test. */
vi.mock('@/shared/layout/Page', () => ({
  Page: ({
    title,
    backTo,
    children,
  }: {
    title: string;
    backTo?: string;
    children: ReactNode;
  }) => (
    <div>
      {backTo ? (
        <Link to={backTo} aria-label="Back to campaigns">
          Back
        </Link>
      ) : null}
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

vi.mock('@/shared/maps/nameJourneyStops', () => ({
  nameJourneyStops: (stops: { name: string }[]) => Promise.resolve(stops),
}));

vi.mock('@/shared/maps/loadGoogleMaps', () => ({
  loadGoogleMaps: () => Promise.resolve(),
}));

vi.mock('@/shared/maps/reverseGeocode', () => ({
  reverseGeocode: () =>
    Promise.resolve({ status: 'named', label: 'Koramangala, Bengaluru', placeId: 'p1' }),
}));

vi.mock('@/shared/maps/nearbyPlaces', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/maps/nearbyPlaces')>();
  return {
    ...actual,
    nearbyPlacesWithin: () =>
      Promise.resolve([
        {
          name: 'Forum Mall',
          kind: 'Mall',
          lat: 12.9702,
          lng: 77.5902,
          metres: 40,
        },
      ]),
  };
});

vi.mock('@/shared/maps/ParkedSpotMap', () => ({
  ParkedSpotMap: () => <div data-testid="parked-spot-map" />,
}));

vi.mock('@/shared/maps/TripRouteMap', () => ({
  TripRouteMap: ({
    legs,
    colourBy,
    places,
    stops,
    parked,
  }: {
    legs: { zone: string }[];
    colourBy?: string;
    places?: { name: string }[];
    stops?: { name: string }[];
    parked?: { name: string } | null;
  }) => (
    <div data-testid="trip-route-map">
      {colourBy ?? 'zone'}:{legs[0]?.zone ?? 'empty'}
      {(stops ?? places ?? []).map((place) => place.name).join(',')}
      {parked ? `parked:${parked.name}` : ''}
    </div>
  ),
}));

/**
 * Radix's portal listbox needs scrollIntoView, which jsdom does not implement.
 * The stand-in keeps the contract the page depends on: a named control that
 * can change the selected driver.
 */
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

const NEW_TRIP = {
  id: 'trip-new',
  vehicleRegistration: 'KA05AB9012',
  startedAt: '2026-09-28T15:10:00+05:30',
  endedAt: '2026-09-28T16:02:00+05:30',
  verifiedKm: 12.4,
  charge: '42.00',
  status: 'verified',
  idleSecondsBefore: 18 * 60,
  impressions: 1840,
};

const OLD_TRIP = {
  id: 'trip-old',
  vehicleRegistration: 'KA01CD4471',
  startedAt: '2026-09-28T07:10:00+05:30',
  endedAt: '2026-09-28T08:05:00+05:30',
  verifiedKm: 8.1,
  charge: '21.50',
  status: 'verified',
  idleSecondsBefore: null,
  impressions: 980,
};

const DRIVERS = [
  { id: 'drv_ramesh', name: 'Ramesh Babu' },
  { id: 'drv_suresh', name: 'Suresh Yadav' },
];

const ROSTER = [
  {
    id: 'drv_ramesh',
    name: 'Ramesh Babu',
    vehicleRegistration: 'KA05AB9012',
    area: 'Koramangala',
    verifiedKm: 812.3,
    state: 'RUNNING' as const,
  },
  {
    id: 'drv_suresh',
    name: 'Suresh Yadav',
    vehicleRegistration: 'KA01CD4471',
    area: 'Indiranagar',
    verifiedKm: 410.1,
    state: 'IDLE' as const,
  },
];

const OLDER_TRIP = {
  id: 'trip-older',
  vehicleRegistration: 'KA03EF2288',
  startedAt: '2026-09-27T18:10:00+05:30',
  endedAt: '2026-09-27T19:00:00+05:30',
  verifiedKm: 6.2,
  charge: '18.00',
  status: 'verified',
  idleSecondsBefore: null,
  impressions: 720,
};

const STATUS_COUNTS = { all: 2, verified: 2, pending_review: 0, rejected: 0 };

function tripsPage(
  trips: Array<(typeof NEW_TRIP) | (typeof OLD_TRIP) | (typeof OLDER_TRIP)>,
  extra: Record<string, unknown> = {},
) {
  return {
    drivers: DRIVERS,
    trips,
    total: trips.length,
    limit: 25,
    offset: 0,
    statusCounts: STATUS_COUNTS,
    nextBefore: null,
    ...extra,
  };
}

const NEW_DETAIL = {
  id: 'trip-new',
  vehicleRegistration: 'KA05AB9012',
  startedAt: NEW_TRIP.startedAt,
  endedAt: NEW_TRIP.endedAt,
  distanceKm: 12.4,
  advertiserCharge: '42.00',
  status: 'verified',
  legs: [
    {
      zone: 'prime',
      state: 'BILLABLE',
      flagReason: null,
      startedAt: NEW_TRIP.startedAt,
      endedAt: NEW_TRIP.endedAt,
      distanceKm: 12.4,
      advertiserRate: '5.0000',
      advertiserCharge: '42.00',
      segments: 40,
      visibility: 'medium',
      path: [
        { lat: 12.97, lng: 77.59 },
        { lat: 12.98, lng: 77.6 },
      ],
    },
  ],
  places: [
    {
      kind: 'mall' as const,
      name: 'Forum Mall',
      lat: 12.975,
      lng: 77.595,
      km: 0.4,
      seconds: 90,
      visits: 2,
      source: 'osm' as const,
    },
  ],
  parked: {
    seconds: 18 * 60,
    lat: 12.97,
    lng: 77.59,
  },
};

const OLD_DETAIL = {
  ...NEW_DETAIL,
  id: 'trip-old',
  vehicleRegistration: 'KA01CD4471',
  startedAt: OLD_TRIP.startedAt,
  endedAt: OLD_TRIP.endedAt,
  distanceKm: 8.1,
  advertiserCharge: '21.50',
  legs: [
    {
      ...NEW_DETAIL.legs[0],
      zone: 'secondary',
      distanceKm: 8.1,
      advertiserCharge: '21.50',
      startedAt: OLD_TRIP.startedAt,
      endedAt: OLD_TRIP.endedAt,
    },
  ],
  parked: null,
};

const VISIBILITY = {
  campaignId: 'cmp_1',
  version: 'v1.0.0',
  highKm: 180.2,
  mediumKm: 200.1,
  lowKm: 64.1,
  classifiedKm: 444.4,
  highShare: 0.4055,
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

const DASHBOARD = {
  comparison: {
    impressions: 0,
    verifiedKm: -0.12,
    spend: 0,
    activeVehicles: 0,
    costPerThousandImpressions: 0,
  },
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
  get.mockImplementation((
    path: string,
    options?: {
      query?: {
        driverId?: string;
        q?: string;
        status?: string;
        limit?: number;
        offset?: number;
      };
    },
  ) => {
    if (path === '/v1/campaigns/cmp_1/trips') {
      if (path in overrides) return Promise.resolve(overrides[path]);
      const query = options?.query ?? {};
      const offset = Number(query.offset ?? 0);
      const needle = String(query.q ?? '').trim().toLowerCase().replace(/\s+/g, '');
      let rows =
        query.driverId === 'drv_suresh' ? [OLD_TRIP] : [NEW_TRIP, OLD_TRIP];
      if (needle) {
        rows = rows.filter((trip) => trip.vehicleRegistration.toLowerCase().includes(needle));
      }
      if (query.status && query.status !== 'all') {
        rows = rows.filter((trip) => trip.status === query.status);
      }
      const counts = {
        all: rows.length,
        verified: rows.filter((trip) => trip.status === 'verified').length,
        pending_review: rows.filter((trip) => trip.status === 'pending_review').length,
        rejected: rows.filter((trip) => trip.status === 'rejected').length,
      };
      if (offset >= 25) {
        return Promise.resolve(
          tripsPage([OLDER_TRIP], { total: 26, offset: 25, statusCounts: { ...STATUS_COUNTS, all: 26 } }),
        );
      }
      return Promise.resolve(
        tripsPage(rows, {
          total: query.driverId === 'drv_ramesh' && !needle && !query.status ? 26 : rows.length,
          offset,
          limit: Number(query.limit ?? 25),
          statusCounts: query.driverId === 'drv_ramesh' && !needle && !query.status
            ? { ...STATUS_COUNTS, all: 26, verified: 26 }
            : counts,
        }),
      );
    }

    if (path === '/v1/campaigns/cmp_1/drivers') {
      if (path in overrides) return Promise.resolve(overrides[path]);
      const needle = String(options?.query?.q ?? '').trim().toLowerCase();
      const plateNeedle = needle.replace(/\s+/g, '');
      const matched = ROSTER.filter((driver) => {
        if (!needle) return true;
        return (
          driver.name.toLowerCase().includes(needle) ||
          driver.vehicleRegistration.toLowerCase().includes(plateNeedle)
        );
      });
      const limit = Number(options?.query?.limit ?? 5);
      const offset = Number(options?.query?.offset ?? 0);
      return Promise.resolve({
        drivers: matched.slice(offset, offset + limit),
        total: matched.length,
        limit,
        offset,
      });
    }

    const table: Record<string, unknown> = {
      '/v1/campaigns/cmp_1': CAMPAIGN,
      '/v1/campaigns/cmp_1/trips/trip-new': NEW_DETAIL,
      '/v1/campaigns/cmp_1/trips/trip-old': OLD_DETAIL,
      '/v1/campaigns/cmp_1/trips/trip-older': {
        ...OLD_DETAIL,
        id: 'trip-older',
        vehicleRegistration: 'KA03EF2288',
        startedAt: OLDER_TRIP.startedAt,
        endedAt: OLDER_TRIP.endedAt,
        distanceKm: 6.2,
        advertiserCharge: '18.00',
      },
      '/v1/campaigns/cmp_1/visibility': VISIBILITY,
      '/v1/campaigns/cmp_1/branding-proofs': { items: [] },
      '/v1/dashboard/advertiser': DASHBOARD,
      '/v1/vehicles/live-positions': { items: [], updatedAt: '2026-09-21T10:00:00+05:30' },
      ...overrides,
    };
    if (!(path in table)) return Promise.reject(new Error(`unexpected path ${path}`));
    return Promise.resolve(table[path]);
  });
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/campaigns/:campaignId" element={<CampaignDetailPage />} />
            <Route path="/campaigns/:campaignId/trips/:driverId" element={<CampaignTripsPage />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

function renderPage() {
  renderAt('/campaigns/cmp_1');
}

function renderTrips(driverId = 'drv_ramesh') {
  renderAt(`/campaigns/cmp_1/trips/${driverId}`);
}

beforeEach(() => {
  get.mockReset();
  respond();
});

describe('campaign detail', () => {
  it('shows how much billed distance was readable while moving', async () => {
    renderPage();
    await screen.findByText('Verified Distance');

    expect(await screen.findByText('Readable while moving')).toBeInTheDocument();
    expect(screen.getByText('40.6%')).toBeInTheDocument();
    expect(screen.getByText(/180\.2 km of billed km under 15 km\/h/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Readable while moving/ })).toHaveAttribute(
      'href',
      '/analytics',
    );
  });

  it('links back to the campaign list', async () => {
    renderPage();
    await screen.findByText('ABC Summer');

    expect(screen.getByRole('link', { name: 'Back to campaigns' })).toHaveAttribute(
      'href',
      '/campaigns',
    );
  });

  it('lists every driver and links their recorded trips', async () => {
    renderPage();

    const table = await screen.findByRole('table', { name: 'Drivers on this campaign' });
    expect(within(table).getByText('Ramesh Babu')).toBeInTheDocument();
    expect(within(table).getByText('Suresh Yadav')).toBeInTheDocument();
    expect(within(table).getByText(/KA 05 AB 9012/)).toBeInTheDocument();
    expect(within(table).getByText('Koramangala')).toBeInTheDocument();
    expect(screen.queryByTestId('trip-route-map')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Ramesh Babu ·/ })).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Recorded trips for Ramesh Babu' })).toHaveAttribute(
      'href',
      '/campaigns/cmp_1/trips/drv_ramesh',
    );
    expect(screen.getByRole('link', { name: 'Recorded trips for Suresh Yadav' })).toHaveAttribute(
      'href',
      '/campaigns/cmp_1/trips/drv_suresh',
    );
    expect(screen.getByText(/Showing 1–2 of 2 drivers/)).toBeInTheDocument();
  });

  it('shows wrap photos the driver sent, without an approval step', async () => {
    respond({
      '/v1/campaigns/cmp_1/branding-proofs': {
        items: [
          {
            id: 'prf_1',
            assignmentId: 'asg_1',
            campaignId: 'cmp_1',
            campaignName: 'ABC Summer',
            registrationNumber: 'KA01AB1234',
            driverName: 'Ramesh Babu',
            vehicleCategory: 'CAB',
            status: 'SUBMITTED',
            dueAt: '2026-10-08T10:00:00.000Z',
            requestedAt: '2026-10-07T10:00:00.000Z',
            submittedAt: '2026-10-07T11:00:00.000Z',
            reviewedAt: null,
            rejectionReason: null,
            photoCount: 1,
            required: ['FRONT'],
            uploaded: ['FRONT'],
            photos: [
              {
                id: 'pho_1',
                angle: 'FRONT',
                fileName: 'front.png',
                lat: 12.9716,
                lon: 77.5946,
                capturedAt: '2026-10-07T10:55:00.000Z',
                uploadedAt: '2026-10-07T10:55:10.000Z',
              },
            ],
          },
        ],
      },
    });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Wrap photos' })).toBeInTheDocument();
    expect(await screen.findByText(/KA 01 AB 1234/)).toBeInTheDocument();
    expect(screen.getByText('Front')).toBeInTheDocument();
    expect(screen.getByAltText(/Front of KA01AB1234/)).toHaveAttribute(
      'src',
      expect.stringContaining('/v1/campaigns/cmp_1/branding-proof-photos/pho_1'),
    );
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
  });

  it('searches the roster by driver name or vehicle number', async () => {
    renderPage();
    await screen.findByRole('table', { name: 'Drivers on this campaign' });

    fireEvent.change(screen.getByLabelText('Search drivers'), { target: { value: 'KA 01' } });

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith('/v1/campaigns/cmp_1/drivers', {
        query: { q: 'KA 01', limit: 5, offset: 0 },
      });
    });

    expect(await screen.findByText('Suresh Yadav')).toBeInTheDocument();
    expect(screen.queryByText('Ramesh Babu')).not.toBeInTheDocument();
  });

  it('sketches the trip cards and map while recorded trips load', async () => {
    respond({ '/v1/campaigns/cmp_1/trips': new Promise(() => undefined) });
    renderTrips();

    expect(await screen.findByLabelText('Loading recorded trips')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recorded Trips' })).toBeInTheDocument();
    expect(screen.getByText('Newest first. Select a trip to replay it on the map.')).toBeInTheDocument();
    expect(screen.getByText('Colour by zone')).toBeInTheDocument();
    expect(screen.getByText('Prime')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /KA 05 AB 9012/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('trip-route-map')).not.toBeInTheDocument();
  });

  it('shows average speed on each recorded trip', async () => {
    renderTrips();
    await screen.findByRole('button', { name: /KA 05 AB 9012/ });

    expect(screen.getByText('14.3 km/h')).toBeInTheDocument();
    expect(screen.getByText('8.8 km/h')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Avg Speed')).toHaveLength(2);
    expect(screen.getByText('1,840')).toBeInTheDocument();
    expect(screen.getByText('980')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Modelled impressions')).toHaveLength(2);
  });

  it('labels the trip route zones and filters recorded trips', async () => {
    renderTrips();
    await screen.findByRole('button', { name: /KA 05 AB 9012/ });

    expect(screen.getAllByText('Prime').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Secondary').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Network').length).toBeGreaterThan(0);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Filter trips' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: /In Review/ }));
    await waitFor(() => {
      expect(get).toHaveBeenCalledWith('/v1/campaigns/cmp_1/trips', {
        query: { driverId: 'drv_ramesh', status: 'pending_review', limit: 25, offset: 0 },
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /KA 05 AB 9012/ })).not.toBeInTheDocument();
    });

    fireEvent.keyDown(screen.getByRole('button', { name: 'Filter trips' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: /^All/ }));
    fireEvent.change(screen.getByLabelText('Search trips'), { target: { value: 'KA 01' } });

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith('/v1/campaigns/cmp_1/trips', {
        query: { driverId: 'drv_ramesh', q: 'KA 01', limit: 25, offset: 0 },
      });
    });
    expect(await screen.findByRole('button', { name: /KA 01 CD 4471/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /KA 05 AB 9012/ })).not.toBeInTheDocument();
  });

  it('sketches each roster row while the drivers load', async () => {
    respond({ '/v1/campaigns/cmp_1/drivers': new Promise(() => undefined) });
    renderPage();
    await screen.findByText('Verified Distance');

    expect(await screen.findByLabelText('Loading drivers')).toBeInTheDocument();
    expect(screen.getByLabelText('Search drivers')).toBeInTheDocument();
    expect(screen.getByText('Driver')).toBeInTheDocument();
    expect(screen.getByText('Vehicle')).toBeInTheDocument();
    expect(screen.getByText('Area')).toBeInTheDocument();
    expect(screen.getByText('Verified KM')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Drivers on this campaign' })).not.toBeInTheDocument();
  });

  it('does not wait on the dashboard to list the drivers', async () => {
    respond({ '/v1/dashboard/advertiser': new Promise(() => undefined) });
    renderPage();
    await screen.findByText('Verified Distance');

    expect(await screen.findByRole('table', { name: 'Drivers on this campaign' })).toBeInTheDocument();
    expect(screen.getByText('Ramesh Babu')).toBeInTheDocument();
  });

  it('selects the most recent trip and draws it on the map', async () => {
    renderTrips();

    const recent = await screen.findByRole('button', { name: /KA 05 AB 9012/ });
    expect(recent).toHaveAttribute('aria-pressed', 'true');

    expect(await screen.findByTestId('trip-route-map')).toHaveTextContent('zone:prime');
    expect(screen.getAllByRole('button', { name: /Parked 18 min/ }).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(get).toHaveBeenCalledWith('/v1/campaigns/cmp_1/trips/trip-new');
    });
    expect((await screen.findAllByText(/Koramangala/)).length).toBeGreaterThan(0);
    expect(screen.getByTestId('trip-route-map')).toHaveTextContent('parked:Koramangala');
  });

  it('opens a parked map popup with places within 100 m', async () => {
    renderTrips();
    await screen.findByTestId('trip-route-map');

    fireEvent.click(screen.getAllByRole('button', { name: /Parked 18 min\. Show where/ })[0]!);

    expect(await screen.findByRole('dialog', { name: /Parked 18 min/ })).toBeInTheDocument();
    expect(screen.getByTestId('parked-spot-map')).toBeInTheDocument();
    const places = await screen.findByRole('list', { name: 'Places within 100 metres' });
    expect(places).toHaveTextContent('Forum Mall');
    expect(screen.getByText('40 m')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Forum Mall/ }));
    expect(screen.getByRole('button', { name: /Forum Mall/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('redraws the map when another trip is selected', async () => {
    renderTrips();
    await screen.findByTestId('trip-route-map');

    fireEvent.click(screen.getByRole('button', { name: /KA 01 CD 4471/ }));

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith('/v1/campaigns/cmp_1/trips/trip-old');
    });
    expect(await screen.findByTestId('trip-route-map')).toHaveTextContent('zone:secondary');
    expect(screen.getByRole('button', { name: /KA 01 CD 4471/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('opens only that driver\'s trips from the roster', async () => {
    renderTrips('drv_suresh');
    await screen.findByTestId('trip-route-map');

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith('/v1/campaigns/cmp_1/trips', {
        query: { driverId: 'drv_suresh', limit: 25, offset: 0 },
      });
    });
    expect(screen.queryByLabelText('Driver')).not.toBeInTheDocument();

    expect(await screen.findByRole('button', { name: /KA 01 CD 4471/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('button', { name: /KA 05 AB 9012/ })).not.toBeInTheDocument();
    expect(await screen.findByTestId('trip-route-map')).toHaveTextContent('zone:secondary');
  });

  it('fetches the next trips when another page is opened', async () => {
    renderTrips();
    await screen.findByRole('button', { name: /KA 05 AB 9012/ });

    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith('/v1/campaigns/cmp_1/trips', {
        query: { driverId: 'drv_ramesh', limit: 25, offset: 25 },
      });
    });

    expect(await screen.findByRole('button', { name: /KA 03 EF 2288/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /KA 05 AB 9012/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 26–26 of 26 trips/)).toBeInTheDocument();
  });

  it('colours the trip by visibility when asked', async () => {
    renderTrips();
    expect(await screen.findByTestId('trip-route-map')).toHaveTextContent('zone:prime');

    fireEvent.click(screen.getByRole('button', { name: 'Colour by visibility' }));

    expect(screen.getByRole('button', { name: 'Colour by visibility' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('High <15 km/h')).toBeInTheDocument();
    expect(await screen.findByTestId('trip-route-map')).toHaveTextContent('visibility:prime');
    expect(screen.getByTestId('trip-route-map')).toHaveTextContent('Forum Mall');
    expect(screen.getByRole('list', { name: 'Trip journey' })).toHaveTextContent('Forum Mall');
    expect(screen.getByRole('list', { name: 'Trip waypoints' })).toHaveTextContent('Forum Mall');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse trip places' }));
    expect(screen.queryByRole('list', { name: 'Trip waypoints' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand trip places' }));
    expect(screen.getByRole('list', { name: 'Trip waypoints' })).toHaveTextContent('Forum Mall');

    expect(screen.getByRole('button', { name: 'Satellite' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Hide recorded trips' }));
    expect(screen.getByRole('button', { name: 'Show recorded trips' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show recorded trips' }));
    expect(screen.getByRole('heading', { name: 'Recorded Trips' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide trip journey' }));
    expect(screen.queryByRole('list', { name: 'Trip journey' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show trip journey' }));
    expect(screen.getByRole('list', { name: 'Trip journey' })).toHaveTextContent('Forum Mall');
  });
});
