import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { env } from '@/shared/config/env';
import { cityCenter } from './cities';
import { loadGoogleMaps } from './loadGoogleMaps';
import type { ZonePolygons, ZoneTier } from './types';
import { ZONE_MAP_COLORS } from './zoneColors';

export interface FleetMapPin {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  kind: 'CAB' | 'AUTO';
  /** Draw it back: on this map it exists, but it is not for sale. */
  muted?: boolean;
}

const MARKER: Record<FleetMapPin['kind'], string> = {
  CAB: '#4c46c7',
  AUTO: '#d97706',
};

const TIERS: ZoneTier[] = ['prime', 'secondary'];

/**
 * Operating pins for the advertiser fleet browse. These are onboard locations,
 * not live GPS — so the map is a supply picture, not a tracking view.
 *
 * `outlines` draws the campaign's own Prime and Secondary zones underneath the
 * pins. Read-only: the zones are edited on the map above, and a second editable
 * copy of the same shape is two places to drag a corner and one of them wrong.
 */
export function FleetMap({
  pins,
  selectedId,
  onSelect,
  city = 'Bengaluru',
  outlines,
}: {
  pins: FleetMapPin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  city?: string;
  outlines?: ZonePolygons;
}) {
  const apiKey = env.googleMapsApiKey;
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const shapesRef = useRef<google.maps.Polygon[]>([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

    for (const shape of shapesRef.current) shape.setMap(null);
    shapesRef.current = [];

    for (const tier of TIERS) {
      const path = outlines?.[tier]?.path ?? [];
      if (path.length < 3) continue;
      const colour = ZONE_MAP_COLORS[tier];
      shapesRef.current.push(
        new google.maps.Polygon({
          map,
          paths: path,
          strokeColor: colour.stroke,
          strokeWeight: 2,
          fillColor: colour.fill,
          fillOpacity: 0.18,
          clickable: false,
          zIndex: 0,
        }),
      );
    }
  }, [mapReady, outlines]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    for (const marker of markersRef.current.values()) marker.setMap(null);
    markersRef.current.clear();

    const bounds = new google.maps.LatLngBounds();

    for (const pin of pins) {
      const selected = pin.id === selectedId;
      const marker = new google.maps.Marker({
        map,
        position: { lat: pin.lat, lng: pin.lng },
        title: pin.title,
        zIndex: selected ? 3 : pin.muted ? 1 : 2,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: selected ? 12 : 8,
          fillColor: MARKER[pin.kind],
          fillOpacity: pin.muted && !selected ? 0.35 : 1,
          strokeColor: '#ffffff',
          strokeWeight: selected ? 3 : 2,
        },
      });
      marker.addListener('click', () => {
        onSelect(pin.id);
        infoRef.current?.setContent(
          `<div style="font:13px/1.4 Inter,system-ui,sans-serif;padding:2px 0">
             <strong>${escapeHtml(pin.title)}</strong>
             <div style="color:#64748b;margin-top:2px">${escapeHtml(pin.subtitle)}</div>
           </div>`,
        );
        infoRef.current?.open({ map, anchor: marker });
      });
      markersRef.current.set(pin.id, marker);
      bounds.extend(marker.getPosition()!);
    }

    /*
     * Fit to the zones as well as the pins when there are zones. Framing on
     * the pins alone shows a buyer the vehicles without the outline they drew
     * them from, which is the one comparison this map exists to make.
     */
    for (const tier of TIERS) {
      for (const point of outlines?.[tier]?.path ?? []) bounds.extend(point);
    }

    const only = pins.length === 1 && bounds.getNorthEast().equals(bounds.getSouthWest());
    if (only && pins[0]) {
      map.setCenter({ lat: pins[0].lat, lng: pins[0].lng });
      map.setZoom(14);
    } else if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 64);
    }

    if (selectedId) {
      const marker = markersRef.current.get(selectedId);
      const pin = pins.find((row) => row.id === selectedId);
      if (marker && pin) {
        map.panTo({ lat: pin.lat, lng: pin.lng });
        infoRef.current?.setContent(
          `<div style="font:13px/1.4 Inter,system-ui,sans-serif;padding:2px 0">
             <strong>${escapeHtml(pin.title)}</strong>
             <div style="color:#64748b;margin-top:2px">${escapeHtml(pin.subtitle)}</div>
           </div>`,
        );
        infoRef.current?.open({ map, anchor: marker });
      }
    } else {
      infoRef.current?.close();
    }
  }, [mapReady, onSelect, outlines, pins, selectedId]);

  useEffect(() => {
    const shapes = shapesRef;
    const markers = markersRef;
    return () => {
      for (const shape of shapes.current) shape.setMap(null);
      shapes.current = [];
      for (const marker of markers.current.values()) marker.setMap(null);
      markers.current.clear();
    };
  }, []);

  if (!apiKey) {
    return (
      <div className="flex h-full min-h-[22rem] items-center justify-center rounded-xl bg-slate-50 px-6 text-center">
        <p className="text-[13px] text-slate-600">
          Add <code className="rounded bg-white px-1">VITE_GOOGLE_MAPS_API_KEY</code> to show
          vehicle locations on the map.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[22rem]">
      <div
        ref={mapEl}
        className="absolute inset-0 bg-slate-100"
        role="region"
        aria-label="Available vehicle locations"
      />
      {loadError ? (
        <p className="absolute inset-x-4 bottom-4 rounded-lg bg-white/95 px-3 py-2 text-[12px] text-rose-600 shadow-card">
          {loadError}
        </p>
      ) : pins.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[12px] text-slate-500 shadow-card">
            <MapPin className="size-3.5" aria-hidden />
            Vehicles appear here once operations onboards a driver with a pin
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
