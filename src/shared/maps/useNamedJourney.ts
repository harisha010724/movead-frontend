import { useEffect, useMemo, useState } from 'react';

import { env } from '@/shared/config/env';
import type { CampaignTripDetail } from '@/shared/types/domain';

import { loadGoogleMaps } from './loadGoogleMaps';
import { nameJourneyStops } from './nameJourneyStops';
import { journeyOf, type JourneyStop } from './tripJourney';

export function useNamedJourney(detail: CampaignTripDetail | undefined): JourneyStop[] {
  const built = useMemo(() => (detail ? journeyOf(detail) : []), [detail]);
  const [stops, setStops] = useState<JourneyStop[]>(built);

  useEffect(() => {
    setStops(built);
    if (built.length === 0) return;

    let cancelled = false;

    void (async () => {
      if (env.googleMapsApiKey) {
        try {
          await loadGoogleMaps(env.googleMapsApiKey);
        } catch {
          // The route still draws; stops keep their fallback names.
        }
      }
      if (cancelled) return;
      const named = await nameJourneyStops(built);
      if (!cancelled) setStops(named);
    })();

    return () => {
      cancelled = true;
    };
  }, [built]);

  return stops;
}
