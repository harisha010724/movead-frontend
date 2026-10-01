import { reverseGeocode } from './reverseGeocode';
import type { JourneyStop } from './tripJourney';
import type { VisibilityPlaceKind } from '@/shared/types/domain';

/**
 * Give the journey names a person would use.
 *
 * Overpass often returns nothing here (timeout, rate limit), so every dwell
 * arrives as "Junction". The map is already loaded for the route — asking it
 * for a neighbourhood, a mall or a station on the handful of centroids is
 * how "Junction × 8" becomes JP Nagar → Silk Board → Forum Mall. Start and
 * end are geocoded once; already-named OSM places are left alone.
 */

const LANDMARK_TYPES: { type: string; kind: VisibilityPlaceKind }[] = [
  { type: 'shopping_mall', kind: 'mall' },
  { type: 'department_store', kind: 'mall' },
  { type: 'subway_station', kind: 'transit' },
  { type: 'train_station', kind: 'transit' },
  { type: 'transit_station', kind: 'transit' },
];

const cache = new Map<string, JourneyStop>();

function cacheKey(stop: JourneyStop): string {
  return `${stop.role}:${stop.lat.toFixed(4)},${stop.lng.toFixed(4)}`;
}

export async function nameJourneyStops(stops: JourneyStop[]): Promise<JourneyStop[]> {
  return Promise.all(stops.map((stop) => nameOne(stop)));
}

async function nameOne(stop: JourneyStop): Promise<JourneyStop> {
  const key = cacheKey(stop);
  const hit = cache.get(key);
  if (hit) return { ...stop, name: hit.name, kind: hit.kind, named: hit.named };

  if (stop.role === 'place' && stop.named) {
    cache.set(key, stop);
    return stop;
  }

  if (stop.role === 'place') {
    const landmark = await nearbyLandmark(stop);
    if (landmark) {
      const named = { ...stop, name: landmark.name, kind: landmark.kind, named: true };
      cache.set(key, named);
      return named;
    }
  }

  const area = await reverseGeocode({ lat: stop.lat, lng: stop.lng });
  if (area.status === 'named' && area.label.trim()) {
    const named = { ...stop, name: shortName(area.label), named: true };
    cache.set(key, named);
    return named;
  }

  return stop;
}

function shortName(label: string): string {
  return label.split(',')[0]?.trim() || label;
}

async function nearbyLandmark(
  stop: JourneyStop,
): Promise<{ name: string; kind: VisibilityPlaceKind } | null> {
  if (typeof google === 'undefined' || !google.maps?.places?.PlacesService) return null;

  const attribution = document.createElement('div');
  const service = new google.maps.places.PlacesService(attribution);

  return new Promise((resolve) => {
    service.nearbySearch({ location: stop, radius: 250 }, (results, status) => {
      if (String(status) !== 'OK') {
        resolve(null);
        return;
      }

      for (const place of results ?? []) {
        const name = place.name?.trim();
        if (!name) continue;
        const kind = kindOf(place.types ?? []);
        if (kind) {
          resolve({ name, kind });
          return;
        }
      }
      resolve(null);
    });
  });
}

function kindOf(types: string[]): VisibilityPlaceKind | null {
  for (const { type, kind } of LANDMARK_TYPES) {
    if (types.includes(type)) return kind;
  }
  return null;
}
