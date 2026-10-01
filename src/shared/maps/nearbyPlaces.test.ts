import { afterEach, describe, expect, it } from 'vitest';

import { metresBetween, nearbyPlacesWithin, PARKED_NEARBY_METRES } from './nearbyPlaces';

const PIN = { lat: 12.9352, lng: 77.6245 };

type NearbyCallback = (
  results: google.maps.places.PlaceResult[] | null,
  status: google.maps.places.PlacesServiceStatus,
) => void;

const nearbyRequests: google.maps.places.PlaceSearchRequest[] = [];

function placeAt(
  name: string,
  lat: number,
  lng: number,
  types: string[] = ['store'],
): Partial<google.maps.places.PlaceResult> {
  return {
    name,
    types,
    geometry: {
      location: { lat: () => lat, lng: () => lng } as google.maps.LatLng,
    },
  };
}

function installGoogle(results: Partial<google.maps.places.PlaceResult>[], status = 'OK'): void {
  nearbyRequests.length = 0;
  (globalThis as unknown as { google: unknown }).google = {
    maps: {
      places: {
        PlacesServiceStatus: { OK: 'OK', ZERO_RESULTS: 'ZERO_RESULTS' },
        PlacesService: class {
          nearbySearch(
            request: google.maps.places.PlaceSearchRequest,
            callback: NearbyCallback,
          ): void {
            nearbyRequests.push(request);
            callback(
              results as google.maps.places.PlaceResult[],
              status as unknown as google.maps.places.PlacesServiceStatus,
            );
          }
        },
      },
    },
  };
}

afterEach(() => {
  nearbyRequests.length = 0;
  delete (globalThis as { google?: unknown }).google;
});

describe('places within 100 m of a parked pin', () => {
  it('asks Google for a 100 m circle and keeps only what is inside it', async () => {
    installGoogle([
      placeAt('Forum Mall', 12.9353, 77.6246, ['shopping_mall']),
      placeAt('Too far cafe', 12.94, 77.63, ['cafe']),
    ]);

    const nearby = await nearbyPlacesWithin(PIN);

    expect(nearbyRequests[0]).toMatchObject({ radius: PARKED_NEARBY_METRES });
    expect(nearby.map((place) => place.name)).toEqual(['Forum Mall']);
    expect(nearby[0]?.kind).toBe('Mall');
    expect(nearby[0]?.metres).toBeLessThanOrEqual(PARKED_NEARBY_METRES);
  });

  it('drops a result Google returned outside the circle', async () => {
    installGoogle([placeAt('Silk Board', 12.9174, 77.6232, ['transit_station'])]);

    const nearby = await nearbyPlacesWithin(PIN);

    expect(nearby).toEqual([]);
    expect(metresBetween(PIN, { lat: 12.9174, lng: 77.6232 })).toBeGreaterThan(
      PARKED_NEARBY_METRES,
    );
  });

  it('answers an empty list when Places is not loaded', async () => {
    await expect(nearbyPlacesWithin(PIN)).resolves.toEqual([]);
  });
});
