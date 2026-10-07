/**
 * The city name to store from a Google Places result.
 *
 * Autocomplete can return a neighbourhood, a locality or an admin area. The
 * campaign and the fleet list match on the city string, so we prefer locality
 * (Bengaluru, not Indiranagar) and fall back only when Google did not send one.
 */

export function cityFromPlace(place: {
  name?: string;
  formatted_address?: string;
  address_components?: Array<{ long_name: string; types: string[] }>;
}): string {
  const components = place.address_components ?? [];
  const pick = (type: string) => components.find((row) => row.types.includes(type))?.long_name;

  return (
    pick('locality') ||
    pick('administrative_area_level_2') ||
    pick('postal_town') ||
    place.name ||
    place.formatted_address?.split(',')[0]?.trim() ||
    ''
  );
}
