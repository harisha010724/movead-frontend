import type { ZoneTier } from './types';

export const ZONE_MAP_COLORS: Record<ZoneTier, { stroke: string; fill: string }> = {
  prime: { stroke: '#b45309', fill: '#f59e0b' },
  secondary: { stroke: '#1d4ed8', fill: '#3b82f6' },
};
