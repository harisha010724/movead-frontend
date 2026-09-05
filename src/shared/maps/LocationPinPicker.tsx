import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { env } from '@/shared/config/env';
import { cn } from '@/shared/lib/cn';
import { FormError } from '@/shared/ui/form';
import { cityCenter } from './cities';
import { loadGoogleMaps } from './loadGoogleMaps';

export interface PickedLocation {
  label: string;
  lat: number;
  lng: number;
}

/**
 * One pin. Search a place or click the map. Used when onboarding a driver so
 * advertisers can later match that pin to Prime / Secondary outlines.
 */
export function LocationPinPicker({
  city,
  value,
  onChange,
  error,
  active = true,
  mapClassName = 'h-56',
}: {
  city: string;
  value: PickedLocation | null;
  onChange: (next: PickedLocation | null) => void;
  error?: string;
  /** Skip map init while the host dialog is closed — Maps hates a 0×0 pane. */
  active?: boolean;
  /** Height of the map pane, so a column layout can give it more room. */
  mapClassName?: string;
}) {
  const apiKey = env.googleMapsApiKey;
  const mapEl = useRef<HTMLDivElement>(null);
  const searchEl = useRef<HTMLInputElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const valueRef = useRef(value);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  valueRef.current = value;

  useEffect(() => {
    if (!active || !apiKey || !mapEl.current) return;

    let cancelled = false;

    void loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapEl.current) return;

        const origin = valueRef.current ?? cityCenter(city);
        const map = new google.maps.Map(mapEl.current, {
          center: { lat: origin.lat, lng: origin.lng },
          zoom: valueRef.current ? 15 : cityCenter(city).zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        mapRef.current = map;
        setMapReady(true);

        map.addListener('click', (event: google.maps.MapMouseEvent) => {
          const loc = event.latLng;
          if (!loc) return;
          onChange({
            label: valueRef.current?.label || 'Dropped pin',
            lat: loc.lat(),
            lng: loc.lng(),
          });
        });

        if (searchEl.current) {
          const autocomplete = new google.maps.places.Autocomplete(searchEl.current, {
            fields: ['formatted_address', 'name', 'geometry'],
            componentRestrictions: { country: 'in' },
          });
          autocomplete.bindTo('bounds', map);
          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            const loc = place.geometry?.location;
            if (!loc) return;
            onChange({
              label: place.formatted_address || place.name || 'Selected location',
              lat: loc.lat(),
              lng: loc.lng(),
            });
            if (searchEl.current) searchEl.current.value = '';
          });
        }

        window.setTimeout(() => {
          google.maps.event.trigger(map, 'resize');
          map.setCenter({ lat: origin.lat, lng: origin.lng });
        }, 80);
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
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
      setMapReady(false);
    };
    // Recreate only when the dialog opens. City changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || value) return;
    const origin = cityCenter(city);
    map.panTo(origin);
    map.setZoom(origin.zoom);
  }, [city, mapReady, value]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (!value) {
      markerRef.current?.setMap(null);
      markerRef.current = null;
      return;
    }

    const position = { lat: value.lat, lng: value.lng };
    if (markerRef.current) {
      markerRef.current.setPosition(position);
      markerRef.current.setTitle(value.label);
    } else {
      markerRef.current = new google.maps.Marker({
        map,
        position,
        title: value.label,
        draggable: true,
      });
      markerRef.current.addListener('dragend', () => {
        const loc = markerRef.current?.getPosition();
        if (!loc) return;
        onChange({
          label: valueRef.current?.label || 'Dropped pin',
          lat: loc.lat(),
          lng: loc.lng(),
        });
      });
    }

    map.panTo(position);
    if ((map.getZoom() ?? 12) < 14) map.setZoom(14);
  }, [value, mapReady, onChange]);

  if (!apiKey) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6">
        <p className="text-[13px] text-slate-600">
          Add <code className="rounded bg-white px-1">VITE_GOOGLE_MAPS_API_KEY</code> to show
          the map and drop a pin.
        </p>
        {error ? <FormError message={error} className="mt-3" /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        {/*
          Above the input, not level with it. Both sat at `z-10`, and the input
          is the later sibling with a white background, so it painted straight
          over the pin and the field looked like a plain search box.
        */}
        <MapPin className="pointer-events-none absolute top-2.5 left-3 z-20 size-4 text-slate-400" />
        <input
          ref={searchEl}
          type="search"
          placeholder={`Search a place in ${city}…`}
          className="relative z-10 h-9 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-[13px] text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
        />
      </div>

      <div
        ref={mapEl}
        className={cn(
          'overflow-hidden rounded-xl border border-slate-200 bg-slate-100',
          mapClassName,
        )}
        role="region"
        aria-label="Driver operating location"
      />

      {value ? (
        <p className="numeric text-[12px] text-slate-600">
          {value.label}
          <span className="mt-0.5 block text-[11px] text-slate-400">
            {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
          </span>
        </p>
      ) : (
        <p className="text-[12px] text-slate-500">
          Search a place or click the map. This pin is how advertisers see the vehicle against
          Prime and Secondary later.
        </p>
      )}

      {loadError ? <FormError message={loadError} /> : null}
      {error ? <FormError message={error} /> : null}
    </div>
  );
}
