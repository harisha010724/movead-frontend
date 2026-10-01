export const PARKED_NEARBY_METRES = 100;

export interface NearbyPlace {
  name: string;
  kind: string;
  lat: number;
  lng: number;
  metres: number;
}

type LatLng = { lat: number; lng: number };

const KIND_LABEL: Record<string, string> = {
  shopping_mall: 'Mall',
  department_store: 'Mall',
  supermarket: 'Shop',
  grocery_or_supermarket: 'Shop',
  store: 'Shop',
  restaurant: 'Restaurant',
  cafe: 'Cafe',
  subway_station: 'Transit',
  train_station: 'Transit',
  transit_station: 'Transit',
  bus_station: 'Transit',
  parking: 'Parking',
  school: 'School',
  hospital: 'Hospital',
  park: 'Park',
  bank: 'Bank',
  atm: 'ATM',
  gas_station: 'Fuel',
};

/**
 * Named places inside the parked pin's 100 m. Distance is measured here, not
 * trusted from the search radius, so a result Google returns a few metres
 * outside the circle is dropped rather than shown as "nearby".
 */
export async function nearbyPlacesWithin(
  point: LatLng,
  radiusM: number = PARKED_NEARBY_METRES,
): Promise<NearbyPlace[]> {
  if (typeof google === 'undefined' || !google.maps?.places?.PlacesService) return [];

  const attribution = document.createElement('div');
  const service = new google.maps.places.PlacesService(attribution);

  const results = await new Promise<google.maps.places.PlaceResult[] | null>((resolve) => {
    service.nearbySearch({ location: point, radius: radiusM }, (places, status) => {
      resolve(String(status) === 'OK' ? (places ?? []) : []);
    });
  });

  const nearby: NearbyPlace[] = [];
  for (const place of results ?? []) {
    const name = place.name?.trim();
    const at = latLngOf(place);
    if (!name || !at) continue;
    const metres = metresBetween(point, at);
    if (metres > radiusM) continue;
    nearby.push({
      name,
      kind: kindOf(place.types ?? []),
      lat: at.lat,
      lng: at.lng,
      metres,
    });
  }

  return nearby.sort((left, right) => left.metres - right.metres).slice(0, 8);
}

export function metresBetween(a: LatLng, b: LatLng): number {
  const earth = 6_371_000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sin =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(sin)));
}

function kindOf(types: string[]): string {
  for (const type of types) {
    const label = KIND_LABEL[type];
    if (label) return label;
  }
  return 'Place';
}

function latLngOf(place: google.maps.places.PlaceResult): LatLng | null {
  const loc = place.geometry?.location;
  if (!loc) return null;
  const lat = typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat);
  const lng = typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
