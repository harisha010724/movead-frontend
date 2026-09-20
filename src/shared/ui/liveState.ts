import type { LiveVehicleState } from '@/shared/types/domain';

/**
 * Presentation of live vehicle state, shared by the badge, the map overlay and
 * the status counters so the same state always reads the same way.
 *
 * GPS_PAUSED is deliberately distinct from OFFLINE: the vehicle is reachable
 * but GPS has dropped, so kilometre accrual has stopped. Conflating the two
 * would hide a billing-relevant condition.
 */
/*
 * `marker` repeats `dot` as a hex value because the map draws its pins through
 * the Google Maps SDK, which takes a colour and not a class name. Kept in this
 * table rather than in the map component so a state cannot be amber in the
 * legend and red on the tile it is labelling.
 */
const styles: Record<LiveVehicleState, { label: string; dot: string; marker: string }> = {
  RUNNING: { label: 'Running', dot: 'bg-emerald-500', marker: '#10b981' },
  IDLE: { label: 'Idle', dot: 'bg-amber-500', marker: '#f59e0b' },
  OFFLINE: { label: 'Offline', dot: 'bg-slate-400', marker: '#94a3b8' },
  GPS_PAUSED: { label: 'GPS paused', dot: 'bg-rose-500', marker: '#f43f5e' },
};

export const liveStateDot = (state: LiveVehicleState) => styles[state].dot;
export const liveStateLabel = (state: LiveVehicleState) => styles[state].label;
export const liveStateMarker = (state: LiveVehicleState) => styles[state].marker;
