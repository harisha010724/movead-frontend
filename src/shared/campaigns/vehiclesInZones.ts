import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { queryKeys } from '@/shared/api/queryKeys';
import { formatDate, formatRegistration } from '@/shared/format';
import { addIsoDays } from '@/shared/lib/civilDate';
import { ZONE_MAP_COLORS } from '@/shared/maps/zoneColors';
import type { ZonePolygons, ZoneTier } from '@/shared/maps/types';
import type { VehicleAvailability } from '@/shared/types/domain';

/**
 * Where a vehicle's pin sits relative to the drawn outlines.
 *
 * `ZoneTier` cannot be widened to include this: only Prime and Secondary can be
 * drawn, and Network is what is left over. A vehicle, unlike a polygon, can be
 * in that leftover — at ₹1/km rather than not at all.
 */
export type VehicleZone = ZoneTier | 'network';

export interface AvailableVehicle {
  id: string;
  vehicleType: 'CAB' | 'AUTO';
  /** A stable, opaque reference. Kept for support conversations and logs. */
  publicRef: string;
  /** The plate, shown to every audience — see AC-22.4. */
  registrationNumber: string;
  areaLabel: string;
  lat: number;
  lng: number;
  zone: VehicleZone;
  status: string;
  availability: VehicleAvailability;
  /** Only on a booked vehicle: when the campaign holding it ends (AC-22.4c). */
  bookedUntil?: string;
  /** Admin only. ADV-039 withholds the person, not the vehicle. */
  driverName?: string;
}

export interface AvailableVehiclesResponse {
  items: AvailableVehicle[];
  primeCount: number;
  secondaryCount: number;
  networkCount: number;
  availableCount: number;
}

export type VehiclesEndpoint =
  '/v1/campaigns/available-vehicles' | '/v1/admin/vehicles/in-zones';

export const AVAILABILITY: Record<
  VehicleAvailability,
  { label: string; tone: 'success' | 'info' | 'warning'; why: string }
> = {
  available: { label: 'Available', tone: 'success', why: '' },
  booked: {
    label: 'Booked',
    tone: 'info',
    why: 'Already carrying a live campaign. A vehicle runs one at a time.',
  },
  pending: {
    label: 'Pending review',
    tone: 'warning',
    why: 'Operations has not approved this vehicle yet.',
  },
};

/**
 * The tier chip on a vehicle row.
 *
 * `ZONE_MAP_COLORS` deliberately covers only what can be drawn, so Network
 * needs its own swatch — a neutral one, because it is where the outlines are
 * not rather than a third zone someone forgot to draw.
 */
export const ZONE_CHIP: Record<VehicleZone, { label: string; background: string }> = {
  prime: { label: 'Prime', background: ZONE_MAP_COLORS.prime.stroke },
  secondary: { label: 'Secondary', background: ZONE_MAP_COLORS.secondary.stroke },
  network: { label: 'Network', background: '#64748b' },
};

/** An outline only selects vehicles once it encloses something. */
export function hasOutline(polygons: ZonePolygons | undefined): boolean {
  return Boolean(
    (polygons?.prime?.path && polygons.prime.path.length >= 3) ||
    (polygons?.secondary?.path && polygons.secondary.path.length >= 3),
  );
}

/**
 * The city's fleet, each vehicle tiered by the draft outlines.
 *
 * Runs before anything is drawn, which is the point: a buyer picks where to
 * advertise by looking at where the vehicles are, and the old behaviour —
 * nothing listed until a polygon closed — asked for that decision in the
 * opposite order. Drawing now moves vehicles between Prime, Secondary and
 * Network rather than in and out of the list.
 *
 * Lifted out of the list because the map shows the same vehicles: two
 * components fetching this separately would put two answers on one screen.
 */
export function useVehiclesInZones(
  endpoint: VehiclesEndpoint,
  vehicleType: 'CAB' | 'AUTO',
  city: string,
  polygons: ZonePolygons | undefined,
) {
  return useQuery({
    queryKey: queryKeys.vehicles.inZones(vehicleType, city, polygons),
    queryFn: () =>
      api.post<AvailableVehiclesResponse>(endpoint, {
        vehicleType,
        city,
        zonePolygons: polygons ?? {},
      }),
    // A city is the one thing the list cannot be built without: it is what
    // scopes the fleet, and the form asks for it before this card is reached.
    enabled: Boolean(city),
  });
}

export function kindLabel(type: 'CAB' | 'AUTO'): string {
  return type === 'AUTO' ? 'Auto' : 'Cab';
}

/**
 * The plate, falling back to the opaque reference.
 *
 * Both audiences now see the plate (AC-22.4). The fallback is for a response
 * from an older server, where a blank cell would be worse than a reference.
 */
export function vehicleNumber(row: AvailableVehicle): string {
  return row.registrationNumber ? formatRegistration(row.registrationNumber) : row.publicRef;
}

export function areaLabel(row: AvailableVehicle): string {
  return row.areaLabel && row.areaLabel !== 'Dropped pin' ? row.areaLabel : 'Operating pin';
}

/**
 * Why a vehicle cannot be had, and — where the answer is a date — until when.
 *
 * "Booked" alone leaves a buyer with a question they can only answer by ringing
 * someone. The campaign holding the vehicle has an end date, so the honest
 * answer is available and worth giving: it turns a dead end into a plan
 * (AC-22.4c).
 */
export function unavailableReason(row: AvailableVehicle): string {
  const state = AVAILABILITY[row.availability];
  if (row.availability !== 'booked' || !row.bookedUntil) return state.why;
  return `On a campaign until ${formatDate(row.bookedUntil)} — free from ${formatDate(
    addIsoDays(row.bookedUntil, 1),
  )}`;
}
