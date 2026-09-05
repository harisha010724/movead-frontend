import type { Money } from '@/shared/types/domain';

/**
 * Indian currency formatting: ₹1,86,420.00 uses lakh/crore digit grouping,
 * not the western thousands grouping. `en-IN` handles this correctly.
 */
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Formats a server-supplied decimal string for display.
 *
 * The `Number` conversion here is the single place the client touches a money
 * value numerically, and it exists only to hand the value to `Intl`. Never
 * reuse the converted number for arithmetic — totals belong in API responses,
 * because the server is the only party allowed to compute a rupee.
 */
export function formatINR(value: Money | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? inr.format(n) : '—';
}

export function formatINRWhole(value: Money | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? inrWhole.format(n) : '—';
}

/**
 * Compact Indian notation for dashboard headlines: ₹1.86 L, ₹4.10 Cr.
 * Always pair with the exact value in a tooltip or drill-down.
 */
export function formatINRCompact(value: Money | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';

  // Non-breaking space before the unit: in a narrow chart axis or a metric
  // card a normal space lets "₹80.0 K" wrap onto two lines.
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}\u00a0Cr`;
  if (abs >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}\u00a0L`;
  if (abs >= 1_000) return `₹${(n / 1_000).toFixed(1)}\u00a0K`;
  return inrWhole.format(n);
}

/**
 * Compares two decimal money strings exactly: -1, 0 or 1.
 *
 * Deliberately not `Number(a) - Number(b)`. This is used to decide whether a
 * budget fits inside a wallet balance, and a binary-float comparison of two
 * decimal strings can answer that wrongly at the boundary. Scaling to integers
 * and comparing as BigInt cannot.
 *
 * The server still enforces the rule; this only decides what the UI says.
 */
export function compareMoney(a: Money | string, b: Money | string): number {
  const scale = (value: string): bigint => {
    const negative = value.trim().startsWith('-');
    const [whole = '0', fraction = ''] = value.trim().replace(/^[-+]/, '').split('.');
    // Four decimal places matches the NUMERIC scale the API returns.
    const scaled = BigInt(whole + fraction.padEnd(4, '0').slice(0, 4));
    return negative ? -scaled : scaled;
  };

  const left = scale(String(a));
  const right = scale(String(b));
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

/** Per-kilometre rate, e.g. "₹5.00/km". */
export function formatRate(value: Money | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? `${inr.format(n)}/km` : '—';
}
