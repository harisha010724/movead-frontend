import type { LiveVehicleState } from '@/shared/types/domain';

/**
 * Presentation of live vehicle state, shared by the badge, the map overlay and
 * the status counters so the same state always reads the same way.
 *
 * GPS_PAUSED is deliberately distinct from OFFLINE: the vehicle is reachable
 * but GPS has dropped, so kilometre accrual has stopped. Conflating the two
 * would hide a billing-relevant condition.
 */
const styles: Record<LiveVehicleState, { label: string; dot: string }> = {
  RUNNING: { label: 'Running', dot: 'bg-emerald-500' },
  IDLE: { label: 'Idle', dot: 'bg-amber-500' },
  OFFLINE: { label: 'Offline', dot: 'bg-slate-400' },
  GPS_PAUSED: { label: 'GPS paused', dot: 'bg-rose-500' },
};

export const liveStateDot = (state: LiveVehicleState) => styles[state].dot;
export const liveStateLabel = (state: LiveVehicleState) => styles[state].label;
