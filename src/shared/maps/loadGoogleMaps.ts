import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

let loading: Promise<void> | null = null;

/**
 * Loads Maps, Places and Drawing once per page. The campaign form and a later
 * live-tracking view share this so the SDK is not downloaded twice.
 */
export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (!loading) {
    setOptions({ key: apiKey, v: 'weekly' });
    loading = Promise.all([
      importLibrary('maps'),
      importLibrary('places'),
      importLibrary('geocoding').catch(() => undefined),
    ]).then(() => undefined);
  }
  return loading;
}
