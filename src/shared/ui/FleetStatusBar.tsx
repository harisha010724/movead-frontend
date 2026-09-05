import { cn } from '@/shared/lib/cn';
import { formatCount, formatPercent } from '@/shared/format';
import { liveStateDot, liveStateLabel } from './liveState';
import type { LiveVehicleState } from '@/shared/types/domain';
import type { VehicleStatusCount } from './LiveMapPanel';

interface FleetStatusBarProps {
  statuses: VehicleStatusCount[];
  /** Currently filtered state, or null for all vehicles. */
  selected: LiveVehicleState | null;
  onSelect: (state: LiveVehicleState | null) => void;
  /** Rendered next to the live indicator, e.g. "updated just now". */
  updatedLabel?: string;
}

/**
 * Fleet composition and the filter for the vehicle list, in one control.
 *
 * This replaces one card per state. Four cards each held a label and a number
 * with a hand's width of empty space between them, which cost a full band of
 * screen above the map and still left the two questions people actually ask
 * unanswered: how many vehicles are tracking in total, and what share of them
 * is earning. A shared denominator answers both, and makes the states
 * comparable rather than four unrelated figures.
 *
 * The counts are also the filter. The same numbers were previously repeated in
 * the map overlay, where they disagreed with this row because the overlay
 * quietly dropped GPS_PAUSED — so the two totals on one screen never matched.
 * There is now one set of counts, and clicking one narrows the list below.
 */
export function FleetStatusBar({
  statuses,
  selected,
  onSelect,
  updatedLabel,
}: FleetStatusBarProps) {
  const total = statuses.reduce((sum, s) => sum + s.count, 0);
  const present = statuses.filter((s) => s.count > 0);

  return (
    <section
      className="shadow-card rounded-2xl bg-white p-5"
      aria-label="Fleet status and filter"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
              Live
            </span>
          </div>
          <p className="numeric mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {formatCount(total)}
            <span className="ml-2 text-[13px] font-normal text-slate-500">
              {total === 1 ? 'vehicle tracking' : 'vehicles tracking'}
            </span>
          </p>
        </div>

        {updatedLabel ? (
          <p className="text-[11px] text-slate-400">{updatedLabel}</p>
        ) : null}
      </div>

      {total > 0 ? (
        <div
          className="mt-4 flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100"
          role="img"
          aria-label={`Fleet mix: ${present
            .map((s) => `${liveStateLabel(s.state)} ${formatPercent(s.count / total)}`)
            .join(', ')}`}
        >
          {present.map(({ state, count }) => (
            <div
              key={state}
              className={cn(
                'transition-opacity first:rounded-l-full last:rounded-r-full',
                liveStateDot(state),
                // Dim the rest so the filtered state reads as the subject.
                selected && selected !== state && 'opacity-25',
              )}
              style={{ width: `${(count / total) * 100}%` }}
            />
          ))}
        </div>
      ) : null}

      <div
        className="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Filter vehicles by state"
      >
        <FilterChip
          active={selected === null}
          onClick={() => onSelect(null)}
          label="All"
          count={total}
        />
        {statuses.map(({ state, count }) => (
          <FilterChip
            key={state}
            active={selected === state}
            disabled={count === 0}
            onClick={() => onSelect(selected === state ? null : state)}
            label={liveStateLabel(state)}
            count={count}
            share={total > 0 ? count / total : 0}
            dot={liveStateDot(state)}
          />
        ))}
      </div>
    </section>
  );
}

interface FilterChipProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  share?: number;
  dot?: string;
  disabled?: boolean;
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  share,
  dot,
  disabled = false,
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition-colors',
        'focus-visible:ring-brand-500/40 focus-visible:ring-2 focus-visible:outline-none',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
        disabled && 'cursor-not-allowed opacity-50 hover:border-slate-200 hover:bg-white',
      )}
    >
      {dot ? <span className={cn('size-2 shrink-0 rounded-full', dot)} aria-hidden /> : null}
      <span>{label}</span>
      <span className={cn('numeric font-semibold', active ? 'text-brand-700' : 'text-slate-900')}>
        {formatCount(count)}
      </span>
      {share !== undefined && count > 0 ? (
        <span className="numeric text-[11px] text-slate-400">{formatPercent(share)}</span>
      ) : null}
    </button>
  );
}
