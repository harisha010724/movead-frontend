import { useEffect, useRef, useState } from 'react';
import { env } from '@/shared/config/env';
import { formatTime } from '@/shared/format';
import type { CampaignTripLeg, TripLeg, VisibilityPlace } from '@/shared/types/domain';

import { loadGoogleMaps } from './loadGoogleMaps';
import type { JourneyStop } from './tripJourney';

/** Enough of a priced stretch to draw it. Driver money is not required. */
export type RouteLeg = Pick<TripLeg, 'zone' | 'state' | 'path'> | CampaignTripLeg;

export type RouteColour = 'zone' | 'visibility';

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
const LEG_COLORS: Record<RouteLeg['zone'], string> = {
  prime: '#b45309',
  secondary: '#1d4ed8',
  network: '#475569',
};

const VISIBILITY_COLORS = {
  high: '#16a34a',
  medium: '#d97706',
  low: '#64748b',
} as const;

const STOP_COLORS: Record<JourneyStop['kind'], string> = {
  start: '#10b981',
  end: '#f43f5e',
  mall: '#fb923c',
  signal: '#f59e0b',
  transit: '#3b82f6',
  residential: '#0ea5e9',
  junction: '#8b5cf6',
};

function strokeOf(leg: RouteLeg, colourBy: RouteColour): string {
  if (colourBy === 'visibility' && 'visibility' in leg && leg.visibility) {
    return VISIBILITY_COLORS[leg.visibility];
  }
  return LEG_COLORS[leg.zone];
}

