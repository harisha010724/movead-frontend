/**
 * WEB-009: the platform operates in a single timezone. Every date shown to a
 * user is Asia/Kolkata regardless of where their browser is, so that a "day"
 * on a dashboard is the same day the billing engine used.
 */
export const PLATFORM_TIMEZONE = 'Asia/Kolkata';

const date = new Intl.DateTimeFormat('en-IN', {
  timeZone: PLATFORM_TIMEZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTime = new Intl.DateTimeFormat('en-IN', {
  timeZone: PLATFORM_TIMEZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const time = new Intl.DateTimeFormat('en-IN', {
  timeZone: PLATFORM_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const parse = (v: string | Date | null | undefined): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function formatDate(v: string | Date | null | undefined): string {
  const d = parse(v);
  return d ? date.format(d) : '—';
}

export function formatDateTime(v: string | Date | null | undefined): string {
  const d = parse(v);
  return d ? dateTime.format(d) : '—';
}

export function formatTime(v: string | Date | null | undefined): string {
  const d = parse(v);
  return d ? time.format(d) : '—';
}

const dayMonth = new Intl.DateTimeFormat('en-IN', {
  timeZone: PLATFORM_TIMEZONE,
  day: '2-digit',
  month: 'short',
});

/**
 * Drops the repeated year when both ends fall in the same one, so a range
 * reads "01 Aug – 31 Aug 2026" rather than stating 2026 twice.
 */
export function formatDateRange(
  from: string | Date | null | undefined,
  to: string | Date | null | undefined,
): string {
  const start = parse(from);
  const end = parse(to);
  if (!start || !end) return `${formatDate(from)} – ${formatDate(to)}`;

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  return `${sameYear ? dayMonth.format(start) : date.format(start)} – ${date.format(end)}`;
}

/** Relative age, used for "last updated" on live views. */
export function formatRelative(v: string | Date | null | undefined): string {
  const d = parse(v);
  if (!d) return '—';

  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return formatDate(d);
}
