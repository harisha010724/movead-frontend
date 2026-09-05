import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltipCard } from './ChartTooltip';
import { AXIS_STYLE, GRID_COLOR } from './palette';

export interface TrendPoint {
  label: string;
  value: number;
}

interface TrendAreaChartProps {
  data: TrendPoint[];
  seriesName: string;
  /** Formats the value in the tooltip; the axis uses `formatAxis`. */
  formatValue: (value: number) => string;
  formatAxis?: (value: number) => string;
  color?: string;
  height?: number;
}

export function TrendAreaChart({
  data,
  seriesName,
  formatValue,
  formatAxis,
  color = '#6366f1',
  height = 220,
}: TrendAreaChartProps) {
  const gradientId = `trend-${seriesName.replace(/\W/g, '')}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={formatAxis ?? formatValue}
        />
        <Tooltip
          cursor={{ stroke: color, strokeDasharray: '3 3' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const value = payload[0]?.value;
            return (
              <ChartTooltipCard
                title={String(label)}
                rows={[
                  {
                    color,
                    label: seriesName,
                    value: typeof value === 'number' ? formatValue(value) : '—',
                  },
                ]}
              />
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
