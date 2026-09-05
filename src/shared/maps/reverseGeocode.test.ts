import { afterEach, describe, expect, it, vi } from 'vitest';

import { reverseGeocode } from './reverseGeocode';

/**
 * Naming a dropped pin, and — more to the point — knowing when it could not be
 * named.
 *
 * The zone editor showed "Looking up location…" under every pin permanently.
 * Two faults produced it together: the nearest-place fallback asked Google
 * something it always refuses, and every failure came back as a bare `null`, so
 * the screen could not tell a lookup that had failed from one still running and
 * kept claiming the latter.
 */

const PIN = { lat: 12.9352, lng: 77.6245 };

type GeocodeCallback = (
  results: google.maps.GeocoderResult[] | null,
  status: google.maps.GeocoderStatus,
) => void;

type NearbyCallback = (
  results: google.maps.places.PlaceResult[] | null,
  status: google.maps.places.PlacesServiceStatus,
) => void;

interface Fakes {
  geocode?: { status: string; results?: Partial<google.maps.GeocoderResult>[] };
  nearby?: { status: string; results?: Partial<google.maps.places.PlaceResult>[] };
}

/** Records what was asked of Google, which is half of what is under test. */
const nearbyRequests: google.maps.places.PlaceSearchRequest[] = [];

function installGoogle(fakes: Fakes): void {
  nearbyRequests.length = 0;

  (globalThis as unknown as { google: unknown }).google = {
    maps: {
      Geocoder: class {
        geocode(_request: unknown, callback: GeocodeCallback): void {
          const fake = fakes.geocode;
          if (!fake) throw new Error('geocode was not expected');
          callback(
            (fake.results ?? null) as google.maps.GeocoderResult[] | null,
            fake.status as google.maps.GeocoderStatus,
          );
        }
      },
      places: {
        PlacesServiceStatus: { OK: 'OK', ZERO_RESULTS: 'ZERO_RESULTS' },
        RankBy: { DISTANCE: 0 },
        PlacesService: class {
          nearbySearch(
            request: google.maps.places.PlaceSearchRequest,
            callback: NearbyCallback,
          ): void {
            nearbyRequests.push(request);
            const fake = fakes.nearby;
            if (!fake) throw new Error('nearbySearch was not expected');
            callback(
              fake.results ?? null,
              fake.status as unknown as google.maps.places.PlacesServiceStatus,
            );
          }
        },
      },
    },
  };
}

const map = {} as google.maps.Map;

afterEach(() => {
  delete (globalThis as unknown as { google?: unknown }).google;
  vi.restoreAllMocks();
});

