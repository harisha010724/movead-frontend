import {
  VISIBILITY_PLACE_LABEL,
  type CampaignTripDetail,
  type CampaignTripLeg,
  type VisibilityPlace,
  type VisibilityPlaceKind,
  type ZoneKey,
} from '@/shared/types/domain';

/**
 * The handful of stops an advertiser can actually read.
 *
 * The API may return a dozen GPS dwells, all named "Junction" when Overpass
 * knew nothing. Dumping those as chips is noise. This keeps start, end, and
 * at most three dwells — named places first, then the longest crawls — so the
 * map and the timeline stay a journey, not a list of dots.
 */

export type JourneyRole = 'start' | 'place' | 'end';

export interface JourneyStop {
  id: string;
  role: JourneyRole;
  kind: VisibilityPlaceKind | 'start' | 'end';
  name: string;
  lat: number;
  lng: number;
  at: string | null;
  km: number | null;
  seconds: number | null;
  zone: ZoneKey | null;
  /** True when a mall / signal / area name is known, not a generic fallback. */
  named: boolean;
}

const NEAR_KM = 0.25;
const MAX_PLACES = 3;

/** Fallback when the map has no mall, signal or neighbourhood for a crawl. */
export const UNNAMED_STOP = 'Slow enough to read';

export function journeyOf(detail: CampaignTripDetail): JourneyStop[] {
  const startPoint = detail.legs.at(0)?.path.at(0);
  const endPoint = detail.legs.at(-1)?.path.at(-1);
  if (!startPoint || !endPoint) return [];

  const start: JourneyStop = {
    id: 'start',
    role: 'start',
    kind: 'start',
    name: 'Start',
    lat: startPoint.lat,
    lng: startPoint.lng,
    at: detail.startedAt,
    km: null,
    seconds: null,
    zone: detail.legs.at(0)?.zone ?? null,
    named: false,
  };

  const end: JourneyStop = {
    id: 'end',
    role: 'end',
    kind: 'end',
    name: 'End',
    lat: endPoint.lat,
    lng: endPoint.lng,
    at: detail.endedAt,
    km: detail.distanceKm,
    seconds: null,
    zone: detail.legs.at(-1)?.zone ?? null,
    named: false,
  };

  return [start, ...pickPlaces(detail.places, start, end, detail.legs), end];
}

function pickPlaces(
  places: VisibilityPlace[],
  start: JourneyStop,
  end: JourneyStop,
  legs: CampaignTripLeg[],
): JourneyStop[] {
  const ranked = [...places].sort((left, right) => {
    const namedDelta = Number(isNamed(right)) - Number(isNamed(left));
    if (namedDelta !== 0) return namedDelta;
    return right.km - left.km || right.seconds - left.seconds;
  });

  const picked: JourneyStop[] = [];

  for (const place of ranked) {
    if (picked.length >= MAX_PLACES) break;
    if (tooClose(place, start) || tooClose(place, end)) continue;
    if (picked.some((stop) => tooClose(place, stop))) continue;

    const onRoute = snapToRoute(legs, place);
    picked.push({
      id: `${place.kind}-${place.lat}-${place.lng}`,
      role: 'place',
      kind: place.kind,
      name: isNamed(place) ? place.name : UNNAMED_STOP,
      lat: place.lat,
      lng: place.lng,
      at: onRoute.at,
      km: place.km,
      seconds: place.seconds,
      zone: onRoute.zone,
      named: isNamed(place),
    });
  }

  return picked;
}

export function isNamed(place: VisibilityPlace): boolean {
  if (place.kind !== 'junction') return true;
  const generic = VISIBILITY_PLACE_LABEL.junction.toLowerCase();
  return place.name.trim().toLowerCase() !== generic && place.name.trim().toLowerCase() !== 'junction';
}

function tooClose(
  point: { lat: number; lng: number },
  other: { lat: number; lng: number },
): boolean {
  return haversineKm(point, other) < NEAR_KM;
}

function snapToRoute(
  legs: CampaignTripLeg[],
  point: { lat: number; lng: number },
): { at: string | null; zone: ZoneKey | null } {
  let bestAt: string | null = null;
  let bestZone: ZoneKey | null = null;
  let bestKm = Number.POSITIVE_INFINITY;

  for (const leg of legs) {
    for (const vertex of leg.path) {
      const distance = haversineKm(point, vertex);
      if (distance < bestKm) {
        bestKm = distance;
        bestAt = leg.startedAt;
        bestZone = leg.zone;
      }
    }
  }

  return { at: bestAt, zone: bestZone };
}

function haversineKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
