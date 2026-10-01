import { Building2, Flag, Home, MapPin, Store, TrafficCone, TrainFront } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { formatDuration, formatKm, formatTime } from '@/shared/format';
import { cn } from '@/shared/lib/cn';
import type { ZoneKey } from '@/shared/types/domain';

import { UNNAMED_STOP, type JourneyStop } from './tripJourney';

const ZONE_LABEL: Record<ZoneKey, string> = {
  prime: 'Prime',
  secondary: 'Secondary',
  network: 'Network',
};

const STOP_ICON: Record<JourneyStop['kind'], LucideIcon> = {
  start: Flag,
  end: MapPin,
  mall: Store,
  signal: TrafficCone,
  transit: TrainFront,
  residential: Home,
  junction: Building2,
};

const STOP_TONE: Record<JourneyStop['kind'], string> = {
  start: 'bg-emerald-500',
  end: 'bg-rose-500',
  mall: 'bg-orange-400',
  signal: 'bg-amber-500',
  transit: 'bg-blue-500',
  residential: 'bg-sky-500',
  junction: 'bg-violet-500',
};

function subtitleOf(stop: JourneyStop): string {
  if (stop.role === 'start') return `Start ${formatTime(stop.at)}`;
  if (stop.role === 'end') return `End ${formatTime(stop.at)}`;
  const bits = [
    stop.named
      ? stop.kind === 'signal'
        ? 'Traffic'
        : stop.kind === 'mall'
          ? 'Mall'
          : null
      : 'No place name yet',
    stop.km != null ? formatKm(stop.km) : null,
    stop.seconds != null ? formatDuration(stop.seconds) : null,
  ].filter(Boolean);
  return bits.join(' · ') || UNNAMED_STOP;
}

export function JourneyStrip({ stops, className }: { stops: JourneyStop[]; className?: string }) {
  if (stops.length === 0) return null;

  return (
    <ol
      className={cn('flex items-start gap-0 overflow-x-auto', className)}
      aria-label="Trip journey"
    >
      {stops.map((stop, index) => {
        const Icon = STOP_ICON[stop.kind];
        return (
          <li key={stop.id} className="flex min-w-0 flex-1 items-start">
            <div className="flex min-w-[5.5rem] flex-1 flex-col items-center text-center">
              <span
                className={cn(
                  'grid size-6 place-items-center rounded-full text-white shadow-sm',
                  STOP_TONE[stop.kind],
                )}
              >
                <Icon className="size-3" aria-hidden />
              </span>
              <p className="mt-1 max-w-[8rem] truncate text-[11px] font-semibold text-slate-900">
                {stop.name}
              </p>
              <p className="text-[10px] text-slate-500">
                {stop.role === 'start' || stop.role === 'end'
                  ? formatTime(stop.at)
                  : subtitleOf(stop)}
              </p>
            </div>
            {index < stops.length - 1 ? (
              <span
                className="mt-3 min-w-8 flex-1 border-t-2 border-dotted border-brand-400"
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function JourneyTimeline({ stops }: { stops: JourneyStop[] }) {
  if (stops.length === 0) return null;

  return (
    <ol className="mt-3 space-y-4 border-l border-slate-200 py-1 pl-5" aria-label="Trip waypoints">
      {stops.map((stop) => {
        const Icon = STOP_ICON[stop.kind];
        return (
          <li key={stop.id} className="relative">
            <span
              className={cn(
                'absolute top-0.5 -left-[1.625rem] grid size-5 place-items-center rounded-full text-white',
                STOP_TONE[stop.kind],
              )}
            >
              <Icon className="size-2.5" aria-hidden />
            </span>
            <div className="flex items-start justify-between gap-3 py-0.5">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-slate-800">{stop.name}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {stop.role === 'start'
                    ? 'Start'
                    : stop.role === 'end'
                      ? 'End'
                      : subtitleOf(stop)}
                  {stop.at ? ` · ${formatTime(stop.at)}` : ''}
                </p>
              </div>
              {stop.zone ? (
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  {ZONE_LABEL[stop.zone]}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