describe('naming a pin', () => {
  it('prefers the geocoder, shortened to an area and a city', async () => {
    installGoogle({
      geocode: {
        status: 'OK',
        results: [
          {
            place_id: 'place-1',
            formatted_address: 'Koramangala, Bengaluru, Karnataka 560034, India',
            address_components: [
              { long_name: 'Koramangala', short_name: 'Koramangala', types: ['neighborhood'] },
              { long_name: 'Bengaluru', short_name: 'Bengaluru', types: ['locality'] },
            ] as google.maps.GeocoderAddressComponent[],
          },
        ],
      },
    });

    await expect(reverseGeocode(PIN, map)).resolves.toEqual({
      status: 'named',
      label: 'Koramangala, Bengaluru',
      placeId: 'place-1',
    });
  });

  /**
   * A pin on Basaveshwaranagar came back as plain "Bengaluru". The first result
   * knew only the city; the area name was two rungs down the ladder, and only
   * the first rung was being read.
   */
  it('finds the area name even when it is not on the first result', async () => {
    installGoogle({
      geocode: {
        status: 'OK',
        results: [
          {
            place_id: 'plus-code',
            formatted_address: 'XQ8M+4V, Bengaluru, Karnataka 560079, India',
            address_components: [
              { long_name: 'Bengaluru', short_name: 'Bengaluru', types: ['locality'] },
            ] as google.maps.GeocoderAddressComponent[],
          },
          {
            place_id: 'area',
            formatted_address: 'Basaveshwara Nagar, Bengaluru, Karnataka, India',
            address_components: [
              {
                long_name: 'Basaveshwara Nagar',
                short_name: 'Basaveshwara Nagar',
                types: ['sublocality_level_1', 'sublocality', 'political'],
              },
              { long_name: 'Bengaluru', short_name: 'Bengaluru', types: ['locality'] },
            ] as google.maps.GeocoderAddressComponent[],
          },
        ],
      },
    });

    await expect(reverseGeocode(PIN, map)).resolves.toMatchObject({
      label: 'Basaveshwara Nagar, Bengaluru',
    });
  });

  /**
   * The city on its own tells you nothing a list of four pins can be told
   * apart by, which is the whole point of naming them.
   */
  it('prefers a full address over the bare city name', async () => {
    installGoogle({
      geocode: {
        status: 'OK',
        results: [
          {
            place_id: 'only-city',
            formatted_address: '4th Cross Rd, Kamakshipalya, Bengaluru, Karnataka 560079, India',
            address_components: [
              { long_name: 'Bengaluru', short_name: 'Bengaluru', types: ['locality'] },
            ] as google.maps.GeocoderAddressComponent[],
          },
        ],
      },
    });

    const result = await reverseGeocode(PIN, map);

    expect(result).toMatchObject({ label: '4th Cross Rd, Kamakshipalya, Bengaluru' });
  });

  it('falls back to the nearest place when the geocoder knows of nothing', async () => {
    installGoogle({
      geocode: { status: 'ZERO_RESULTS' },
      nearby: {
        status: 'OK',
        results: [{ vicinity: 'Sarjapur Road, Bengaluru', place_id: 'place-2' }],
      },
    });

    await expect(reverseGeocode(PIN, map)).resolves.toEqual({
      status: 'named',
      label: 'Sarjapur Road, Bengaluru',
      placeId: 'place-2',
    });
  });

  /**
   * The bug itself. Ranking by distance is only a legal request alongside a
   * keyword, name or type, and this search has none by design — so the old
   * request was rejected as INVALID_REQUEST every single time and the fallback
   * had never once produced a name.
   */
  it('asks for the nearest place in a way Google will accept', async () => {
    installGoogle({
      geocode: { status: 'ZERO_RESULTS' },
      nearby: { status: 'ZERO_RESULTS' },
    });

    await reverseGeocode(PIN, map);

    expect(nearbyRequests).toHaveLength(1);
    expect(nearbyRequests[0]).toMatchObject({ radius: expect.any(Number) });
    expect(nearbyRequests[0]?.rankBy).toBeUndefined();
  });

  it('reports a refused lookup as unavailable, naming the status', async () => {
    installGoogle({
      geocode: { status: 'REQUEST_DENIED' },
      nearby: { status: 'REQUEST_DENIED' },
    });

    const result = await reverseGeocode(PIN, map);

    expect(result.status).toBe('unavailable');
    // The screen shows this, and "REQUEST_DENIED" is what sends somebody to the
    // Cloud console to enable the API rather than to the network tab.
    expect(result).toMatchObject({ reason: expect.stringContaining('REQUEST_DENIED') });
  });

  /**
   * A pin in the middle of a lake has no name and never will. Saying so lets
   * the editor stop asking, where "unavailable" would have it retry forever.
   */
  it('separates nothing-here from could-not-ask', async () => {
    installGoogle({
      geocode: { status: 'ZERO_RESULTS' },
      nearby: { status: 'ZERO_RESULTS' },
    });

    await expect(reverseGeocode(PIN, map)).resolves.toEqual({ status: 'unnamed' });
  });

  it('is unavailable rather than empty when the map has not loaded', async () => {
    installGoogle({ geocode: { status: 'REQUEST_DENIED' } });

    const result = await reverseGeocode(PIN, null);

    expect(result.status).toBe('unavailable');
  });
});
