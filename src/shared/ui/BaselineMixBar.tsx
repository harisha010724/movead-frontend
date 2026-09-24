import { formatPercent } from '@/shared/format';
import type { BaselineMix } from '@/shared/types/domain';

/**
 * How much of a reported audience is measurement and how much is assumption.
 *
 * This is the figure a competitor cannot publish. An impression count derived
 * from a rented traffic feed cannot say which of its roads it actually knows,
 * because the feed does not know either; MoveAd's baselines come from its own
 * fleet driving those roads, so it can say, per campaign, which claims rest on
 * measurement of that road in that hour and which fall back to a flat
 * assumption about the zone.
 *
 * Shown beside the impression count rather than behind a tooltip. An
 * advertiser told "2.4 million" learns nothing about how far to trust it; one
 * told that most of it rests on hour-by-hour measurement of those roads can
 * price the claim — and one told the opposite has been warned honestly rather
 * than sold a thin number as a thick one.
 */

interface Band {
  key: keyof BaselineMix;
  label: string;
  hint: string;
  bar: string;
  dot: string;
}

const BANDS: Band[] = [
  {
    key: 'cellHour',
    label: 'Measured, this road and this hour',
    hint: 'The fleet has driven it enough times in this hour of the week to know how fast it runs when clear.',
    bar: 'bg-emerald-500',
    dot: 'bg-emerald-500',
  },
  {
    key: 'cell',
    label: 'Measured, this road across the week',
    hint: 'Enough passes to know the road, not yet enough to split it by hour.',
    bar: 'bg-sky-500',
    dot: 'bg-sky-500',
  },
  {
    key: 'zoneDefault',
    label: 'Assumed from the zone',
    hint: 'Barely driven yet, so a flat per-zone free-flow speed stands in. These figures firm up as the fleet covers the route.',
    bar: 'bg-slate-300',
    dot: 'bg-slate-300',
  },
];

export function BaselineMixBar({ mix }: { mix: BaselineMix }) {
  const total = mix.cellHour + mix.cell + mix.zoneDefault;

  // Not "0% measured" — nothing has been modelled at all, and a bar of three
  // empty bands invites the reader to conclude the roads are unknown.
  if (total <= 0) {
    return (
      <p className="text-sm text-slate-500">
        No audience has been modelled for this campaign yet, so there is nothing to attribute.
      </p>
    );
  }

  const measured = (mix.cellHour + mix.cell) / total;

  return (
    <div>
      <p className="text-sm text-slate-600">
        <span className="numeric font-semibold text-slate-900">{formatPercent(measured)}</span> of
        this audience rests on the fleet&rsquo;s own measurement of these roads.
      </p>

      <div
        className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={`Evidence behind the audience: ${BANDS.map(
          (band) => `${band.label} ${formatPercent(mix[band.key] / total)}`,
        ).join(', ')}`}
      >
        {BANDS.map((band) => (
          <div
            key={band.key}
            className={band.bar}
            style={{ width: `${String((mix[band.key] / total) * 100)}%` }}
          />
        ))}
      </div>

      <dl className="mt-4 space-y-3">
        {BANDS.map((band) => (
          <div key={band.key} className="flex items-start gap-3 text-sm">
            <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${band.dot}`} aria-hidden />
            <dt className="flex-1 text-slate-600">
              {band.label}
              <span className="mt-0.5 block text-xs text-slate-400">{band.hint}</span>
            </dt>
            <dd className="numeric w-14 shrink-0 text-right font-medium text-slate-900">
              {formatPercent(mix[band.key] / total)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
