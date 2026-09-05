import { PLATFORM_TIMEZONE } from '@/shared/format';

/**
 * Calendar dates as `YYYY-MM-DD` civil days (UTC midnight). Campaign start/end
 * and the date picker both use these so a day never slips by a timezone.
 */

const DAY_MS = 86_400_000;

/** Today's civil date in Asia/Kolkata — the day the billing engine is on. */
export function platformTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PLATFORM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function addIsoDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function compareIsoDates(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Six weeks of civil days covering `year`/`month` (0-11), starting on Sunday. */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}

export function isoYearMonth(iso: string): { year: number; month: number } {
  const [year, month] = iso.split('-').map(Number);
  return { year: year ?? 1970, month: (month ?? 1) - 1 };
}
