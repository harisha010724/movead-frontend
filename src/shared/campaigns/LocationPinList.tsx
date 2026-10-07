import { MapPin } from 'lucide-react';

import { ZONE_MAP_COLORS } from '@/shared/maps/zoneColors';
import type { CampaignLocation, ZonePolygons, ZoneTier } from '@/shared/maps/types';

export interface LocationPin {
  id: string;
  label: string;
  tier: ZoneTier;
  lat?: number;
  lng?: number;
}

/**
 * Pins the advertiser dropped (or searched) for a zone. If only an outline
 * was saved, the corners of that outline are listed so the preview still
 * has somewhere to point.
 */
export function draftLocationPins(
  locations: CampaignLocation[] | undefined,
  polygons?: ZonePolygons,
): LocationPin[] {
  if (locations && locations.length > 0) {
    return locations.map((row) => ({
      id: row.id,
      label: row.label,
      tier: row.tier,
      lat: row.lat,
      lng: row.lng,
    }));
  }

  const pins: LocationPin[] = [];
  for (const tier of ['prime', 'secondary'] as const) {
    (polygons?.[tier]?.path ?? []).forEach((point, index) => {
      pins.push({
        id: `${tier}-${String(index)}`,
        label: `${tier === 'prime' ? 'Prime' : 'Secondary'} pin ${String(index + 1)}`,
        tier,
        lat: point.lat,
        lng: point.lng,
      });
    });
  }
  return pins;
}

export function LocationPinList({
  pins,
  compact = false,
}: {
  pins: LocationPin[];
  compact?: boolean;
}) {
  if (pins.length === 0) return null;

  return (
    <ul
      data-testid="location-pin-list"
      className={compact ? 'space-y-2' : 'divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200'}
    >
      {pins.map((pin) => (
        <li
          key={pin.id}
          className={compact ? 'flex items-start gap-2' : 'flex items-start gap-2.5 px-3 py-2.5'}
        >
          <span
            className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-white"
            style={{ background: ZONE_MAP_COLORS[pin.tier].stroke }}
            aria-hidden
          >
            <MapPin className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-[13px] font-medium text-slate-800">{pin.label}</span>
              <span
                className="shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium text-white"
                style={{ background: ZONE_MAP_COLORS[pin.tier].stroke }}
              >
                {pin.tier === 'prime' ? 'Prime' : 'Secondary'}
              </span>
            </span>
            {pin.lat != null && pin.lng != null ? (
              <span className="numeric mt-0.5 block text-[11px] text-slate-400">
                {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
