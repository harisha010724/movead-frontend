import type { ReactNode } from 'react';

export interface TooltipRow {
  color?: string;
  label: string;
  value: ReactNode;
}

/**
 * Shared tooltip shell so every chart in the product looks the same.
 *
 * Values are pre-formatted by the caller — charts receive numbers for
 * geometry, but what the user reads still goes through @/shared/format.
 */
export function ChartTooltipCard({ title, rows }: { title?: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-panel">
      {title ? <p className="mb-1 text-xs font-medium text-slate-500">{title}</p> : null}
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2 text-sm">
            {row.color ? (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
                aria-hidden
              />
            ) : null}
            <span className="text-slate-500">{row.label}</span>
            <span className="numeric ml-auto font-medium text-slate-900">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
