import { z } from 'zod';
import { addIsoDays } from '@/shared/lib/civilDate';
import type { CampaignLocation, ZonePolygons, ZoneTier } from '@/shared/maps/types';

/**
 * Campaign validation, shared by the advertiser portal and by admin creating a
 * campaign on an advertiser's behalf.
 *
 * AC-34.1 requires the admin route to use the same fields and validation as
 * AC-01. Keeping one definition is how that stays true: a rule added for one
 * portal cannot silently fail to apply to the other.
 *
 * These mirror the server's schema; they do not replace it. Anything checked
 * only in the browser is not checked at all.
 */

const latLng = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

export const campaignLocationSchema = z.object({
  id: z.string().min(1),
  placeId: z.string(),
  label: z.string().min(1),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  tier: z.enum(['prime', 'secondary']),
});

export const zonePolygonsSchema = z.object({
  prime: z.object({ path: z.array(latLng).min(3) }).optional(),
  secondary: z.object({ path: z.array(latLng).min(3) }).optional(),
});

export type { CampaignLocation, ZonePolygons, ZoneTier };

/** Empty means zero. Prime and Secondary are planned kilometres, not rupees. */
const kmAmount = z
  .string()
  .refine((v) => v === '' || /^\d+$/.test(v), 'Enter a whole number of kilometres');

export const campaignFields = {
  name: z
    .string()
    .trim()
    .min(3, 'Campaign name must be at least 3 characters')
    .max(80, 'Campaign name must be 80 characters or fewer'),
  brandName: z.string().trim().min(2, 'Enter the brand this campaign advertises'),
  city: z.string().min(1, 'Select a city'),
  vehicleType: z.enum(['CAB', 'AUTO'], { message: 'Select a vehicle type' }),
  startDate: z.string().min(1, 'Select a start date'),
  endDate: z.string().min(1, 'Select an end date'),
  zonePrimeKm: kmAmount,
  zoneSecondaryKm: kmAmount,
  locations: z.array(campaignLocationSchema),
  zonePolygons: zonePolygonsSchema,
  requestedVehicleIds: z
    .array(z.string().min(1))
    .min(1, 'Select at least one vehicle to carry this ad'),
  targetKm: z
    .string()
    .refine((v) => v === '' || /^\d+$/.test(v), 'Enter a whole number of kilometres')
    .refine((v) => v === '' || Number(v) > 0, 'Target distance must be greater than zero'),
};

/** Fixed advertiser rates per verified km — Prime ₹5, Secondary ₹2, Network ₹1. */
export const ZONE_RATES = { prime: 5, secondary: 2, network: 1 } as const;

/** Only Prime and Secondary are planned. Network is leftover geography at ₹1/km. */
export const ZONE_PLAN_FIELDS = [
  { key: 'zonePrimeKm', tier: 'prime', label: 'Prime', rate: ZONE_RATES.prime },
  { key: 'zoneSecondaryKm', tier: 'secondary', label: 'Secondary', rate: ZONE_RATES.secondary },
] as const;

export type ZoneFieldKey = (typeof ZONE_PLAN_FIELDS)[number]['key'];

const KM_PER_VEHICLE_DAY = 80;

