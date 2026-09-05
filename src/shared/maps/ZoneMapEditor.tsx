import { useEffect, useRef, useState } from 'react';
import { MapPin, Pentagon, Trash2, Undo2 } from 'lucide-react';
import { env } from '@/shared/config/env';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui';
import { FormError } from '@/shared/ui/form';
import { cityCenter } from './cities';
import { loadGoogleMaps } from './loadGoogleMaps';
import { reverseGeocode } from './reverseGeocode';
import type { CampaignLocation, ZonePolygons, ZoneTier } from './types';
import { ZONE_MAP_COLORS } from './zoneColors';

const TIERS: { tier: ZoneTier; label: string }[] = [
  { tier: 'prime', label: 'Prime' },
  { tier: 'secondary', label: 'Secondary' },
];

type LatLng = { lat: number; lng: number };

/** Only tracked for pins still carrying their generated `Prime pin 2` label. */
type LookupState = 'looking' | 'unnamed' | 'unavailable';

/** A vehicle sitting inside the drawn zones, shown on the same map. */
export interface ZoneVehiclePin {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  kind: 'CAB' | 'AUTO';
  /** Draw it back: it is in the zone, but it cannot be ordered. */
  muted?: boolean;
}

const VEHICLE_COLOUR: Record<ZoneVehiclePin['kind'], string> = {
  CAB: '#4c46c7',
  AUTO: '#d97706',
};

/**
 * A teardrop, so a vehicle cannot be mistaken for a zone corner.
 *
 * Corners are flat circles in the tier colour and are draggable; these are not.
 * Sharing a shape between the thing you are drawing and the thing you are
 * buying would invite dragging a vehicle into the outline.
 */
const TEARDROP =
  'M 0,0 C -2.2,-7 -8,-9.5 -8,-15.5 A 8,8 0 1,1 8,-15.5 C 8,-9.5 2.2,-7 0,0 z';

/**
 * Click the map to drop corners. The line grows as you pin. Once there are
 * three corners the fill appears and you can drag a corner or the midpoint of
 * a side to add another point — all on the map, no Finish step.
 *
 * `vehicles` are drawn on the same map as the outlines that selected them.
 * Two maps — one to draw the zone, one to see who is in it — would mean
 * checking your own work by looking away from it.
 */
