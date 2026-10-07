/** Default map centre for known cities, plus any city the advertiser just picked. */

export const CITY_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  Bengaluru: { lat: 12.9716, lng: 77.5946, zoom: 12 },
  Bangalore: { lat: 12.9716, lng: 77.5946, zoom: 12 },
  Mumbai: { lat: 19.076, lng: 72.8777, zoom: 12 },
  Delhi: { lat: 28.6139, lng: 77.209, zoom: 12 },
  'New Delhi': { lat: 28.6139, lng: 77.209, zoom: 12 },
  Hyderabad: { lat: 17.385, lng: 78.4867, zoom: 12 },
  Chennai: { lat: 13.0827, lng: 80.2707, zoom: 12 },
  Kolkata: { lat: 22.5726, lng: 88.3639, zoom: 12 },
  Pune: { lat: 18.5204, lng: 73.8567, zoom: 12 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714, zoom: 12 },
  Jaipur: { lat: 26.9124, lng: 75.7873, zoom: 12 },
  Coimbatore: { lat: 11.0168, lng: 76.9558, zoom: 12 },
};

const remembered = new Map<string, { lat: number; lng: number; zoom: number }>();

export function rememberCityCenter(city: string, lat: number, lng: number): void {
  remembered.set(city, { lat, lng, zoom: 12 });
}

export function cityCenter(city: string): { lat: number; lng: number; zoom: number } {
  return (
    remembered.get(city) ??
    CITY_CENTERS[city] ??
    CITY_CENTERS.Bengaluru ?? { lat: 12.9716, lng: 77.5946, zoom: 12 }
  );
}
