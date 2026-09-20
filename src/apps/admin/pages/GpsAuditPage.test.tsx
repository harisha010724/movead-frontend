import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/shared/api/client';
import { ApiError } from '@/shared/api/errors';
import type * as CivilDate from '@/shared/lib/civilDate';
import GpsAuditPage from './GpsAuditPage';

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }));

vi.mock('@/shared/layout/Page', () => ({
  Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

/** Pins the calendar to the month the fixtures are written in. */
vi.mock('@/shared/lib/civilDate', async (importOriginal) => ({
  ...(await importOriginal<typeof CivilDate>()),
  platformTodayIso: () => '2026-09-14',
}));

/**
 * The Google Maps SDK does not load in jsdom, so the map reports the shape of
 * what it was asked to draw instead of drawing it. That is the assertable
 * part: whether the page hands it one line or one line per zone is a fact
 * about the page, and the pixels are not.
 */
vi.mock('@/shared/maps/TripRouteMap', () => ({
  TripRouteMap: ({ legs, selectedLeg }: { legs: { zone: string }[]; selectedLeg: number | null }) => (
    <div data-testid="route" data-selected={selectedLeg ?? ''}>
      {legs.map((leg) => leg.zone).join(',')}
    </div>
  ),
}));

const get = vi.mocked(api.get);

const DAY = {
  vehicle: { id: 'veh_1', registrationNumber: 'KA01AB1234' },
  date: '2026-09-14',
  totalVerifiedKm: 24.6,
  totalEarnings: '184.80',
  totalCharge: '308.0000',
  trips: [
    {
      id: 'trip_1',
      sequence: 1,
      startedAt: '2026-09-14T02:10:00.000Z',
      endedAt: '2026-09-14T04:40:00.000Z',
      verifiedKm: 14.2,
      earnings: '120.00',
      status: 'verified',
      zoneBreakdown: [{ zone: 'prime', km: 14.2, earnings: '120.00' }],
    },
    {
      id: 'trip_2',
      sequence: 2,
      startedAt: '2026-09-14T08:10:00.000Z',
      endedAt: '2026-09-14T10:05:00.000Z',
      verifiedKm: 10.4,
      earnings: '64.80',
      status: 'pending_review',
      zoneBreakdown: null,
    },
  ],
};

const TRIP = {
  id: 'trip_1',
  vehicleRegistration: 'KA01AB1234',
  campaignName: 'Zephyr Summer Sale',
  driverName: 'Rahul Kumar',
  startedAt: '2026-09-14T02:10:00.000Z',
  endedAt: '2026-09-14T04:40:00.000Z',
  distanceKm: 14.2,
  advertiserCharge: '52.0000',
  driverEarning: '31.20',
  legs: [
    leg('prime', 'BILLABLE', 4.2, null),
    leg('network', 'BILLABLE', 2.6, null),
    leg('secondary', 'PENDING_REVIEW', 5.1, 'GPS accuracy above 50 m'),
  ],
};

function leg(zone: string, state: string, distanceKm: number, flagReason: string | null) {
  return {
    zone,
    state,
    flagReason,
    startedAt: '2026-09-14T02:10:00.000Z',
    endedAt: '2026-09-14T02:40:00.000Z',
    distanceKm,
    advertiserRate: zone === 'prime' ? '5.0000' : '1.0000',
    driverRate: zone === 'prime' ? '3.0000' : '0.6000',
    advertiserCharge: state === 'BILLABLE' ? '21.0000' : '0.0000',
    driverEarning: state === 'BILLABLE' ? '12.60' : '0.00',
    segments: 38,
    path: [{ lat: 12.9, lng: 77.5 }],
  };
}

function respond() {
  get.mockImplementation((path: string) =>
    Promise.resolve(path.includes('/trips/') ? TRIP : DAY),
  );
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <GpsAuditPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/**
 * Fills the form and submits it, which is the only way the page fetches.
 *
 * The date goes in through the calendar rather than a value assignment,
 * because `DateField` is a popover over a button and not a native input — the
 * form has to be usable the way an operator will actually use it.
 */
function searchFor(plate: string, day = '14') {
  fireEvent.change(screen.getByLabelText(/vehicle/i), { target: { value: plate } });
  fireEvent.click(screen.getByLabelText('Date'));
  fireEvent.click(screen.getByRole('button', { name: day }));
  fireEvent.click(screen.getByRole('button', { name: /find trips/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  respond();
});

describe('the GPS audit screen', () => {
  it('asks for nothing until it has been given a plate and a date', () => {
    renderPage();

    expect(screen.getByText(/search for a vehicle and date/i)).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('sends the plate and the date the way the server expects them', async () => {
    renderPage();
    searchFor('ka 01-ab 1234');

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith('/v1/admin/gps-audit/trips', {
        query: { vehicleNumber: 'ka 01-ab 1234', date: '2026-09-14' },
      });
    });
  });

  /*
   * Both sides of the kilometre on one screen is the point of the endpoint:
   * settling a dispute means comparing what was charged with what was paid.
   */
  it('shows what the advertiser was charged beside what the driver earned', async () => {
    renderPage();
    searchFor('KA01AB1234');

    expect(await screen.findByText('₹308.00')).toBeInTheDocument();
    expect(screen.getByText('₹184.80')).toBeInTheDocument();
    expect(screen.getByText('24.6 km')).toBeInTheDocument();
  });

  it('lists the day’s trips and flags the one still in review', async () => {
    renderPage();
    searchFor('KA01AB1234');

    expect(await screen.findByRole('button', { name: /trip 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /trip 2/i })).toBeInTheDocument();
    expect(screen.getByText('In review')).toBeInTheDocument();
  });

  it('does not fetch a trip until one is chosen', async () => {
    renderPage();
    searchFor('KA01AB1234');

    await screen.findByRole('button', { name: /trip 1/i });
    expect(get).not.toHaveBeenCalledWith(expect.stringContaining('/trips/trip_'));
    expect(screen.getByText(/choose a trip on the right/i)).toBeInTheDocument();
  });

  /*
   * The whole reason the route is drawn per leg rather than per trip: a
   * journey that changes zone changes price, and one line would hide it.
   */
  it('draws the chosen trip as one run per zone', async () => {
    renderPage();
    searchFor('KA01AB1234');

    fireEvent.click(await screen.findByRole('button', { name: /trip 1/i }));

    const route = await screen.findByTestId('route');
    expect(route).toHaveTextContent('prime,network,secondary');
  });

  it('shows the rate and money behind every run', async () => {
    renderPage();
    searchFor('KA01AB1234');
    fireEvent.click(await screen.findByRole('button', { name: /trip 1/i }));

    await screen.findByTestId('route');

    expect(screen.getByRole('table', { name: /priced runs/i })).toBeInTheDocument();
    expect(screen.getByText('₹5.00/km')).toBeInTheDocument();
    expect(screen.getAllByText('38')).toHaveLength(3);
    expect(screen.getByText('Zephyr Summer Sale')).toBeInTheDocument();
  });

  it('marks the held run as held rather than paying it', async () => {
    renderPage();
    searchFor('KA01AB1234');
    fireEvent.click(await screen.findByRole('button', { name: /trip 1/i }));

    await screen.findByTestId('route');

    expect(screen.getByText('Held')).toBeInTheDocument();
    expect(screen.getByTitle('GPS accuracy above 50 m')).toBeInTheDocument();
  });

  /** Clicking a row on the table has to reach the map, or the two disagree. */
  it('links a run in the table to the same run on the map', async () => {
    renderPage();
    searchFor('KA01AB1234');
    fireEvent.click(await screen.findByRole('button', { name: /trip 1/i }));
    await screen.findByTestId('route');

    const zones = screen.getAllByRole('button', { pressed: false });
    fireEvent.click(zones.find((b) => b.textContent === 'Network') as HTMLElement);

    expect(screen.getByTestId('route')).toHaveAttribute('data-selected', '1');
  });

  /*
   * A new search must not leave the previous trip on screen. The plate is the
   * one thing an operator is certain of, and a route belonging to a different
   * vehicle beside it is the worst possible answer.
   */
  it('clears the open trip when a different vehicle is searched', async () => {
    renderPage();
    searchFor('KA01AB1234');
    fireEvent.click(await screen.findByRole('button', { name: /trip 1/i }));
    await screen.findByTestId('route');

    searchFor('KA05MN9012');

    expect(await screen.findByText(/choose a trip on the right/i)).toBeInTheDocument();
    expect(screen.queryByTestId('route')).not.toBeInTheDocument();
  });

  it('says the vehicle did not work rather than showing an empty day', async () => {
    get.mockResolvedValue({ ...DAY, trips: [], totalVerifiedKm: 0 });
    renderPage();
    searchFor('KA01AB1234');

    expect(await screen.findByText(/did not work that day/i)).toBeInTheDocument();
  });

  it('says so when no vehicle carries the plate', async () => {
    get.mockRejectedValue(
      new ApiError({
        status: 404,
        code: 'not_found',
        message: 'No vehicle carries that registration.',
      }),
    );
    renderPage();
    searchFor('KA99XX0000');

    expect(await screen.findByText(/no vehicle carries that registration/i)).toBeInTheDocument();
  });
});
