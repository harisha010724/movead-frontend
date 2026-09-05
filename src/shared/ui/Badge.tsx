import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import type { CampaignStatus, LiveVehicleState, SegmentTier } from '@/shared/types/domain';
import { liveStateDot, liveStateLabel } from './liveState';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  info: 'bg-sky-50 text-sky-700',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-rose-50 text-rose-600',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Zone tiers are semantic: the same colour must mean the same rate everywhere,
 * including in the driver app. Never restyle these per screen.
 */
const tierStyles: Record<SegmentTier, { label: string; className: string }> = {
  PRIME: { label: 'Prime', className: 'bg-zone-prime-bg text-zone-prime' },
  SECONDARY: { label: 'Secondary', className: 'bg-zone-secondary-bg text-zone-secondary' },
  NETWORK: { label: 'Network', className: 'bg-zone-network-bg text-zone-network' },
  OUTSIDE: { label: 'Outside zones', className: 'bg-zone-rejected-bg text-zone-rejected' },
};

export function ZoneBadge({ tier, className }: { tier: SegmentTier; className?: string }) {
  const style = tierStyles[tier];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold',
        style.className,
        className,
      )}
    >
      {style.label}
    </span>
  );
}

const campaignTones: Record<CampaignStatus, { tone: Tone; label: string }> = {
  DRAFT: { tone: 'neutral', label: 'Draft' },
  PENDING_CONFIRMATION: { tone: 'warning', label: 'Awaiting your confirmation' },
  PENDING_APPROVAL: { tone: 'warning', label: 'In review' },
  APPROVED: { tone: 'info', label: 'At printer' },
  AWAITING_INSTALLATION: { tone: 'info', label: 'Installing' },
  ACTIVE: { tone: 'success', label: 'Active' },
  PAUSED: { tone: 'warning', label: 'Paused' },
  BUDGET_WARNING: { tone: 'warning', label: 'Budget warning' },
  STOPPED: { tone: 'danger', label: 'Stopped' },
  COMPLETED: { tone: 'neutral', label: 'Completed' },
  CANCELLED: { tone: 'neutral', label: 'Cancelled' },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const { tone, label } = campaignTones[status];
  return <Badge tone={tone}>{label}</Badge>;
}

const liveTones: Record<LiveVehicleState, Tone> = {
  RUNNING: 'success',
  IDLE: 'warning',
  OFFLINE: 'neutral',
  GPS_PAUSED: 'danger',
};

export function LiveStateBadge({ state }: { state: LiveVehicleState }) {
  return (
    <Badge tone={liveTones[state]} className="gap-1.5">
      <span className={cn('size-1.5 rounded-full', liveStateDot(state))} aria-hidden />
      {liveStateLabel(state)}
    </Badge>
  );
}
