import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { queryKeys } from '@/shared/api/queryKeys';
import { formatDate, formatRegistration } from '@/shared/format';
import { addIsoDays } from '@/shared/lib/civilDate';
import type { ZonePolygons } from '@/shared/maps/types';
import type { VehicleAvailability } from '@/shared/types/domain';

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
  zone: 'prime' | 'secondary';
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
  availableCount: number;
}

export type VehiclesEndpoint =
  | '/v1/campaigns/available-vehicles'
  | '/v1/admin/vehicles/in-zones';

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

/** An outline only selects vehicles once it encloses something. */
export function hasOutline(polygons: ZonePolygons | undefined): boolean {
  return Boolean(
    (polygons?.prime?.path && polygons.prime.path.length >= 3) ||
      (polygons?.secondary?.path && polygons.secondary.path.length >= 3),
  );
}

/**
 * Vehicles whose onboard pin falls inside the draft outlines.
 *
 * Lifted out of the list because the map now shows the same vehicles: two
 * components fetching this separately would put two answers on one screen.
 */
export function useVehiclesInZones(
  endpoint: VehiclesEndpoint,
  vehicleType: 'CAB' | 'AUTO',
  polygons: ZonePolygons | undefined,
) {
  return useQuery({
    queryKey: queryKeys.vehicles.inZones(vehicleType, polygons),
    queryFn: () =>
      api.post<AvailableVehiclesResponse>(endpoint, {
        vehicleType,
        zonePolygons: polygons ?? {},
      }),
    enabled: hasOutline(polygons),
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
