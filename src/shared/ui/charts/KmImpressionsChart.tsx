import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartTooltipCard } from './ChartTooltip';
import { AXIS_STYLE, GRID_COLOR } from './palette';

/**
 * Verified distance and the audience derived from it, on one time axis.
 *
 * Deliberately one chart rather than two stacked ones. Impressions are not an
 * independent measurement — they are what the model makes of these exact
 * kilometres — and two charts side by side invite the reader to treat them as
 * two findings that happen to agree. Together, a day where the line rises
 * faster than the bars is immediately legible as what it is: the same distance
 * driven through heavier traffic.
 *
 * Two axes, because they are different units and sharing one would flatten
 * whichever is smaller into the baseline.
 */

export interface KmImpressionsPoint {
  /** The civil day, `YYYY-MM-DD`. Used as the click payload, not as the label. */
  date: string;
  label: string;
  verifiedKm: number;
  impressions: number;
}

const KM_COLOR = '#c7d2fe';
const IMPRESSIONS_COLOR = '#6366f1';

interface KmImpressionsChartProps {
  data: KmImpressionsPoint[];
  formatKm: (value: number) => string;
  formatImpressions: (value: number) => string;
  formatAxis: (value: number) => string;
  height?: number;
  /** Opens the day's working. Omit to leave the chart inert. */
  onSelectDay?: (date: string) => void;
}

export function KmImpressionsChart({
  data,
  formatKm,
  formatImpressions,
  formatAxis,
  height = 260,
  onSelectDay,
}: KmImpressionsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
        barCategoryGap="28%"
        // Recharts reports the category, not the datum, so the day is looked
        // up rather than read off the event.
        onClick={(state: { activeLabel?: string | number }) => {
          if (!onSelectDay) return;
          const point = data.find((d) => d.label === String(state.activeLabel));
          if (point) onSelectDay(point.date);
        }}
        style={onSelectDay ? { cursor: 'pointer' } : undefined}
      >
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          minTickGap={16}
        />
        <YAxis
          yAxisId="km"
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={formatAxis}
        />
        <YAxis
          yAxisId="impressions"
          orientation="right"
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={formatAxis}
        />
        <Tooltip
          cursor={{ fill: 'rgb(99 102 241 / 0.06)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const point = data.find((d) => d.label === String(label));
            if (!point) return null;

            return (
              <ChartTooltipCard
                title={String(label)}
                rows={[
                  {
                    color: KM_COLOR,
                    label: 'Verified distance',
                    value: formatKm(point.verifiedKm),
                  },
                  {
                    color: IMPRESSIONS_COLOR,
                    label: 'Impressions',
                    value: formatImpressions(point.impressions),
                  },
                ]}
              />
            );
          }}
        />
        <Bar
          yAxisId="km"
          dataKey="verifiedKm"
          name="Verified distance"
          fill={KM_COLOR}
          radius={[4, 4, 0, 0]}
        />
        <Line
          yAxisId="impressions"
          type="monotone"
          dataKey="impressions"
          name="Impressions"
          stroke={IMPRESSIONS_COLOR}
          strokeWidth={2}
          dot={{ r: 2.5, strokeWidth: 0, fill: IMPRESSIONS_COLOR }}
          activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
