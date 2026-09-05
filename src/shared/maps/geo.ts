export interface LatLng {
  lat: number;
  lng: number;
}

export function pointInPolygon(point: LatLng, path: LatLng[]): boolean {
  if (path.length < 3) return false;

  let inside = false;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const a = path[i];
    const b = path[j];
    if (!a || !b) continue;

    const crosses =
      a.lat > point.lat !== b.lat > point.lat &&
      point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng;

    if (crosses) inside = !inside;
  }

  return inside;
}

export function zoneForPoint(
  point: LatLng,
  polygons: Partial<Record<'prime' | 'secondary', { path: LatLng[] }>>,
): 'prime' | 'secondary' | null {
  if (polygons.prime && pointInPolygon(point, polygons.prime.path)) return 'prime';
  if (polygons.secondary && pointInPolygon(point, polygons.secondary.path)) return 'secondary';
  return null;
}
