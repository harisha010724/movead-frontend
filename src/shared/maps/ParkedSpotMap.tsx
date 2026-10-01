import { useEffect, useRef, useState } from 'react';

import { env } from '@/shared/config/env';

import { loadGoogleMaps } from './loadGoogleMaps';
import { PARKED_NEARBY_METRES, type NearbyPlace } from './nearbyPlaces';

/**
 * The parked pin and whatever sits inside 100 m of it.
 *
 * A circle, not a route: this dialog answers "what was around the vehicle",
 * not how it got there.
 */
export function ParkedSpotMap({
  parked,
  nearby,
  focus,
  className = 'h-80',
}: {
  parked: { lat: number; lng: number; name: string };
  nearby: NearbyPlace[];
  /** Pan here when a place in the list is highlighted. */
  focus?: NearbyPlace | null;
  className?: string;
}) {
  const apiKey = env.googleMapsApiKey;
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<Array<{ setMap: (map: google.maps.Map | null) => void }>>([]);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey || !mapEl.current) return;

    let cancelled = false;

    void loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapEl.current) return;
        mapRef.current = new google.maps.Map(mapEl.current, {
          center: { lat: parked.lat, lng: parked.lng },
          zoom: 17,
          mapTypeControl: false,
          streetViewControl: false,
          clickableIcons: false,
        });
        setMapReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError('The map could not be loaded.');
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, parked.lat, parked.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    for (const overlay of overlaysRef.current) overlay.setMap(null);
    overlaysRef.current = [];

    const center = { lat: parked.lat, lng: parked.lng };
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(center);

    overlaysRef.current.push(
      new google.maps.Circle({
        map,
        center,
        radius: PARKED_NEARBY_METRES,
        strokeColor: '#0f172a',
        strokeOpacity: 0.35,
        strokeWeight: 1,
        fillColor: '#0f172a',
        fillOpacity: 0.06,
      }),
    );

    overlaysRef.current.push(
      new google.maps.Marker({
        map,
        position: center,
        title: parked.name,
        zIndex: 4,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#0f172a',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      }),
    );

    for (const place of nearby) {
      const position = { lat: place.lat, lng: place.lng };
      bounds.extend(position);
      overlaysRef.current.push(
        new google.maps.Marker({
          map,
          position,
          title: place.name,
          zIndex: 3,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: '#2563eb',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        }),
      );
    }

    map.fitBounds(bounds, 48);
  }, [mapReady, nearby, parked]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !focus) return;
    map.panTo({ lat: focus.lat, lng: focus.lng });
    if ((map.getZoom() ?? 0) < 18) map.setZoom(18);
  }, [focus, mapReady]);

  useEffect(() => {
    const overlays = overlaysRef;
    return () => {
      for (const overlay of overlays.current) overlay.setMap(null);
    };
  }, []);

  if (!apiKey) {
    return (
      <div className={`grid place-items-center rounded-xl bg-slate-50 px-6 text-center ${className}`}>
        <p className="text-[13px] text-slate-600">
          Add <code className="rounded bg-white px-1">VITE_GOOGLE_MAPS_API_KEY</code> to see the
          parked pin and what sat within 100 m.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div
        ref={mapEl}
        className="absolute inset-0 rounded-xl bg-slate-100"
        role="region"
        aria-label="Where the vehicle parked"
      />
      {loadError ? (
        <p className="shadow-card absolute inset-x-3 bottom-3 rounded-lg bg-white/95 px-3 py-2 text-[12px] text-rose-600">
          {loadError}
        </p>
      ) : null}
    </div>
  );
}
