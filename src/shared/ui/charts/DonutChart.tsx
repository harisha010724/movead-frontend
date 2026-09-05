import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatPercent } from '@/shared/format';
import { ChartTooltipCard } from './ChartTooltip';
import { chartColor } from './palette';

export interface DonutSlice {
  label: string;
  value: number;
}

interface DonutChartProps {
  data: DonutSlice[];
  /** Large figure shown in the middle of the ring. */
  centreValue: string;
  centreLabel?: string;
  formatValue: (value: number) => string;
  size?: number;
}

/**
 * Donut with a centred total and a legend showing each slice's share.
 *
 * Percentages are derived from the values supplied — this is presentation
 * arithmetic on counts, not money, so it is safe to do here.
 */
export function DonutChart({
  data,
  centreValue,
  centreLabel = 'Total',
  formatValue,
  size = 180,
}: DonutChartProps) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="66%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((slice, index) => (
                <Cell key={slice.label} fill={chartColor(index)} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const entry = payload[0];
                const label = String(entry?.name ?? '');
                const value = typeof entry?.value === 'number' ? entry.value : 0;
                // Resolve the colour from our own palette rather than the
                // chart internals, so the swatch cannot drift from the slice.
                const index = data.findIndex((slice) => slice.label === label);
                return (
                  <ChartTooltipCard
                    rows={[
                      {
                        color: chartColor(Math.max(index, 0)),
                        label,
                        value: `${formatValue(value)} (${formatPercent(value / (total || 1))})`,
                      },
                    ]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="numeric text-xl font-semibold tracking-tight text-slate-900">
            {centreValue}
          </span>
          <span className="text-[11px] text-slate-400">{centreLabel}</span>
        </div>
      </div>

      {/*
        `min-w-40` forces the legend onto its own line rather than crushing the
        labels when the card is narrow — a truncated area name is useless.
      */}
      <dl className="min-w-40 flex-1 space-y-1.5">
        {data.map((slice, index) => (
          <div key={slice.label} className="flex items-baseline gap-2 text-[11px]">
            <span
              className="size-2 shrink-0 translate-y-px rounded-full"
              style={{ backgroundColor: chartColor(index) }}
              aria-hidden
            />
            <dt className="min-w-0 flex-1 truncate text-slate-600">{slice.label}</dt>
            <dd className="numeric shrink-0 text-slate-500">
              {formatValue(slice.value)}{' '}
              <span className="text-slate-400">
                ({formatPercent(slice.value / (total || 1))})
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
