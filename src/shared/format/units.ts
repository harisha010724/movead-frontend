/*
 * Non-money quantities use western thousands grouping (186,420 km), while
 * money uses Indian lakh grouping (₹1,86,420.00) — the convention in the
 * approved design, and the one Indian advertising reporting generally follows.
 * See ./money.ts for the currency side of this split.
 */
const km1 = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const pct1 = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** WEB-006: distance is always shown to one decimal place with a unit. */
export function formatKm(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${km1.format(value)} km`;
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return int.format(value);
}

/**
 * Compact K/M/B notation for large counts such as impressions.
 *
 * Deliberately western rather than lakh/crore: this scale is read alongside
 * advertising benchmarks that are quoted in millions, whereas money on this
 * platform is read in lakhs. Money uses `formatINRCompact` instead.
 */
export function formatCompactCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';

  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}K`;
  return int.format(value);
}

/** Distance with thousands separators and no decimals, e.g. "186,420 km". */
export function formatKmWhole(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${int.format(value)} km`;
}

/** Accepts a ratio (0.186), not a pre-multiplied percentage. */
export function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '—';
  return pct1.format(ratio);
}

export function formatSignedPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '—';
  const sign = ratio > 0 ? '+' : '';
  return `${sign}${pct1.format(ratio)}`;
}
