import { describe, expect, it } from 'vitest';

import { releaseIfCampaignLapsed } from './vehiclesInZones';

describe('releaseIfCampaignLapsed', () => {
  it('keeps a booking whose last day has not passed', () => {
    const row = releaseIfCampaignLapsed({
      availability: 'booked' as const,
      bookedUntil: '2099-12-31',
    });
    expect(row.availability).toBe('booked');
    expect(row.bookedUntil).toBe('2099-12-31');
  });

  it('frees a vehicle the day after the campaign ends', () => {
    const row = releaseIfCampaignLapsed({
      availability: 'booked' as const,
      bookedUntil: '2020-01-01',
    });
    expect(row.availability).toBe('available');
    expect(row.bookedUntil).toBeUndefined();
  });
});
