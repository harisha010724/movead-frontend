import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { env } from '@/shared/config/env';
import { formatRegistration, formatRelative } from '@/shared/format';
import { liveStateLabel, liveStateMarker } from '@/shared/ui/liveState';
import type { LivePosition } from '@/shared/types/domain';
import { cityCenter } from './cities';
import { loadGoogleMaps } from './loadGoogleMaps';

/**
 * Live GPS positions on a real map, as distinct from `FleetMap`, which plots
 * the fixed onboarding pin of every vehicle available to book. This one moves.
 *
 * Two things follow from it moving, and both are why this is not `FleetMap`
 * with different colours:
 *
 * - Markers are updated in place, keyed by plate, instead of being cleared and
 *   rebuilt. A poll arrives every ten seconds and rebuilding made the whole
 *   fleet blink on each one, including the marker someone had just clicked.
 * - The view is framed once and then left alone. Refitting bounds on each poll
 *   pulled the map back out from under anyone who had zoomed in on a vehicle,
 *   every ten seconds, which made following one impossible.
 */
export function LiveFleetMap({
  positions,
  selectedRef,
  onSelect,
  city = 'Bengaluru',
}: {
  positions: LivePosition[];
  /** The plate to centre on and highlight, or null to show the fleet. */
  selectedRef: string | null;
  onSelect: (vehicleRef: string | null) => void;
  city?: string;
}) {
  const apiKey = env.googleMapsApiKey;
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const framedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  /*
   * Held in a ref so the marker click handlers, which are attached once per
   * marker, always call the current callback without having to be rebound —
   * rebinding them is what forces the teardown this component exists to avoid.
   */
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!apiKey || !mapEl.current) return;

    let cancelled = false;

    void loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapEl.current) return;
        const origin = cityCenter(city);
        mapRef.current = new google.maps.Map(mapEl.current, {
          center: { lat: origin.lat, lng: origin.lng },
          zoom: origin.zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
        });
        infoRef.current = new google.maps.InfoWindow();
        // Clicking the tiles clears the selection, which is the way out of a
        // search someone has finished with without reaching for the input.
        mapRef.current.addListener('click', () => onSelectRef.current(null));
        setMapReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError('The map could not be loaded.');
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, city]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    const live = new Set(positions.map((position) => position.vehicleRef));

    // A vehicle that has left the campaign stops being reported. Its marker
    // has to go with it, or the map accumulates vehicles nobody is running.
    for (const [ref, marker] of markersRef.current) {
      if (!live.has(ref)) {
        marker.setMap(null);
        markersRef.current.delete(ref);
      }
    }

    for (const position of positions) {
      const selected = position.vehicleRef === selectedRef;
      const at = { lat: position.lat, lng: position.lon };
      const icon: google.maps.Symbol = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: selected ? 12 : 7,
        fillColor: liveStateMarker(position.state),
        fillOpacity: selectedRef && !selected ? 0.4 : 1,
        strokeColor: '#ffffff',
        strokeWeight: selected ? 3 : 2,
      };

      const existing = markersRef.current.get(position.vehicleRef);

      if (existing) {
        existing.setPosition(at);
        existing.setIcon(icon);
        existing.setZIndex(selected ? 3 : 2);
        continue;
      }

      const marker = new google.maps.Marker({
        map,
        position: at,
        title: formatRegistration(position.vehicleRef),
        zIndex: selected ? 3 : 2,
        icon,
      });
      marker.addListener('click', () => onSelectRef.current(position.vehicleRef));
      markersRef.current.set(position.vehicleRef, marker);
    }

    /*
     * Frame the fleet once. `framedRef` is not reset on a later poll, so the
     * map holds wherever it was left; it resets only when there was nothing
     * to frame, so an empty first answer does not cost the framing entirely.
     */
    if (!framedRef.current && positions.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      for (const position of positions) bounds.extend({ lat: position.lat, lng: position.lon });

      if (positions.length === 1) {
        map.setCenter(bounds.getCenter());
        map.setZoom(15);
      } else {
        map.fitBounds(bounds, 48);
      }
      framedRef.current = true;
    }
  }, [mapReady, positions, selectedRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (!selectedRef) {
      infoRef.current?.close();
      return;
    }

    const marker = markersRef.current.get(selectedRef);
    const position = positions.find((row) => row.vehicleRef === selectedRef);
    if (!marker || !position) return;

    map.panTo({ lat: position.lat, lng: position.lon });
    // Only close in, never back out: someone who has zoomed further than this
    // to read a street has done so on purpose.
    if ((map.getZoom() ?? 0) < 14) map.setZoom(15);

    infoRef.current?.setContent(
      `<div style="font:13px/1.5 Inter,system-ui,sans-serif;padding:2px 0">
         <strong>${escapeHtml(formatRegistration(position.vehicleRef))}</strong>
         <div style="color:#64748b;margin-top:2px">
           ${escapeHtml(liveStateLabel(position.state))} ·
           ${escapeHtml(formatRelative(position.updatedAt))}
         </div>
       </div>`,
    );
    infoRef.current?.open({ map, anchor: marker });
  }, [mapReady, positions, selectedRef]);

  useEffect(() => {
    const markers = markersRef;
    return () => {
      for (const marker of markers.current.values()) marker.setMap(null);
      markers.current.clear();
    };
  }, []);

  if (!apiKey) {
    return (
      <div className="grid h-full min-h-[22rem] place-items-center rounded-xl bg-slate-50 px-6 text-center">
        <p className="text-[13px] text-slate-600">
          Add <code className="rounded bg-white px-1">VITE_GOOGLE_MAPS_API_KEY</code> to show live
          vehicle positions on the map.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[22rem]">
      <div
        ref={mapEl}
        className="absolute inset-0 rounded-xl bg-slate-100"
        role="region"
        aria-label="Live vehicle positions"
      />
      {loadError ? (
        <p className="shadow-card absolute inset-x-4 bottom-4 rounded-lg bg-white/95 px-3 py-2 text-[12px] text-rose-600">
          {loadError}
        </p>
      ) : positions.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="shadow-card flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[12px] text-slate-500">
            <MapPin className="size-3.5" aria-hidden />
            No vehicles to plot
          </p>
        </div>
      ) : null}
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
