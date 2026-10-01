import { useEffect, useState } from 'react';

import { env } from '@/shared/config/env';
import type { CampaignParked } from '@/shared/types/domain';

import { loadGoogleMaps } from './loadGoogleMaps';
import { reverseGeocode } from './reverseGeocode';

/** Neighbourhood for a parked pin. Empty until the map answers. */
export function useParkedName(parked: CampaignParked | null | undefined): string | null {
  const [name, setName] = useState<string | null>(null);
  const lat = parked?.lat;
  const lng = parked?.lng;

  useEffect(() => {
    if (lat == null || lng == null) {
      setName(null);
      return;
    }

    let cancelled = false;
    setName(null);

    void (async () => {
      if (env.googleMapsApiKey) {
        try {
          await loadGoogleMaps(env.googleMapsApiKey);
        } catch {
          // The pin still draws; the label stays "this stop".
        }
      }
      if (cancelled) return;
      const result = await reverseGeocode({ lat, lng });
      if (cancelled || result.status !== 'named') return;
      const short = result.label.split(',')[0]?.trim();
      if (short) setName(short);
    })();

    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return name;
}
