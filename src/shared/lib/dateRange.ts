import { PLATFORM_TIMEZONE } from '@/shared/format';
import type { DateRange } from '@/shared/api/queryKeys';

export type RangePreset = 'today' | 'last7' | 'last30' | 'campaign';

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: 'Today',
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  campaign: 'Campaign to date',
};

/** Fallback comparison labels when the preceding period cannot be dated. */
export const COMPARISON_LABELS: Record<RangePreset, string> = {
  today: 'yesterday',
  last7: 'previous 7 days',
  last30: 'previous 30 days',
  campaign: 'previous period',
};

/**
 * Dates are resolved in the platform timezone, not the browser's, so a user
 * travelling abroad still sees the same "today" the billing engine used.
 */
function platformToday(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PLATFORM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return new Date(`${parts}T00:00:00Z`);
}

const iso = (d: Date): string => d.toISOString().slice(0, 10);

const DAY_MS = 86_400_000;

/**
 * The period immediately before the one shown, of equal length.
 *
 * The design labels each comparison with real dates ("vs 01 Jul – 31 Jul")
 * rather than a vague "vs previous period", so the user can see exactly what
 * the percentage is measured against.
 */
export function previousPeriod(range: DateRange): DateRange {
  const from = new Date(`${range.from}T00:00:00Z`);
  const to = new Date(`${range.to}T00:00:00Z`);
  const lengthDays = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;

  const prevTo = new Date(from.getTime() - DAY_MS);
  const prevFrom = new Date(prevTo.getTime() - (lengthDays - 1) * DAY_MS);

  return { from: iso(prevFrom), to: iso(prevTo) };
}

/** Short label for a range, e.g. "01 Jul - 31 Jul". */
export function shortRangeLabel(range: DateRange): string {
  const short = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
  });
  const from = short.format(new Date(`${range.from}T00:00:00Z`));
  const to = short.format(new Date(`${range.to}T00:00:00Z`));
  return from === to ? from : `${from} - ${to}`;
}

export function resolveRange(preset: RangePreset, campaignStart?: string): DateRange {
  const today = platformToday();
  const to = iso(today);

  switch (preset) {
    case 'today':
      return { from: to, to };
    case 'last7': {
      const from = new Date(today);
      from.setUTCDate(from.getUTCDate() - 6);
      return { from: iso(from), to };
    }
    case 'last30': {
      const from = new Date(today);
      from.setUTCDate(from.getUTCDate() - 29);
      return { from: iso(from), to };
    }
    case 'campaign':
      return { from: campaignStart ?? to, to };
  }
}