export function ZoneMapEditor({
  city,
  locations,
  polygons,
  onLocationsChange,
  onPolygonsChange,
  error,
  vehicles,
  selectedVehicleId,
  onVehicleSelect,
  mapClassName,
}: {
  city: string;
  locations: CampaignLocation[];
  polygons: ZonePolygons;
  onLocationsChange: (next: CampaignLocation[]) => void;
  onPolygonsChange: (next: ZonePolygons) => void;
  error?: string;
  vehicles?: ZoneVehiclePin[];
  selectedVehicleId?: string | null;
  onVehicleSelect?: (id: string) => void;
  /** The height the map is given. The caller knows how much room it has. */
  mapClassName?: string;
}) {
  const apiKey = env.googleMapsApiKey;
  const mapEl = useRef<HTMLDivElement>(null);
  const searchEl = useRef<HTMLInputElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const vehicleMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const vehicleInfoRef = useRef<google.maps.InfoWindow | null>(null);
  const shapesRef = useRef<Partial<Record<ZoneTier, google.maps.Polygon>>>( {});
  const lineRef = useRef<google.maps.Polyline | null>(null);
  const vertexMarkersRef = useRef<google.maps.Marker[]>([]);
  const pathListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const locationsRef = useRef(locations);
  const polygonsRef = useRef(polygons);
  const onPolygonsChangeRef = useRef(onPolygonsChange);
  const onLocationsChangeRef = useRef(onLocationsChange);
  const [tier, setTier] = useState<ZoneTier>('prime');
  const tierRef = useRef(tier);
  const [mapReady, setMapReady] = useState(false);
  /** Framed once per map instance; after that the view is the user's. */
  const fittedRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lookupTimers = useRef<Map<string, number>>(new Map());
  /**
   * Only pins without a name of their own appear here. A pin that has been
   * named carries it on `label`, so the absence of an entry is the success
   * case and nothing has to be cleaned up when one resolves.
   */
  const [lookups, setLookups] = useState<Record<string, LookupState>>({});
  const [lookupProblem, setLookupProblem] = useState<string | null>(null);
  /** Pins already sent for a lookup, so an unrelated edit does not re-ask. */
  const askedRef = useRef<Set<string>>(new Set());

  locationsRef.current = locations;
  polygonsRef.current = polygons;
  onPolygonsChangeRef.current = onPolygonsChange;
  onLocationsChangeRef.current = onLocationsChange;
  tierRef.current = tier;

  function scheduleLookup(id: string, point: LatLng): void {
    const previous = lookupTimers.current.get(id);
    if (previous) window.clearTimeout(previous);
    askedRef.current.add(id);
    setLookups((current) => ({ ...current, [id]: 'looking' }));
    lookupTimers.current.set(
      id,
      window.setTimeout(() => {
        lookupTimers.current.delete(id);
        void reverseGeocode(point, mapRef.current).then((found) => {
          const current = locationsRef.current.find((row) => row.id === id);
          if (!current) return;
          // The pin moved while the answer was in the air; a later lookup owns
          // it now and this name belongs to somewhere else.
          if (!almostSame({ lat: current.lat, lng: current.lng }, point)) return;

          if (found.status !== 'named' || !found.label) {
            setLookups((rows) => ({
              ...rows,
              [id]: found.status === 'unnamed' ? 'unnamed' : 'unavailable',
            }));
            if (found.status === 'unavailable') setLookupProblem(found.reason);
            return;
          }

          setLookups((rows) => {
            const { [id]: _done, ...rest } = rows;
            return rest;
          });
          onLocationsChangeRef.current(
            locationsRef.current.map((row) =>
              row.id === id
                ? { ...row, label: found.label, placeId: found.placeId || row.placeId }
                : row,
            ),
          );
        });
      }, 350),
    );
  }

  const scheduleLookupRef = useRef(scheduleLookup);
  scheduleLookupRef.current = scheduleLookup;

  const activePath = polygons[tier]?.path ?? [];

  useEffect(() => {
    return () => {
      for (const timer of lookupTimers.current.values()) window.clearTimeout(timer);
      lookupTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    for (const item of locations) {
      if (!isGenericLabel(item.label)) continue;
      // Already asked about this one. Dropping and dragging a pin call
      // `scheduleLookup` directly, so re-asking here on every unrelated edit
      // would only re-run lookups that have already come back empty.
      if (askedRef.current.has(item.id)) continue;
      scheduleLookupRef.current(item.id, { lat: item.lat, lng: item.lng });
    }
  }, [locations, mapReady]);

  /** Nothing on the map has changed, so this only re-asks the unnamed pins. */
  function retryLookups(): void {
    setLookupProblem(null);
    for (const item of locationsRef.current) {
      if (!isGenericLabel(item.label)) continue;
      scheduleLookupRef.current(item.id, { lat: item.lat, lng: item.lng });
    }
  }

  useEffect(() => {
    if (!apiKey || !mapEl.current) return;

    let cancelled = false;

    void loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapEl.current) return;

        const origin = cityCenter(city);
        const map = new google.maps.Map(mapEl.current, {
          center: origin,
          zoom: origin.zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          draggableCursor: 'crosshair',
        });
        mapRef.current = map;
        setMapReady(true);

        if (searchEl.current) {
          const autocomplete = new google.maps.places.Autocomplete(searchEl.current, {
            fields: ['place_id', 'formatted_address', 'name', 'geometry'],
            componentRestrictions: { country: 'in' },
          });
          autocomplete.bindTo('bounds', map);
          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            const loc = place.geometry?.location;
            if (!loc) return;
            const next: CampaignLocation = {
              id: crypto.randomUUID(),
              placeId: place.place_id ?? '',
              label: place.formatted_address || place.name || 'Selected location',
              lat: loc.lat(),
              lng: loc.lng(),
              tier: tierRef.current,
            };
            onLocationsChangeRef.current([...locationsRef.current, next]);
            addCorner(loc.lat(), loc.lng());
            map.panTo(loc);
            if ((map.getZoom() ?? 12) < 14) map.setZoom(14);
            if (searchEl.current) searchEl.current.value = '';
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(
            'Google Maps could not load. Check the API key and that Maps JavaScript API and Places API are enabled.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (locations.length > 0 || activePath.length > 0) return;
    const origin = cityCenter(city);
    map.panTo(origin);
    map.setZoom(origin.zoom);
  }, [city, mapReady, locations.length, activePath.length]);

  /**
   * Frame whatever has already been drawn, once, when the map appears.
   *
   * A fresh map opens on the city centre, which is only the right answer for a
   * blank campaign. Moving the editor between the page and the expanded dialog
   * builds a new map around work that already exists, and opening it on a view
   * that does not contain that work reads as having lost it.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || fittedRef.current) return;

    const bounds = new google.maps.LatLngBounds();
    for (const item of locationsRef.current) bounds.extend({ lat: item.lat, lng: item.lng });
    for (const tier of TIERS) {
      for (const corner of polygonsRef.current[tier.tier]?.path ?? []) bounds.extend(corner);
    }
    if (bounds.isEmpty()) return;

    fittedRef.current = true;
    if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
      map.setCenter(bounds.getCenter());
      map.setZoom(14);
    } else {
      map.fitBounds(bounds, 48);
    }
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const keep = new Set(locations.map((item) => item.id));
    for (const [id, marker] of markersRef.current) {
      if (!keep.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    }

    for (const item of locations) {
      const existing = markersRef.current.get(item.id);
      if (existing) {
        existing.setPosition({ lat: item.lat, lng: item.lng });
        existing.setTitle(item.label);
        existing.setIcon(pinIcon(item.tier));
        continue;
      }
      const marker = new google.maps.Marker({
        map,
        position: { lat: item.lat, lng: item.lng },
        title: item.label,
        icon: pinIcon(item.tier),
        clickable: true,
      });
      markersRef.current.set(item.id, marker);
    }

    for (const [id, marker] of markersRef.current) {
      const item = locations.find((row) => row.id === id);
      google.maps.event.clearListeners(marker, 'click');
      if (item) {
        marker.addListener('click', () => addCorner(item.lat, item.lng));
      }
    }
  }, [locations, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    for (const marker of vehicleMarkersRef.current.values()) marker.setMap(null);
    vehicleMarkersRef.current.clear();

    vehicleInfoRef.current ??= new google.maps.InfoWindow();

    for (const pin of vehicles ?? []) {
      const chosen = pin.id === selectedVehicleId;
      const marker = new google.maps.Marker({
        map,
        position: { lat: pin.lat, lng: pin.lng },
        title: pin.title,
        // Above the outline fill and the corners, which are the backdrop here.
        zIndex: chosen ? 1200 : pin.muted ? 900 : 1000,
        icon: {
          path: TEARDROP,
          scale: chosen ? 1.35 : 1,
          fillColor: VEHICLE_COLOUR[pin.kind],
          fillOpacity: pin.muted && !chosen ? 0.4 : 1,
          strokeColor: '#ffffff',
          strokeWeight: chosen ? 2.5 : 1.5,
          anchor: new google.maps.Point(0, 0),
        },
      });
      marker.addListener('click', () => onVehicleSelect?.(pin.id));
      vehicleMarkersRef.current.set(pin.id, marker);
    }

    const chosen = (vehicles ?? []).find((pin) => pin.id === selectedVehicleId);
    const marker = chosen ? vehicleMarkersRef.current.get(chosen.id) : undefined;
    if (chosen && marker) {
      vehicleInfoRef.current.setContent(
        `<div style="font:13px/1.4 Inter,system-ui,sans-serif;padding:2px 0">
           <strong>${escapeHtml(chosen.title)}</strong>
           <div style="color:#64748b;margin-top:2px">${escapeHtml(chosen.subtitle)}</div>
         </div>`,
      );
      vehicleInfoRef.current.open({ map, anchor: marker });
      map.panTo({ lat: chosen.lat, lng: chosen.lng });
    } else {
      vehicleInfoRef.current.close();
    }
  }, [mapReady, onVehicleSelect, selectedVehicleId, vehicles]);

  useEffect(() => {
    const markers = vehicleMarkersRef;
    return () => {
      for (const marker of markers.current.values()) marker.setMap(null);
      markers.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    clearPathListeners();
    clearDraftOverlays();

    for (const row of TIERS) {
      const stored = polygons[row.tier]?.path ?? [];
      const isActive = row.tier === tier;

      if (isActive && stored.length < 3) {
        shapesRef.current[row.tier]?.setMap(null);
        delete shapesRef.current[row.tier];
        drawOpenLine(map, stored, row.tier);
        continue;
      }

      lineRef.current?.setMap(null);
      lineRef.current = null;

      const existing = shapesRef.current[row.tier];
      if (existing && pathsEqual(pathOf(existing), stored) && existing.getEditable() === isActive) {
        continue;
      }

      existing?.setMap(null);
      if (stored.length < 3) {
        delete shapesRef.current[row.tier];
        continue;
      }

      const polygon = new google.maps.Polygon({
        map,
        paths: stored,
        ...polygonOptions(row.tier),
        editable: isActive,
        clickable: false,
      });
      shapesRef.current[row.tier] = polygon;

      if (isActive) {
        const path = polygon.getPath();
        const persist = () => {
          const path = pathOf(polygon);
          writePath(row.tier, path);
          syncPinsToPath(row.tier, path);
        };
        pathListenersRef.current = [
          path.addListener('set_at', persist),
          path.addListener('insert_at', persist),
          path.addListener('remove_at', persist),
        ];
      }
    }
  }, [polygons, tier, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    clickListenerRef.current?.remove();
    clickListenerRef.current = null;
    if (!map || !mapReady) return;

    clickListenerRef.current = map.addListener('click', (event: google.maps.MapMouseEvent) => {
      if (!event.latLng) return;
      addCorner(event.latLng.lat(), event.latLng.lng());
    });

    return () => {
      clickListenerRef.current?.remove();
      clickListenerRef.current = null;
    };
  }, [mapReady]);

  function addCorner(lat: number, lng: number): void {
    const which = tierRef.current;
    const current = polygonsRef.current[which]?.path ?? [];
    const last = current.at(-1);
    if (last && almostSame(last, { lat, lng })) return;
    writePath(which, [...current, { lat, lng }]);
    recordPin(which, { lat, lng });
  }

  function writePath(which: ZoneTier, path: LatLng[]): void {
    const next: ZonePolygons = { ...polygonsRef.current };
    if (path.length === 0) delete next[which];
    else next[which] = { path };
    onPolygonsChangeRef.current(next);
  }

  function recordPin(which: ZoneTier, point: LatLng): void {
    const already = locationsRef.current.some(
      (item) => item.tier === which && almostSame({ lat: item.lat, lng: item.lng }, point),
    );
    if (already) return;

    const count = locationsRef.current.filter((item) => item.tier === which).length + 1;
    const id = crypto.randomUUID();
    onLocationsChangeRef.current([
      ...locationsRef.current,
      {
        id,
        placeId: '',
        label: `${tierTitle(which)} pin ${String(count)}`,
        lat: point.lat,
        lng: point.lng,
        tier: which,
      },
    ]);
    scheduleLookup(id, point);
  }

  function removeLastCorner(): void {
    if (activePath.length === 0) return;
    const last = activePath.at(-1);
    writePath(tier, activePath.slice(0, -1));
    if (!last) return;

    const list = locationsRef.current;
    const index = [...list]
      .reverse()
      .findIndex((item) => item.tier === tier && almostSame({ lat: item.lat, lng: item.lng }, last));
    if (index < 0) return;
    const real = list.length - 1 - index;
    onLocationsChangeRef.current(list.filter((_, i) => i !== real));
  }

  function clearOutline(): void {
    const next = { ...polygons };
    delete next[tier];
    onPolygonsChangeRef.current(next);
    onLocationsChangeRef.current(locationsRef.current.filter((item) => item.tier !== tier));
  }

  function syncPinsToPath(which: ZoneTier, path: LatLng[]): void {
    const others = locationsRef.current.filter((item) => item.tier !== which);
    const ofTier = locationsRef.current.filter((item) => item.tier === which);
    const nextOfTier = path.map((point, index) => {
      const exact = ofTier.find((item) => almostSame({ lat: item.lat, lng: item.lng }, point));
      if (exact) return exact;
      const reuse = ofTier[index];
      if (reuse) {
        const moved = { ...reuse, lat: point.lat, lng: point.lng };
        scheduleLookup(moved.id, point);
        return moved;
      }
      const created = {
        id: crypto.randomUUID(),
        placeId: '',
        label: `${tierTitle(which)} pin ${String(index + 1)}`,
        lat: point.lat,
        lng: point.lng,
        tier: which,
      };
      scheduleLookup(created.id, point);
      return created;
    });
    const extras = ofTier.filter(
      (item) =>
        item.placeId !== '' &&
        !path.some((point) => almostSame(point, { lat: item.lat, lng: item.lng })),
    );
    onLocationsChangeRef.current([...others, ...nextOfTier, ...extras]);
  }

  function retagLocation(id: string, nextTier: ZoneTier): void {
    const item = locationsRef.current.find((row) => row.id === id);
    if (!item || item.tier === nextTier) return;

    const point = { lat: item.lat, lng: item.lng };
    onLocationsChangeRef.current(
      locationsRef.current.map((row) =>
        row.id === id
          ? {
              ...row,
              tier: nextTier,
              label: row.placeId
                ? row.label
                : row.label.replace(/^(Prime|Secondary)/, tierTitle(nextTier)),
            }
          : row,
      ),
    );

    const from = (polygonsRef.current[item.tier]?.path ?? []).filter(
      (corner) => !almostSame(corner, point),
    );
    const to = [...(polygonsRef.current[nextTier]?.path ?? []), point];
    const next: ZonePolygons = { ...polygonsRef.current };
    if (from.length === 0) delete next[item.tier];
    else next[item.tier] = { path: from };
    next[nextTier] = { path: to };
    onPolygonsChangeRef.current(next);
  }

  function removeLocation(id: string): void {
    const item = locationsRef.current.find((row) => row.id === id);
    onLocationsChangeRef.current(locationsRef.current.filter((row) => row.id !== id));
    if (!item) return;
    const point = { lat: item.lat, lng: item.lng };
    const path = (polygonsRef.current[item.tier]?.path ?? []).filter(
      (corner) => !almostSame(corner, point),
    );
    writePath(item.tier, path);
  }

  function outlineFromPins(): void {
    const pins = locations.filter((item) => item.tier === tier);
    if (pins.length < 3) return;
    writePath(
      tier,
      pins.map((item) => ({ lat: item.lat, lng: item.lng })),
    );
  }

  function drawOpenLine(map: google.maps.Map, path: LatLng[], which: ZoneTier): void {
    if (path.length >= 2) {
      lineRef.current = new google.maps.Polyline({
        map,
        path,
        strokeColor: ZONE_MAP_COLORS[which].stroke,
        strokeWeight: 3,
        clickable: false,
      });
    }

    vertexMarkersRef.current = path.map(
      (point, index) =>
        new google.maps.Marker({
          map,
          position: point,
          draggable: true,
          zIndex: 1000,
          title: `Corner ${String(index + 1)} — drag to move`,
          label: { text: String(index + 1), color: '#ffffff', fontSize: '11px', fontWeight: '700' },
          icon: pinIcon(which),
        }),
    );

    vertexMarkersRef.current.forEach((marker, index) => {
      marker.addListener('dragend', () => {
        const loc = marker.getPosition();
        if (!loc) return;
        const next = [...(polygonsRef.current[which]?.path ?? [])];
        next[index] = { lat: loc.lat(), lng: loc.lng() };
        writePath(which, next);
        syncPinsToPath(which, next);
      });
    });
  }

  function clearDraftOverlays(): void {
    lineRef.current?.setMap(null);
    lineRef.current = null;
    for (const marker of vertexMarkersRef.current) marker.setMap(null);
    vertexMarkersRef.current = [];
  }

  function clearPathListeners(): void {
    for (const listener of pathListenersRef.current) listener.remove();
    pathListenersRef.current = [];
  }

  if (!apiKey) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
        <p className="text-[13px] font-medium text-slate-700">Google Maps is not configured</p>
        <p className="mt-1 text-[12px] text-slate-500">
          Add <code className="rounded bg-white px-1">VITE_GOOGLE_MAPS_API_KEY</code> to{' '}
          <code className="rounded bg-white px-1">app/.env.local</code> and restart{' '}
          <code className="rounded bg-white px-1">npm run dev</code>. Enable Maps JavaScript API
          and Places API on that key.
        </p>
      </div>
    );
  }

  const pinList = (
    <>
      {lookupProblem ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[12px] text-amber-900">
            Place names are unavailable — {lookupProblem}. The pins and the zones they define are
            unaffected; only their names are missing.
          </p>
          <button
            type="button"
            onClick={retryLookups}
            className="shrink-0 rounded-lg border border-amber-300 px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
          >
            Try again
          </button>
        </div>
      ) : null}

      {locations.length > 0 ? (
        <ul className="max-h-[26rem] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {locations.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p
                  className={cn(
                    'truncate text-[13px] font-medium',
                    isGenericLabel(item.label) ? 'text-slate-400 italic' : 'text-slate-800',
                  )}
                >
                  {pinName(item, lookups[item.id])}
                </p>
                <p className="numeric mt-0.5 text-[11px] text-slate-500">
                  {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
                </p>
                <div className="mt-1.5 flex gap-1">
                  {TIERS.map((row) => (
                    <button
                      key={row.tier}
                      type="button"
                      onClick={() => retagLocation(item.id, row.tier)}
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        item.tier === row.tier
                          ? 'text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                      )}
                      style={
                        item.tier === row.tier
                          ? { background: ZONE_MAP_COLORS[row.tier].stroke }
                          : undefined
                      }
                    >
                      {row.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 text-[12px] font-medium text-slate-500 hover:text-rose-600"
                onClick={() => removeLocation(item.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-slate-50 px-3 py-4 text-[12px] text-slate-500">
          No pins yet. Click the map to drop a corner, or search a place — either one is saved
          here. The outline itself is the pins you drop.
        </p>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TIERS.map((row) => (
          <button
            key={row.tier}
            type="button"
            onClick={() => setTier(row.tier)}
            className={cn(
              'rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
              tier === row.tier
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            <span
              className="mr-1.5 inline-block size-2 rounded-full"
              style={{ background: ZONE_MAP_COLORS[row.tier].stroke }}
              aria-hidden
            />
            {row.label}
          </button>
        ))}
        <span className="text-[11px] text-slate-400">
          Click the map to pin a corner. The line grows as you add points.
        </span>
      </div>

      <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] text-slate-600">
        <span className="font-medium text-slate-800">Network</span> is not drawn. When a driver
        leaves Prime and Secondary, those kilometres are Network at ₹1/km.
      </p>

      <div className="relative">
        <MapPin className="pointer-events-none absolute top-2.5 left-3 z-10 size-4 text-slate-400" />
        <input
          ref={searchEl}
          type="search"
          placeholder={`Search a place in ${city}…`}
          className="focus:border-brand-500 focus:ring-brand-500/25 relative z-10 h-9 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-[13px] text-slate-900 outline-none focus:ring-2"
        />
      </div>

      <div
        ref={mapEl}
        className={cn(
          'overflow-hidden rounded-xl border border-slate-200 bg-slate-100',
          mapClassName ?? 'h-96 xl:h-[28rem]',
        )}
        role="region"
        aria-label="Campaign zone map"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leadingIcon={<Pentagon className="size-3.5" />}
          disabled={!mapReady}
          onClick={() => mapEl.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
        >
          Draw {tier} zone
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={outlineFromPins}
          disabled={locations.filter((item) => item.tier === tier).length < 3}
        >
          Use {tier} pins as outline
        </Button>
        {activePath.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leadingIcon={<Undo2 className="size-3.5" />}
            onClick={removeLastCorner}
          >
            Remove last corner
          </Button>
        ) : null}
        {activePath.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leadingIcon={<Trash2 className="size-3.5" />}
            onClick={clearOutline}
          >
            Clear {tier} outline
          </Button>
        ) : null}
      </div>
      <p className="text-[12px] text-slate-500">
        {activePath.length === 0
          ? `Click the map to start the ${tier} outline. Pins are saved as ${tierTitle(tier)}.`
          : activePath.length < 3
            ? `${activePath.length} of 3 corners — keep clicking the map to grow the ${tier} line.`
            : `${activePath.length} corners. Drag a corner to move it, or drag the midpoint of a side to add another.`}
      </p>

      {pinList}

      {loadError ? <FormError message={loadError} /> : null}
      {error ? <FormError message={error} /> : null}
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

function pathOf(polygon: google.maps.Polygon): LatLng[] {
  return polygon
    .getPath()
    .getArray()
    .map((point) => ({ lat: point.lat(), lng: point.lng() }));
}

function pathsEqual(left: LatLng[], right: LatLng[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((point, index) => {
    const other = right[index];
    return other !== undefined && almostSame(point, other);
  });
}

function isGenericLabel(label: string): boolean {
  return /^(Prime|Secondary) pin \d+$/.test(label);
}

/**
 * What to call a pin that has not been named yet.
 *
 * "Looking up location…" is only honest while a lookup is genuinely in flight.
 * Once one has come back empty, saying it again is a promise the screen has
 * stopped keeping, and the two empty answers deserve different words: there is
 * nothing here to name, versus we could not ask.
 */
function pinName(item: CampaignLocation, state: LookupState | undefined): string {
  if (!isGenericLabel(item.label)) return item.label;

  switch (state) {
    case 'unnamed':
      return `Unnamed spot near ${item.lat.toFixed(3)}, ${item.lng.toFixed(3)}`;
    case 'unavailable':
      return item.label;
    default:
      return 'Looking up location…';
  }
}

function tierTitle(tier: ZoneTier): string {
  return tier === 'prime' ? 'Prime' : 'Secondary';
}

function almostSame(left: LatLng, right: LatLng): boolean {
  return Math.abs(left.lat - right.lat) < 1e-6 && Math.abs(left.lng - right.lng) < 1e-6;
}

function polygonOptions(tier: ZoneTier): google.maps.PolygonOptions {
  const color = ZONE_MAP_COLORS[tier];
  return {
    strokeColor: color.stroke,
    strokeWeight: 2,
    fillColor: color.fill,
    fillOpacity: 0.28,
  };
}

function pinIcon(tier: ZoneTier): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: ZONE_MAP_COLORS[tier].stroke,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
  };
}
