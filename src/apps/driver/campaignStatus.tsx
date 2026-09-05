import type { DriverCampaignStatus } from '@/shared/types/domain';
import { Badge } from '@/shared/ui';

/**
 * UI-025.3 — the badge reflects the real campaign state. An assigned campaign
 * that has not been installed must not read as "Active", because the driver
 * would reasonably conclude they are already earning.
 *
 * `requested` is `info` rather than `warning` on purpose. Amber across this
 * app means the driver has something to do, and a request is the one stage
 * where they have nothing to do but wait.
 */
const STATUS: Record<
  DriverCampaignStatus,
  { label: string; tone: 'success' | 'warning' | 'neutral' | 'info' }
> = {
  requested: { label: 'Requested', tone: 'info' },
  assigned: { label: 'Assigned', tone: 'warning' },
  installation_pending: { label: 'Installation pending', tone: 'warning' },
  active: { label: 'Active', tone: 'success' },
  paused: { label: 'Paused', tone: 'neutral' },
  completed: { label: 'Completed', tone: 'neutral' },
};

export function DriverCampaignStatusBadge({ status }: { status: DriverCampaignStatus }) {
  const { label, tone } = STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
