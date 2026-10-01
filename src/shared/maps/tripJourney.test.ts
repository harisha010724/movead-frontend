import { describe, expect, it } from 'vitest';

import { journeyOf } from './tripJourney';
import { asMoney, type CampaignTripDetail, type VisibilityPlace } from '@/shared/types/domain';

const BASE_DETAIL: CampaignTripDetail = {
  id: 'trip-1',
  vehicleRegistration: 'KA01AB1234',
  startedAt: '2026-09-28T08:27:00+05:30',
  endedAt: '2026-09-28T08:28:00+05:30',
  distanceKm: 12.4,
  advertiserCharge: asMoney('42.00'),
  status: 'verified',
  legs: [
    {
      zone: 'prime',
      state: 'BILLABLE',
      flagReason: null,
      startedAt: '2026-09-28T08:27:00+05:30',
      endedAt: '2026-09-28T08:28:00+05:30',
      distanceKm: 12.4,
      advertiserRate: asMoney('5.0000'),
      advertiserCharge: asMoney('42.00'),
      segments: 10,
      visibility: 'medium',
      path: [
        { lat: 12.9, lng: 77.58 },
        { lat: 12.98, lng: 77.64 },
      ],
    },
  ],
  places: [],
  parked: null,
};

function junction(lat: number, lng: number, km: number): VisibilityPlace {
  return {
    kind: 'junction',
    name: 'Junction',
    lat,
    lng,
    km,
    seconds: 80,
    visits: 2,
    source: 'gps',
  };
}

describe('a trip as a journey', () => {
  it('always keeps start and end, even with no dwells', () => {
    const stops = journeyOf(BASE_DETAIL);
    expect(stops.map((stop) => stop.role)).toEqual(['start', 'end']);
    expect(stops[0]?.name).toBe('Start');
    expect(stops[1]?.name).toBe('End');
  });

  it('keeps a named mall and drops a pile of identical junctions', () => {
    const stops = journeyOf({
      ...BASE_DETAIL,
      places: [
        {
          kind: 'mall',
          name: 'Forum Mall',
          lat: 12.934,
          lng: 77.611,
          km: 0.4,
          seconds: 90,
          visits: 2,
          source: 'osm',
        },
        junction(12.94, 77.6, 0.2),
        junction(12.941, 77.601, 0.18),
        junction(12.942, 77.602, 0.15),
        junction(12.943, 77.603, 0.12),
        junction(12.944, 77.604, 0.1),
        junction(12.945, 77.605, 0.08),
        junction(12.946, 77.606, 0.05),
      ],
    });

    expect(stops[0]?.role).toBe('start');
    expect(stops.at(-1)?.role).toBe('end');
    expect(stops.filter((stop) => stop.role === 'place')).toHaveLength(3);
    expect(stops.some((stop) => stop.name === 'Forum Mall')).toBe(true);
    expect(stops.filter((stop) => stop.name === 'Junction')).toHaveLength(0);
    expect(stops.some((stop) => stop.name === 'Slow enough to read')).toBe(true);
  });

  it('does not pin a dwell that is the start of the trip', () => {
    const stops = journeyOf({
      ...BASE_DETAIL,
      places: [junction(12.9001, 77.5801, 1.2)],
    });

    expect(stops.map((stop) => stop.role)).toEqual(['start', 'end']);
  });
});
