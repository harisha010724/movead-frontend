import { formatKm, formatPercent } from '@/shared/format';
import type { ZoneBreakdown } from '@/shared/types/domain';

/**
 * Zone mix is the most commercially important number on any MoveAd screen:
 * the same distance is worth between ₹1 and ₹5 per km depending on this split.
 * It deserves a consistent visual treatment everywhere it appears.
 */
export function ZoneBreakdownBar({ km }: { km: ZoneBreakdown }) {
  const total = km.prime + km.secondary + km.network;
  if (total <= 0) return <p className="text-sm text-slate-500">No verified distance yet.</p>;

  const rows = [
    { label: 'Prime', value: km.prime, rate: '₹5.00/km', bar: 'bg-zone-prime' },
    { label: 'Secondary', value: km.secondary, rate: '₹2.00/km', bar: 'bg-zone-secondary' },
    { label: 'Network', value: km.network, rate: '₹1.00/km', bar: 'bg-zone-network' },
  ];

  return (
    <div>
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={`Zone mix: ${rows
          .map((r) => `${r.label} ${formatPercent(r.value / total)}`)
          .join(', ')}`}
      >
        {rows.map((r) => (
          <div
            key={r.label}
            className={r.bar}
            style={{ width: `${(r.value / total) * 100}%` }}
          />
        ))}
      </div>

      <dl className="mt-4 space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 text-sm">
            <span className={`size-2.5 shrink-0 rounded-full ${r.bar}`} aria-hidden />
            <dt className="flex-1 text-slate-600">
              {r.label}
              <span className="ml-1.5 text-xs text-slate-400">{r.rate}</span>
            </dt>
            <dd className="numeric font-medium text-slate-900">{formatKm(r.value)}</dd>
            <dd className="numeric w-14 text-right text-xs text-slate-500">
              {formatPercent(r.value / total)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
