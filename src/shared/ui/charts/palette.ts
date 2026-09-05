/**
 * Categorical chart palette, matching the `--color-chart-*` design tokens.
 *
 * Recharts needs concrete colour values rather than Tailwind classes, so these
 * are duplicated here. Keep the two in step: the tokens are the source of
 * truth for anything rendered as an element, these for anything drawn as SVG.
 */
export const CHART_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#3b82f6',
  '#f59e0b',
  '#10b981',
  '#f43f5e',
] as const;

export const chartColor = (index: number): string =>
  CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0];

export const AXIS_STYLE = {
  fontSize: 10,
  fill: '#94a3b8',
} as const;

export const GRID_COLOR = '#f1f5f9';