export function TripRouteMap({
  legs,
  selectedLeg,
  onSelectLeg,
  colourBy = 'zone',
  places = [],
  stops = [],
  parked = null,
  mapType = 'roadmap',
  showLegend = true,
}: {
  legs: RouteLeg[];
  /** Index of the leg to emphasise, or null to show them evenly. */
  selectedLeg: number | null;
  onSelectLeg: (index: number | null) => void;
  /** Zone answers the rate; visibility answers whether anyone could read it. */
  colourBy?: RouteColour;
  /** Raw dwells — used only when a journey has not been built. */
  places?: VisibilityPlace[];
  /** Start, a few key stops, and end — the pins the mockup actually shows. */
  stops?: JourneyStop[];
  /** Where the vehicle stood still before this drive. */
  parked?: { lat: number; lng: number; name: string; seconds: number } | null;
  mapType?: 'roadmap' | 'hybrid';
  showLegend?: boolean;
}) {
  const apiKey = env.googleMapsApiKey;
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const linesRef = useRef<google.maps.Polyline[]>([]);
  const endpointsRef = useRef<google.maps.Marker[]>([]);
  const placesRef = useRef<google.maps.Marker[]>([]);
  const labelsRef = useRef<google.maps.OverlayView[]>([]);
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
          mapTypeId: mapType === 'hybrid' ? 'hybrid' : 'roadmap',
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
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

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    map.setMapTypeId(mapType === 'hybrid' ? 'hybrid' : 'roadmap');
  }, [mapReady, mapType]);

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
    for (const marker of placesRef.current) marker.setMap(null);
    for (const label of labelsRef.current) label.setMap(null);
    linesRef.current = [];
    endpointsRef.current = [];
    placesRef.current = [];
    labelsRef.current = [];

    const pins = stops.length > 0 ? stops : fallbackPins(places, legs);

    const bounds = new google.maps.LatLngBounds();

    legs.forEach((leg, index) => {
      const dimmed = selectedLeg !== null && selectedLeg !== index;
      const held = leg.state !== 'BILLABLE';
      const path = leg.path.map((point) => ({ lat: point.lat, lng: point.lng }));
      for (const point of path) bounds.extend(point);

      const line = new google.maps.Polyline({
        map,
        path,
        strokeColor: strokeOf(leg, colourBy),
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

    for (const pin of pins) {
      const position = { lat: pin.lat, lng: pin.lng };
      bounds.extend(position);
      placesRef.current.push(
        new google.maps.Marker({
          map,
          position,
          title: pin.name,
          zIndex: 5,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: pin.role === 'start' || pin.role === 'end' ? 7 : 8,
            fillColor: STOP_COLORS[pin.kind],
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        }),
      );
      labelsRef.current.push(attachLabel(map, pin));
    }

    if (parked) {
      const position = { lat: parked.lat, lng: parked.lng };
      bounds.extend(position);
      placesRef.current.push(
        new google.maps.Marker({
          map,
          position,
          title: parked.name,
          zIndex: 6,
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
      labelsRef.current.push(
        attachLabel(map, {
          id: 'parked',
          role: 'place',
          kind: 'junction',
          name: parked.name,
          lat: parked.lat,
          lng: parked.lng,
          at: null,
          km: null,
          seconds: parked.seconds,
          zone: null,
          named: true,
        }),
      );
    }

    if (!bounds.isEmpty()) map.fitBounds(bounds, 56);
  }, [mapReady, legs, selectedLeg, colourBy, places, stops, parked]);

  useEffect(() => {
    const lines = linesRef;
    const markers = endpointsRef;
    const pins = placesRef;
    const labels = labelsRef;
    return () => {
      for (const line of lines.current) line.setMap(null);
      for (const marker of markers.current) marker.setMap(null);
      for (const marker of pins.current) marker.setMap(null);
      for (const label of labels.current) label.setMap(null);
    };
  }, []);

  if (!apiKey) {
    return (
      <div className="grid h-full min-h-[32rem] place-items-center rounded-xl bg-slate-50 px-6 text-center">
        <p className="text-[13px] text-slate-600">
          Add <code className="rounded bg-white px-1">VITE_GOOGLE_MAPS_API_KEY</code> to replay the
          route on a map. The zone breakdown below does not need it.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[32rem]">
      <div
        ref={mapEl}
        className="absolute inset-0 bg-slate-100"
        role="region"
        aria-label={colourBy === 'visibility' ? 'Trip route by visibility' : 'Trip route by zone'}
      />
      {showLegend && colourBy === 'visibility' ? (
        <ul
          className="absolute bottom-3 left-3 flex gap-3 rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] text-slate-600 shadow-sm"
          aria-label="Visibility"
        >
          <li className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
            Low speed
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" aria-hidden />
            Moderate
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-slate-500" aria-hidden />
            Heavy / fly-by
          </li>
        </ul>
      ) : null}
      {loadError ? (
        <p className="shadow-card absolute inset-x-4 bottom-4 rounded-lg bg-white/95 px-3 py-2 text-[12px] text-rose-600">
          {loadError}
        </p>
      ) : null}
    </div>
  );
}

function fallbackPins(places: VisibilityPlace[], legs: RouteLeg[]): JourneyStop[] {
  const start = legs.at(0)?.path.at(0);
  const finish = legs.at(-1)?.path.at(-1);
  const pins: JourneyStop[] = [];

  if (start) {
    pins.push({
      id: 'start',
      role: 'start',
      kind: 'start',
      name: 'Start',
      lat: start.lat,
      lng: start.lng,
      at: null,
      km: null,
      seconds: null,
      zone: null,
      named: false,
    });
  }

  for (const place of places.filter((item) => item.kind !== 'junction').slice(0, 3)) {
    pins.push({
      id: `${place.kind}-${place.lat}-${place.lng}`,
      role: 'place',
      kind: place.kind,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      at: null,
      km: place.km,
      seconds: place.seconds,
      zone: null,
      named: true,
    });
  }

  if (finish) {
    pins.push({
      id: 'end',
      role: 'end',
      kind: 'end',
      name: 'End',
      lat: finish.lat,
      lng: finish.lng,
      at: null,
      km: null,
      seconds: null,
      zone: null,
      named: false,
    });
  }

  return pins;
}

function attachLabel(map: google.maps.Map, stop: JourneyStop): google.maps.OverlayView {
  const el = document.createElement('div');
  el.style.position = 'absolute';
  el.style.transform = 'translate(-50%, calc(-100% - 10px))';
  el.style.pointerEvents = 'none';
  el.style.whiteSpace = 'nowrap';

  const card = document.createElement('div');
  card.style.borderRadius = '8px';
  card.style.background = '#fff';
  card.style.padding = '6px 10px';
  card.style.boxShadow = '0 8px 18px rgba(15, 23, 42, 0.12)';
  card.style.border = '1px solid rgba(15, 23, 42, 0.06)';

  const title = document.createElement('p');
  title.style.margin = '0';
  title.style.fontSize = '11px';
  title.style.fontWeight = '600';
  title.style.color = '#0f172a';
  title.textContent = stop.name;

  const sub = document.createElement('p');
  sub.style.margin = '2px 0 0';
  sub.style.fontSize = '10px';
  sub.style.color = '#64748b';
  sub.textContent =
    stop.id === 'parked'
      ? 'Parked'
      : stop.role === 'start'
        ? `Start${stop.at ? ` ${formatTime(stop.at)}` : ''}`
        : stop.role === 'end'
          ? `End${stop.at ? ` ${formatTime(stop.at)}` : ''}`
          : stop.kind === 'mall'
            ? 'Mall'
            : stop.kind === 'signal'
              ? 'Traffic'
              : stop.kind === 'transit'
                ? 'Transit'
                : '';

  card.append(title);
  if (sub.textContent) card.append(sub);
  el.append(card);

  class LabelOverlay extends google.maps.OverlayView {
    override onAdd() {
      this.getPanes()?.floatPane.appendChild(el);
    }

    override draw() {
      const projection = this.getProjection();
      if (!projection) return;
      const point = projection.fromLatLngToDivPixel(new google.maps.LatLng(stop.lat, stop.lng));
      if (!point) return;
      el.style.left = `${point.x}px`;
      el.style.top = `${point.y}px`;
    }

    override onRemove() {
      el.remove();
    }
  }

  const overlay = new LabelOverlay();
  overlay.setMap(map);
  return overlay;
}
