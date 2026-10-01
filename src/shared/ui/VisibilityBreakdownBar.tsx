import { formatKm, formatPercent } from '@/shared/format';
import type { CampaignVisibility } from '@/shared/types/domain';

/**
 * How much of the billed distance was slow enough to read.
 *
 * The same stacked treatment as the zone mix, on purpose: that bar answers
 * "what did this kilometre cost" and this one answers "could anyone read it".
 * They must not be the same colours, or a glance would mix the two. Green is
 * the crawl, amber is city traffic, slate is a fly-by.
 *
 * The published 15 / 35 km/h cutoffs travel with the payload so a screen
 * cannot invent a rule the server did not apply.
 */

const ROWS = [
  { key: 'highKm', label: 'High', bar: 'bg-emerald-500' },
  { key: 'mediumKm', label: 'Medium', bar: 'bg-amber-500' },
  { key: 'lowKm', label: 'Low', bar: 'bg-slate-500' },
] as const;

export function VisibilityBreakdownBar({ mix }: { mix: CampaignVisibility }) {
  const total = mix.classifiedKm;
  if (total <= 0) {
    return <p className="text-sm text-slate-500">No classifiable distance yet.</p>;
  }

  const rows = ROWS.map((row) => ({
    ...row,
    value: mix[row.key],
    cutoff: mix.bands[row.key === 'highKm' ? 'high' : row.key === 'mediumKm' ? 'medium' : 'low'],
  }));

  return (
    <div>
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={`Visibility mix: ${rows
          .map((row) => `${row.label} ${formatPercent(row.value / total)}`)
          .join(', ')}`}
      >
        {rows.map((row) => (
          <div
            key={row.label}
            className={row.bar}
            style={{ width: `${(row.value / total) * 100}%` }}
          />
        ))}
      </div>

      <dl className="mt-4 space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3 text-sm">
            <span className={`size-2.5 shrink-0 rounded-full ${row.bar}`} aria-hidden />
            <dt className="flex-1 text-slate-600">
              {row.label}
              <span className="ml-1.5 text-xs text-slate-400">{row.cutoff}</span>
            </dt>
            <dd className="numeric font-medium text-slate-900">{formatKm(row.value)}</dd>
            <dd className="numeric w-14 text-right text-xs text-slate-500">
              {formatPercent(row.value / total)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
