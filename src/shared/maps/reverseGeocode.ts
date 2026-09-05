import { importLibrary } from '@googlemaps/js-api-loader';

type LatLng = { lat: number; lng: number };

/**
 * Three outcomes, not two.
 *
 * "There is no named place at this pin" and "the lookup never ran" look
 * identical to a caller that only gets a name or a null, and the screen then
 * has to choose one story to tell about both. It picked the wrong one: a pin
 * whose lookup had failed sat under "Looking up location…" permanently, so a
 * dead Geocoding key was indistinguishable from a slow network, forever.
 */
export type ReverseGeocode =
  | { status: 'named'; label: string; placeId: string }
  /** The services answered and there is genuinely nothing here to name. */
  | { status: 'unnamed' }
  /** The lookup could not run. `reason` names the API to enable. */
  | { status: 'unavailable'; reason: string };

/**
 * Name for a dropped pin. Prefers the Geocoder, which is the service built for
 * turning a coordinate into a street or neighbourhood, then falls back to the
 * nearest Place so drawing a zone over somewhere unaddressed still lists
 * something recognisable.
 */
export async function reverseGeocode(
  point: LatLng,
  map?: google.maps.Map | null,
): Promise<ReverseGeocode> {
  const geocoded = await geocodePoint(point);
  if (geocoded.status === 'named') return geocoded;

  const place = await nearbyPlace(point, map);
  if (place.status === 'named') return place;

  // A real "nothing here" from either service beats an availability complaint
  // from the other: the caller can stop asking.
  if (geocoded.status === 'unnamed' || place.status === 'unnamed') return { status: 'unnamed' };
  return geocoded;
}

/**
 * `Geocoder` arrives with the `geocoding` library, which `loadGoogleMaps`
 * requests but tolerates failing. Asking for it again here costs nothing when
 * it is already in — `importLibrary` caches — and turns a silently absent
 * constructor into a reason we can show.
 */
async function geocoderService(): Promise<google.maps.Geocoder | null> {
  if (typeof google !== 'undefined' && google.maps?.Geocoder) return new google.maps.Geocoder();

  try {
    const lib = await importLibrary('geocoding');
    return new lib.Geocoder();
  } catch {
    return null;
  }
}

async function geocodePoint(point: LatLng): Promise<ReverseGeocode> {
  const service = await geocoderService();
  if (!service) {
    return { status: 'unavailable', reason: 'the Maps geocoding library did not load' };
  }

  return new Promise((resolve) => {
    void service.geocode({ location: point }, (results, status) => {
      const hit = status === 'OK' ? results?.[0] : undefined;
      if (hit && results) {
        resolve({ status: 'named', label: shortAddress(results), placeId: hit.place_id ?? '' });
        return;
      }
      if (status === 'ZERO_RESULTS') {
        resolve({ status: 'unnamed' });
        return;
      }
      // REQUEST_DENIED here almost always means the Geocoding API is not
      // enabled on the key, which is worth saying rather than swallowing.
      resolve({ status: 'unavailable', reason: `the Geocoding API answered ${status}` });
    });
  });
}

async function nearbyPlace(point: LatLng, map?: google.maps.Map | null): Promise<ReverseGeocode> {
  if (!map || typeof google === 'undefined' || !google.maps.places?.PlacesService) {
    return { status: 'unavailable', reason: 'the Places library is not loaded' };
  }

  return new Promise((resolve) => {
    const service = new google.maps.places.PlacesService(map);
    /*
     * `radius`, not `rankBy: DISTANCE`. Ranking by distance is only a legal
     * request when it is accompanied by a `keyword`, `name` or `type`, and this
     * search deliberately has none of those — it wants whatever is closest,
     * whatever it is. Without one Google rejects the call as INVALID_REQUEST,
     * which is why this fallback had never once produced a name.
     */
    service.nearbySearch({ location: point, radius: 200 }, (results, status) => {
      const code = String(status);
      const place = code === 'OK' ? results?.[0] : undefined;
      if (place) {
        resolve({
          status: 'named',
          label: place.vicinity || place.name || '',
          placeId: place.place_id ?? '',
        });
        return;
      }
      if (code === 'ZERO_RESULTS') {
        resolve({ status: 'unnamed' });
        return;
      }
      resolve({ status: 'unavailable', reason: `the Places API answered ${code}` });
    });
  });
}

/**
 * The name a person would use for this spot.
 *
 * A reverse geocode does not return one answer, it returns a ladder of them —
 * a street address, then the road, then the neighbourhood, then the city, each
 * a separate entry. Reading only the first rung is why a pin dropped on
 * Basaveshwaranagar came back as "Bengaluru": that first result carried no
 * locality finer than the city, and the area name was sitting two rungs down.
 *
 * So the components are gathered across every rung and the finest available
 * area wins. They all describe the same point, so there is no risk of borrowing
 * a neighbourhood from somewhere else.
 */
function shortAddress(results: google.maps.GeocoderResult[]): string {
  const parts = results.flatMap((result) => result.address_components ?? []);
  const pick = (type: string) => parts.find((part) => part.types.includes(type))?.long_name;

  const area =
    pick('neighborhood') ||
    pick('sublocality_level_1') ||
    pick('sublocality_level_2') ||
    pick('sublocality') ||
    pick('route');
  const city = pick('locality') || pick('postal_town');

  if (area && city && area !== city) return `${area}, ${city}`;
  if (area) return area;

  /*
   * Falling back to the bare city is a last resort, not a second choice. It is
   * the least useful thing that is still true, and on a screen listing four
   * pins it makes them indistinguishable — which is exactly the complaint that
   * produced this function. The full address, trimmed of the state and country
   * nobody needs told, is worse-looking and far more informative.
   */
  const address = results[0]?.formatted_address
    ?.replace(/,\s*[A-Za-z ]+\s*\d{6}(?=,|$)/, '')
    .replace(/, India$/i, '')
    .trim();
  if (address) return address;

  return city ?? '';
}
