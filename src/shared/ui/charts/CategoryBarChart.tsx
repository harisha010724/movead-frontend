import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltipCard } from './ChartTooltip';
import { AXIS_STYLE, GRID_COLOR } from './palette';

export interface CategoryPoint {
  label: string;
  value: number;
}

interface CategoryBarChartProps {
  data: CategoryPoint[];
  seriesName: string;
  formatValue: (value: number) => string;
  formatAxis?: (value: number) => string;
  color?: string;
  height?: number;
}

export function CategoryBarChart({
  data,
  seriesName,
  formatValue,
  formatAxis,
  color = '#6366f1',
  height = 220,
}: CategoryBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
        barCategoryGap="22%"
      >
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={12}
        />
        <YAxis
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={formatAxis ?? formatValue}
        />
        <Tooltip
          cursor={{ fill: 'rgb(99 102 241 / 0.06)' }}
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
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
