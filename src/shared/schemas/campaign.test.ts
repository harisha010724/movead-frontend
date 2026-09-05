import { describe, expect, it } from 'vitest';
import {
  adjustedEndAfterStart,
  adminCampaignSchema,
  campaignSchema,
  canEditCampaign,
  minCampaignEndDate,
  previewZoneEstimate,
  toCampaignFormValues,
  wholeKm,
} from './campaign';

const valid = {
  name: 'Summer Sale',
  brandName: 'ABC Retail',
  city: 'Bengaluru',
  vehicleType: 'CAB' as const,
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  zonePrimeKm: '2000',
  zoneSecondaryKm: '2000',
  locations: [
    {
      id: 'loc_mg_road',
      placeId: 'ChIJbU60yXAWrjsR4E9-UejD3_g',
      label: 'MG Road, Bengaluru',
      lat: 12.9756,
      lng: 77.6069,
      tier: 'prime' as const,
    },
  ],
  zonePolygons: {},
  requestedVehicleIds: ['11111111-1111-4111-8111-111111111111'],
  targetKm: '150000',
};

/** The message shown under a given field, or undefined if it passed. */
function errorFor(input: Record<string, unknown>, field: string): string | undefined {
  const result = campaignSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe('campaignSchema', () => {
  it('accepts a complete campaign', () => {
    expect(campaignSchema.safeParse(valid).success).toBe(true);
  });

  it('treats target distance as optional', () => {
    expect(campaignSchema.safeParse({ ...valid, targetKm: '' }).success).toBe(true);
  });

  it('requires at least one vehicle to carry the ad', () => {
    expect(errorFor({ ...valid, requestedVehicleIds: [] }, 'requestedVehicleIds')).toMatch(
      /at least one vehicle/,
    );
  });

  it('requires a campaign name of at least three characters', () => {
    expect(errorFor({ ...valid, name: 'ab' }, 'name')).toMatch(/at least 3/);
  });

  it('rejects planned spend below the ₹10,000 minimum', () => {
    expect(
      errorFor({ ...valid, zonePrimeKm: '100', zoneSecondaryKm: '100' }, 'zonePrimeKm'),
    ).toMatch(/10,000/);
  });

  it('accepts a drawn outline even without a searched place', () => {
    expect(errorFor({ ...valid, locations: [], zonePolygons: {} }, 'locations')).toMatch(
      /outline on the map/,
    );
    expect(
      campaignSchema.safeParse({
        ...valid,
        locations: [],
        zonePolygons: {
          prime: {
            path: [
              { lat: 12.97, lng: 77.6 },
              { lat: 12.97, lng: 77.62 },
              { lat: 12.98, lng: 77.62 },
            ],
          },
        },
      }).success,
    ).toBe(true);
  });

  it('rejects kilometres that are not a whole number', () => {
    expect(errorFor({ ...valid, zonePrimeKm: '12.5' }, 'zonePrimeKm')).toMatch(/whole number/);
  });

  it('reports an end date before the start date on the end date field', () => {
    expect(errorFor({ ...valid, startDate: '2026-09-30', endDate: '2026-09-01' }, 'endDate')).toMatch(
      /after the start date/,
    );
  });

  it('rejects a campaign shorter than seven days', () => {
    expect(errorFor({ ...valid, startDate: '2026-09-01', endDate: '2026-09-05' }, 'endDate')).toMatch(
      /at least 7 days/,
    );
  });

  it('accepts a campaign that is exactly seven days inclusive', () => {
    const result = campaignSchema.safeParse({
      ...valid,
      startDate: '2026-09-01',
      endDate: '2026-09-07',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-integer target distance', () => {
    expect(errorFor({ ...valid, targetKm: '12.5' }, 'targetKm')).toMatch(/whole number/);
  });

  it('keeps the end date after the start date when the start moves forward', () => {
    expect(minCampaignEndDate('2026-08-22')).toBe('2026-08-28');
    expect(adjustedEndAfterStart('2026-09-10', '2026-09-12')).toBe('2026-09-16');
    expect(adjustedEndAfterStart('2026-09-10', '2026-09-30')).toBe('2026-09-30');
    expect(adjustedEndAfterStart('2026-09-10', '')).toBe('');
  });

  it('turns planned kilometres into spend at the fixed rates', () => {
    const preview = previewZoneEstimate({
      zonePrimeKm: '4000',
      zoneSecondaryKm: '10000',
      startDate: '2026-09-01',
      endDate: '2026-09-14',
    });
    expect(preview.rows.map((row) => row.km)).toEqual([4000, 10000]);
    expect(preview.rows.map((row) => row.amount)).toEqual([20000, 20000]);
    expect(preview.totalAmount).toBe(40000);
    expect(preview.vehicles).toBeGreaterThan(0);
  });
});

const adminValid = {
  ...valid,
  advertiserId: 'adv_01',
  instructionChannel: 'EMAIL' as const,
  instructionReference: 'Email: “Diwali campaign brief”, 14 Aug',
  instructionDate: '2026-08-14',
};

function adminErrorFor(input: Record<string, unknown>, field: string): string | undefined {
  const result = adminCampaignSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe('adminCampaignSchema', () => {
  it('accepts a campaign created on an advertiser’s behalf', () => {
    expect(adminCampaignSchema.safeParse(adminValid).success).toBe(true);
  });

  it('requires an owning advertiser (AC-34.2)', () => {
    expect(adminErrorFor({ ...adminValid, advertiserId: '' }, 'advertiserId')).toMatch(
      /Select the advertiser/,
    );
  });

  it('requires an instruction reference to be retained (AC-34.5)', () => {
    expect(
      adminErrorFor({ ...adminValid, instructionReference: '' }, 'instructionReference'),
    ).toMatch(/reference/);
  });

  it('rejects an instruction reference too short to find later', () => {
    expect(
      adminErrorFor({ ...adminValid, instructionReference: 'ok' }, 'instructionReference'),
    ).toMatch(/find later/);
  });

  it('applies the same campaign rules as the advertiser form (AC-34.1)', () => {
    expect(
      adminErrorFor({ ...adminValid, zonePrimeKm: '100', zoneSecondaryKm: '100' }, 'zonePrimeKm'),
    ).toMatch(/10,000/);
    expect(
      adminErrorFor({ ...adminValid, startDate: '2026-09-01', endDate: '2026-09-02' }, 'endDate'),
    ).toMatch(/at least 7 days/);
  });
});

describe('campaign edit mapping', () => {
  it('turns stored decimal kilometres into whole numbers the form accepts', () => {
    expect(wholeKm('4000.0')).toBe('4000');
    expect(wholeKm('0.0')).toBe('');
    expect(wholeKm(null)).toBe('');
  });

  it('maps a stored campaign onto the create form', () => {
    const values = toCampaignFormValues({
      name: 'Summer Sale',
      brandName: 'ABC Retail',
      city: 'Bengaluru',
      vehicleType: 'CAB',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      zonePrimeKm: '2000.0',
      zoneSecondaryKm: '2000.0',
      locations: valid.locations,
      zonePolygons: {},
      requestedVehicleIds: valid.requestedVehicleIds,
      targetKm: '150000.0000',
    });

    expect(values.zonePrimeKm).toBe('2000');
    expect(values.targetKm).toBe('150000');
    expect(campaignSchema.safeParse(values).success).toBe(true);
  });

  it('allows edit only before approval', () => {
    expect(canEditCampaign('PENDING_APPROVAL')).toBe(true);
    expect(canEditCampaign('DRAFT')).toBe(true);
    expect(canEditCampaign('APPROVED')).toBe(false);
    expect(canEditCampaign('ACTIVE')).toBe(false);
  });
});
