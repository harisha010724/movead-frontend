import { describe, expect, it } from 'vitest';
import { mockFetch } from './mockFetch';

/**
 * The mock stands in for the real endpoints when the admin portal runs
 * offline, so it has to answer with the same shapes and the same refusals. In
 * particular it must refuse a partial plate: the real API matches a
 * registration exactly, and a mock that helpfully guessed would let a screen
 * be reviewed and signed off on behaviour production does not have.
 */
const DAY = '2026-09-14';

async function audit(vehicleNumber: string, date = DAY) {
  const query = new URLSearchParams({ vehicleNumber, date });
  return mockFetch('GET', `/v1/admin/gps-audit/trips?${query.toString()}`);
}

interface DayBody {
  vehicle: { registrationNumber: string };
  totalVerifiedKm: number;
  totalEarnings: string;
  totalCharge: string;
  trips: {
    id: string;
    verifiedKm: number;
    earnings: string;
    status: string;
    zoneBreakdown: { zone: string; km: number }[] | null;
  }[];
}

interface TripBody {
  legs: {
    zone: string;
    state: string;
    distanceKm: number;
    advertiserCharge: string;
    driverEarning: string;
    path: { lat: number; lng: number }[];
  }[];
}

describe('GET /v1/admin/gps-audit/trips', () => {
  it('normalises the plate the way the server does', async () => {
    const response = await audit('ka 01-ab 1234');
    const body = (await response.json()) as DayBody;

    expect(response.status).toBe(200);
    expect(body.vehicle.registrationNumber).toBe('KA01AB1234');
  });

  it('refuses a partial plate rather than guessing at one', async () => {
    expect((await audit('KA01')).status).toBe(404);
    expect((await audit('1234')).status).toBe(404);
  });

  it('needs a date', async () => {
    const response = await mockFetch('GET', '/v1/admin/gps-audit/trips?vehicleNumber=KA01AB1234');
    expect(response.status).toBe(400);
  });

  /*
   * The fixture is a worked example of the contract, not decoration: a day
   * whose trips do not add up to its total would let a reconciliation bug
   * through review looking correct.
   */
  it('totals exactly what its trips add up to', async () => {
    const body = (await (await audit('KA01AB1234')).json()) as DayBody;
    const km = body.trips.reduce((total, trip) => total + trip.verifiedKm, 0);
    const earned = body.trips.reduce((total, trip) => total + Number(trip.earnings), 0);

    expect(body.trips.length).toBeGreaterThan(0);
    expect(km).toBeCloseTo(body.totalVerifiedKm, 1);
    expect(earned).toBeCloseTo(Number(body.totalEarnings), 2);
    expect(Number(body.totalCharge)).toBeGreaterThan(Number(body.totalEarnings));
  });

  it('gives a day with a dispute on it, so the held state is reachable', async () => {
    const body = (await (await audit('KA01AB1234')).json()) as DayBody;
    expect(body.trips.some((trip) => trip.status === 'pending_review')).toBe(true);
  });

  it('answers a day the vehicle did not work with an empty day', async () => {
    // 2026-09-13 is a Sunday.
    const body = (await (await audit('KA01AB1234', '2026-09-13')).json()) as DayBody;

    expect(body.trips).toEqual([]);
    expect(body.totalVerifiedKm).toBe(0);
  });
});

describe('GET /v1/admin/gps-audit/trips/:id', () => {
  it('returns the trip named by the list, with a run per zone', async () => {
    const day = (await (await audit('KA01AB1234')).json()) as DayBody;
    const id = day.trips[0]?.id ?? '';

    const response = await mockFetch('GET', `/v1/admin/gps-audit/trips/${id}`);
    const body = (await response.json()) as TripBody;

    expect(response.status).toBe(200);
    expect(body.legs.map((leg) => leg.zone)).toEqual(['prime', 'network', 'secondary']);
    expect(body.legs.every((leg) => leg.path.length > 1)).toBe(true);
  });

  it('pays nothing for a run it is holding', async () => {
    const body = (await (
      await mockFetch('GET', `/v1/admin/gps-audit/trips/trip_${DAY}_3`)
    ).json()) as TripBody;

    const held = body.legs.filter((leg) => leg.state === 'PENDING_REVIEW');
    expect(held.length).toBeGreaterThan(0);
    expect(held.every((leg) => Number(leg.driverEarning) === 0)).toBe(true);
    expect(held.every((leg) => Number(leg.advertiserCharge) === 0)).toBe(true);
  });

  it('says so when the id is not a trip', async () => {
    const response = await mockFetch('GET', '/v1/admin/gps-audit/trips/nonsense');
    expect(response.status).toBe(404);
  });
});
