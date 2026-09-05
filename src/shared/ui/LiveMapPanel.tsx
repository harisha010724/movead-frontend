import { Crosshair, Maximize2, Minus, Plus } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatCount } from '@/shared/format';
import { liveStateDot, liveStateLabel } from './liveState';
import { ViewAllLink } from './ViewAllLink';
import type { LiveVehicleState } from '@/shared/types/domain';

export interface VehicleStatusCount {
  state: LiveVehicleState;
  count: number;
}

interface LiveMapPanelProps {
  /**
   * Omit where the counts are already shown on the page. Two copies of the
   * same figures on one screen invite them to disagree, which is exactly what
   * happened on Live Tracking.
   */
  statuses?: VehicleStatusCount[];
  viewAllTo?: string;
  height?: number;
}

/**
 * Map surface with the floating vehicle-status panel and zoom controls.
 *
 * The map SDK is intentionally not mounted here. Load it lazily on the routes
 * that need it: a maps bundle in the shared chunk is a large download for
 * every user who never opens a tracking view.
 */
export function LiveMapPanel({ statuses, viewAllTo, height = 320 }: LiveMapPanelProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl bg-slate-100"
      style={{ height }}
      role="region"
      aria-label="Live vehicle map"
    >
      {/* Placeholder grid, replaced by real tiles when the SDK is mounted. */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden
      />
      <p className="absolute inset-x-0 bottom-4 text-center text-xs text-slate-400">
        Map tiles render here once the maps SDK is mounted
      </p>

      {statuses ? (
        <div className="shadow-panel absolute top-4 left-4 w-48 rounded-xl bg-white/95 p-3.5 backdrop-blur">
          <p className="text-[11px] font-semibold text-slate-900">Vehicle Status</p>
          <dl className="mt-2.5 space-y-2">
            {statuses.map(({ state, count }) => (
              <div key={state} className="flex items-center gap-2 text-xs">
                <span
                  className={cn('size-2 shrink-0 rounded-full', liveStateDot(state))}
                  aria-hidden
                />
                <dt className="flex-1 text-slate-600">{liveStateLabel(state)}</dt>
                <dd className="numeric font-medium text-slate-900">{formatCount(count)}</dd>
              </div>
            ))}
          </dl>
          {viewAllTo ? (
            <div className="mt-3 border-t border-slate-100 pt-2.5">
              <ViewAllLink to={viewAllTo} className="text-[11px]">
                View All Vehicles
              </ViewAllLink>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="absolute right-4 bottom-4 flex flex-col gap-1.5">
        {[
          { icon: Crosshair, label: 'Recentre map' },
          { icon: Plus, label: 'Zoom in' },
          { icon: Minus, label: 'Zoom out' },
          { icon: Maximize2, label: 'Fullscreen' },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            className="grid size-8 place-items-center rounded-lg bg-white text-slate-500 shadow-card transition-colors hover:text-slate-800"
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
