/** Default map centre for each pilot city. */
export const CITY_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  Bengaluru: { lat: 12.9716, lng: 77.5946, zoom: 12 },
};

export function cityCenter(city: string): { lat: number; lng: number; zoom: number } {
  return CITY_CENTERS[city] ?? CITY_CENTERS.Bengaluru ?? { lat: 12.9716, lng: 77.5946, zoom: 12 };
}
