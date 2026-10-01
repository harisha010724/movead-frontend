import { useEffect, useState } from 'react';

import { env } from '@/shared/config/env';
import type { CampaignParked } from '@/shared/types/domain';

import { loadGoogleMaps } from './loadGoogleMaps';
import { nearbyPlacesWithin, type NearbyPlace } from './nearbyPlaces';

/** Named places around a parked pin. Empty until the map answers. */
export function useNearbyPlaces(parked: CampaignParked | null | undefined): NearbyPlace[] {
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const lat = parked?.lat;
  const lng = parked?.lng;

  useEffect(() => {
    if (lat == null || lng == null) {
      setPlaces([]);
      return;
    }

    let cancelled = false;
    setPlaces([]);

    void (async () => {
      if (env.googleMapsApiKey) {
        try {
          await loadGoogleMaps(env.googleMapsApiKey);
        } catch {
          return;
        }
      }
      if (cancelled) return;
      const found = await nearbyPlacesWithin({ lat, lng });
      if (!cancelled) setPlaces(found);
    })();

    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return places;
}
