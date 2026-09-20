import { useEffect, useRef, useState } from 'react';
import { env } from '@/shared/config/env';
import type { TripLeg } from '@/shared/types/domain';
import { loadGoogleMaps } from './loadGoogleMaps';

/**
 * One trip drawn as the pricing engine saw it (AC-25).
 *
 * A polyline per leg rather than one line for the journey, because the whole
 * question this screen answers is where the rate changed. A trip that enters
 * Prime, leaves it and comes back is three runs at two prices, and drawn in a
 * single colour it would look like one — which is exactly the claim an
 * advertiser is disputing when they get here.
 *
 * Held distance is drawn dashed rather than in a fourth colour: it was driven
 * through a real zone and is still shown in that zone's colour, because what
 * is in question is whether it counts, not where it was.
 */
const LEG_COLORS: Record<TripLeg['zone'], string> = {
  prime: '#b45309',
  secondary: '#1d4ed8',
  network: '#475569',
};

export function TripRouteMap({
  legs,
  selectedLeg,
  onSelectLeg,
}: {
  legs: TripLeg[];
  /** Index of the leg to emphasise, or null to show them evenly. */
  selectedLeg: number | null;
  onSelectLeg: (index: number | null) => void;
}) {
  const apiKey = env.googleMapsApiKey;
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const linesRef = useRef<google.maps.Polyline[]>([]);
  const endpointsRef = useRef<google.maps.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const onSelectRef = useRef(onSelectLeg);
  useEffect(() => {
    onSelectRef.current = onSelectLeg;
  }, [onSelectLeg]);

  useEffect(() => {
    if (!apiKey || !mapEl.current) return;

    let cancelled = false;

    void loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapEl.current) return;
        mapRef.current = new google.maps.Map(mapEl.current, {
          center: { lat: 12.9716, lng: 77.5946 },
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          clickableIcons: false,
        });
        mapRef.current.addListener('click', () => onSelectRef.current(null));
        setMapReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError('The map could not be loaded.');
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  /*
   * Redrawn wholesale when the trip changes, unlike the live map's markers.
   * A trip is a finished thing fetched once, so there is no poll to flicker
   * and nothing is gained by reconciling lines that have all been replaced.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    for (const line of linesRef.current) line.setMap(null);
    for (const marker of endpointsRef.current) marker.setMap(null);
    linesRef.current = [];
    endpointsRef.current = [];

    const bounds = new google.maps.LatLngBounds();

    legs.forEach((leg, index) => {
      const dimmed = selectedLeg !== null && selectedLeg !== index;
      const held = leg.state !== 'BILLABLE';
      const path = leg.path.map((point) => ({ lat: point.lat, lng: point.lng }));
      for (const point of path) bounds.extend(point);

      const line = new google.maps.Polyline({
        map,
        path,
        strokeColor: LEG_COLORS[leg.zone],
        strokeOpacity: held ? 0 : dimmed ? 0.3 : 1,
        strokeWeight: selectedLeg === index ? 8 : 5,
        zIndex: selectedLeg === index ? 3 : 1,
        ...(held
          ? {
              icons: [
                {
                  icon: { path: 'M 0,-1 0,1', strokeOpacity: dimmed ? 0.35 : 1, scale: 4 },
                  offset: '0',
                  repeat: '14px',
                },
              ],
            }
          : {}),
      });

      line.addListener('click', () => onSelectRef.current(index));
      linesRef.current.push(line);
    });

    const start = legs.at(0)?.path.at(0);
    const finish = legs.at(-1)?.path.at(-1);

    for (const [point, label] of [
      [start, 'Start'],
      [finish, 'End'],
    ] as const) {
      if (!point) continue;
      endpointsRef.current.push(
        new google.maps.Marker({
          map,
          position: { lat: point.lat, lng: point.lng },
          title: label,
          zIndex: 4,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: label === 'Start' ? '#16a34a' : '#0f172a',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        }),
      );
    }

    if (!bounds.isEmpty()) map.fitBounds(bounds, 48);
  }, [mapReady, legs, selectedLeg]);

  useEffect(() => {
    const lines = linesRef;
    const markers = endpointsRef;
    return () => {
      for (const line of lines.current) line.setMap(null);
      for (const marker of markers.current) marker.setMap(null);
    };
  }, []);

  if (!apiKey) {
    return (
      <div className="grid h-full min-h-[26rem] place-items-center rounded-xl bg-slate-50 px-6 text-center">
        <p className="text-[13px] text-slate-600">
          Add <code className="rounded bg-white px-1">VITE_GOOGLE_MAPS_API_KEY</code> to replay the
          route on a map. The zone breakdown below does not need it.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[26rem]">
      <div
        ref={mapEl}
        className="absolute inset-0 rounded-xl bg-slate-100"
        role="region"
        aria-label="Trip route by zone"
      />
      {loadError ? (
        <p className="shadow-card absolute inset-x-4 bottom-4 rounded-lg bg-white/95 px-3 py-2 text-[12px] text-rose-600">
          {loadError}
        </p>
      ) : null}
    </div>
  );
}
