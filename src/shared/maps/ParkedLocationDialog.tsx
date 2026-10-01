import { useEffect, useRef, useState } from 'react';
import { CircleParking, MapPin } from 'lucide-react';

import { cn } from '@/shared/lib/cn';

import { formatDuration } from '@/shared/format';
import type { CampaignParked } from '@/shared/types/domain';
import { Dialog, Skeleton } from '@/shared/ui';

import { ParkedSpotMap } from './ParkedSpotMap';
import { PARKED_NEARBY_METRES, type NearbyPlace } from './nearbyPlaces';
import { useNearbyPlaces } from './useNearbyPlaces';
import { useParkedName } from './useParkedName';

/**
 * Where the vehicle stood still, and what sat within 100 m of that pin.
 *
 * Opened from the parked chip on a recorded trip — the card only has room for
 * how long it waited; the place and its neighbours need a map.
 */
export function ParkedLocationDialog({
  open,
  onClose,
  parked,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  parked: CampaignParked | null | undefined;
  loading: boolean;
}) {
  const parkedName = useParkedName(open ? parked : null);
  const nearby = useNearbyPlaces(open ? parked : null);
  const where =
    parkedName ??
    (parked ? `${parked.lat.toFixed(5)}, ${parked.lng.toFixed(5)}` : 'this stop');

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={parked ? `Parked ${formatDuration(parked.seconds)}` : 'Parked'}
      description={
        parked
          ? `At ${where}. Named places within ${PARKED_NEARBY_METRES} m.`
          : 'Where the vehicle stood still before this drive.'
      }
      size="xl"
    >
      {loading && !parked ? (
        <Skeleton className="h-64 w-full" />
      ) : parked ? (
        <ParkedBody parked={parked} name={where} nearby={nearby} />
      ) : (
        <p className="text-[13px] text-slate-500">
          This drive opened a shift, so the time before it is not a park.
        </p>
      )}
    </Dialog>
  );
}

function ParkedBody({
  parked,
  name,
  nearby,
}: {
  parked: CampaignParked;
  name: string;
  nearby: NearbyPlace[];
}) {
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const focus = nearby.find((place) => placeKey(place) === focusKey) ?? null;

  useEffect(() => {
    if (!focusKey || !listRef.current) return;
    const row = listRef.current.querySelector(`[data-place="${cssEscape(focusKey)}"]`);
    if (row instanceof HTMLElement && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusKey]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,1fr)] lg:items-stretch">
      <ParkedSpotMap
        parked={{ ...parked, name }}
        nearby={nearby}
        focus={focus}
        className="h-80 lg:h-full lg:min-h-[28rem]"
      />
      <div className="flex min-h-0 flex-col">
        <p className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700">
          <CircleParking className="size-3.5" aria-hidden />
          Parked at {name}
        </p>
        <h3 className="mt-3 text-[12px] font-semibold tracking-tight text-slate-900">
          Within {PARKED_NEARBY_METRES} m
        </h3>
        {nearby.length === 0 ? (
          <p className="mt-2 text-[13px] text-slate-500">No named places within 100 m yet.</p>
        ) : (
          <ul
            ref={listRef}
            className="mt-2 min-h-0 max-h-64 flex-1 overflow-y-auto overscroll-contain divide-y divide-slate-100 pr-1 lg:max-h-[28rem]"
            aria-label="Places within 100 metres"
          >
            {nearby.map((place) => {
              const key = placeKey(place);
              const selected = key === focusKey;
              return (
                <li key={key} data-place={key}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFocusKey(key)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left',
                      selected ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-slate-50',
                    )}
                  >
                    <MapPin
                      className={cn(
                        'mt-0.5 size-3.5 shrink-0',
                        selected ? 'text-brand-600' : 'text-slate-400',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium break-words text-slate-800">
                        {place.name}
                      </span>
                      <span className="text-[12px] text-slate-500">{place.kind}</span>
                    </span>
                    <span className="numeric shrink-0 text-[12px] text-slate-500">
                      {formatMetres(place.metres)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function placeKey(place: NearbyPlace): string {
  return `${place.name}-${place.lat}-${place.lng}`;
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : value.replace(/["\\]/g, '\\$&');
}

function formatMetres(metres: number): string {
  if (metres < 10) return 'next to it';
  return `${Math.round(metres)} m`;
}