export function rupeeValue(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function plannedSpend(values: { zonePrimeKm?: string; zoneSecondaryKm?: string }): number {
  return (
    rupeeValue(values.zonePrimeKm) * ZONE_RATES.prime +
    rupeeValue(values.zoneSecondaryKm) * ZONE_RATES.secondary
  );
}

/** Planned Prime + Secondary spend, as a decimal string. Network is not planned. */
export function zoneBudgetTotal(values: {
  zonePrimeKm?: string;
  zoneSecondaryKm?: string;
}): string {
  return plannedSpend(values).toFixed(2);
}

export function previewZoneEstimate(values: {
  zonePrimeKm?: string;
  zoneSecondaryKm?: string;
  startDate?: string;
  endDate?: string;
}): {
  rows: { key: ZoneFieldKey; label: string; rate: number; amount: number; km: number }[];
  totalAmount: number;
  totalKm: number;
  days: number;
  vehicles: number;
} {
  const rows = ZONE_PLAN_FIELDS.map((zone) => {
    const km = rupeeValue(values[zone.key]);
    return { key: zone.key, label: zone.label, rate: zone.rate, amount: km * zone.rate, km };
  });
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
  const totalKm = rows.reduce((sum, row) => sum + row.km, 0);
  const days =
    values.startDate && values.endDate && values.endDate >= values.startDate
      ? inclusiveDays(values.startDate, values.endDate)
      : 0;
  const vehicles =
    totalKm > 0 && days > 0 ? Math.max(1, Math.ceil(totalKm / (days * KM_PER_VEHICLE_DAY))) : 0;

  return { rows, totalAmount, totalKm, days, vehicles };
}

interface DatedCampaign {
  startDate: string;
  endDate: string;
}

interface ZonedCampaign {
  zonePrimeKm: string;
  zoneSecondaryKm: string;
}

/** Minimum run length. A wrap costs the same however short the campaign is. */
export const CAMPAIGN_MINIMUM_DAYS = 7;

/** First end date that makes a campaign `CAMPAIGN_MINIMUM_DAYS` long, inclusive. */
export function minCampaignEndDate(startDate: string): string {
  return addIsoDays(startDate, CAMPAIGN_MINIMUM_DAYS - 1);
}

/** If the current end is on or before the start (or shorter than the minimum), move it. */
export function adjustedEndAfterStart(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return endDate;
  const minEnd = minCampaignEndDate(startDate);
  return endDate < minEnd ? minEnd : endDate;
}

function inclusiveDays(startDate: string, endDate: string): number {
  return (
    (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000 + 1
  );
}

/**
 * Applies the cross-field date rules. Written as a function because Zod cannot
 * extend a schema once a refinement has been attached, and both the advertiser
 * and admin schemas need these rules on top of a different field set.
 */
export function withDateRules<T extends z.ZodType<DatedCampaign>>(schema: T) {
  return schema
    .refine((data) => !data.startDate || !data.endDate || data.endDate > data.startDate, {
      message: 'End date must be after the start date',
      path: ['endDate'],
    })
    .refine(
      (data) =>
        !data.startDate ||
        !data.endDate ||
        inclusiveDays(data.startDate, data.endDate) >= CAMPAIGN_MINIMUM_DAYS,
      {
        message: `A campaign must run for at least ${CAMPAIGN_MINIMUM_DAYS} days`,
        path: ['endDate'],
      },
    );
}

interface MappedCampaign {
  locations: CampaignLocation[];
  zonePolygons: ZonePolygons;
}

export function withMapRules<T extends z.ZodType<MappedCampaign>>(schema: T) {
  return schema.refine(
    (data) =>
      data.locations.length > 0 ||
      (data.zonePolygons.prime?.path.length ?? 0) >= 3 ||
      (data.zonePolygons.secondary?.path.length ?? 0) >= 3,
    {
      message: 'Draw a Prime or Secondary outline on the map, or search at least one place',
      path: ['locations'],
    },
  );
}

export function withZoneBudgetRules<T extends z.ZodType<ZonedCampaign>>(schema: T) {
  return schema.refine((data) => plannedSpend(data) >= 10_000, {
    message: 'Minimum campaign budget is ₹10,000 (Prime km × ₹5 + Secondary km × ₹2)',
    path: ['zonePrimeKm'],
  });
}

/** AC-01: the advertiser creating their own campaign. */
export const campaignSchema = withZoneBudgetRules(
  withDateRules(withMapRules(z.object(campaignFields))),
);

export type CampaignFormValues = z.input<typeof campaignSchema>;

/**
 * AC-34: admin creating a campaign for someone else.
 *
 * Two fields exist only on this route. The advertiser identifies the account
 * that will own the campaign and pay for it (AC-34.2). The instruction record
 * captures how the advertiser asked for it, because a campaign a third party
 * configured needs a retained reference back to the request that authorised it
 * (AC-34.5) — without it, nobody can later show who asked for this spend.
 */
export const adminCampaignSchema = withZoneBudgetRules(
  withDateRules(
    withMapRules(
    z.object({
      ...campaignFields,
      advertiserId: z.string().min(1, 'Select the advertiser this campaign belongs to'),
      instructionChannel: z.enum(['EMAIL', 'CALL', 'MEETING', 'PURCHASE_ORDER'], {
        message: 'Select how the advertiser asked for this campaign',
      }),
      instructionReference: z
        .string()
        .trim()
        .min(3, 'Enter a reference someone else could find later')
        .max(140, 'Reference must be 140 characters or fewer'),
      instructionDate: z.string().min(1, 'Select the date of the instruction'),
    }),
    ),
  ),
);

export type AdminCampaignFormValues = z.input<typeof adminCampaignSchema>;

export const INSTRUCTION_CHANNELS = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'CALL', label: 'Phone call' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'PURCHASE_ORDER', label: 'Purchase order' },
];

export const INSTRUCTION_HINTS: Record<string, string> = {
  EMAIL: 'Message subject or ID, so the thread can be found.',
  CALL: 'Who you spoke to and when, plus any call reference.',
  MEETING: 'Meeting date and who attended.',
  PURCHASE_ORDER: 'The PO number as issued by the advertiser.',
};

/** API stores planned KM as a decimal ("4000.0"). The form only accepts whole kilometres. */
export function wholeKm(value: string | null | undefined): string {
  if (!value) return '';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(Math.round(n));
}

/**
 * Draft / in-review only. After approval, vehicles and spend are in motion
 * and the advertiser cannot rewrite the brief.
 */
export const EDITABLE_CAMPAIGN_STATUSES = [
  'DRAFT',
  'PENDING_CONFIRMATION',
  'PENDING_APPROVAL',
] as const;

export function canEditCampaign(status: string): boolean {
  return (EDITABLE_CAMPAIGN_STATUSES as readonly string[]).includes(status);
}

export function toCampaignFormValues(campaign: {
  name: string;
  brandName: string;
  city: string;
  vehicleType: 'CAB' | 'AUTO';
  startDate: string;
  endDate: string;
  zonePrimeKm?: string;
  zoneSecondaryKm?: string;
  locations?: CampaignLocation[] | { tier: string }[];
  zonePolygons?: ZonePolygons;
  requestedVehicleIds?: string[];
  targetKm?: string | null;
}): CampaignFormValues {
  const locations = (campaign.locations ?? []).filter(
    (row): row is CampaignLocation => row.tier === 'prime' || row.tier === 'secondary',
  );

  return {
    name: campaign.name,
    brandName: campaign.brandName,
    city: campaign.city,
    vehicleType: campaign.vehicleType,
    startDate: campaign.startDate.slice(0, 10),
    endDate: campaign.endDate.slice(0, 10),
    zonePrimeKm: wholeKm(campaign.zonePrimeKm),
    zoneSecondaryKm: wholeKm(campaign.zoneSecondaryKm),
    locations,
    zonePolygons: campaign.zonePolygons ?? {},
    requestedVehicleIds: campaign.requestedVehicleIds ?? [],
    targetKm: wholeKm(campaign.targetKm),
  };
}
