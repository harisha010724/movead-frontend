import type { ReactNode } from 'react';
import { MapPin, MoreHorizontal } from 'lucide-react';
import { formatCount, formatDate, formatTime } from '@/shared/format';
import { vehicleTypeLabel } from '@/shared/campaigns/vehicleCatalog';
import { cn } from '@/shared/lib/cn';
import type { AdminCampaign } from '@/shared/types/domain';
import { Button, CampaignStatusBadge, Menu, Table, TBody, TD, TH, THead, TR } from '@/shared/ui';
import { deadlineOf, isOverdue, progressOf, type StageId } from './campaignProduction';
import { CampaignThumb } from './CampaignThumb';

const menuTriggerClass =
  'cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none';

/** One colour per stage, so a bar says where in production it is before it is read. */
const BAR: Record<StageId, string> = {
  review: 'bg-sky-500',
  printing: 'bg-amber-500',
  installing: 'bg-brand-500',
  running: 'bg-emerald-500',
};

export interface RowAction {
  label: string;
  onSelect: () => void;
}

/**
 * The stage's campaigns as a table: the artwork, who it is for, where, how big,
 * when it came in, when it is due, and the one thing to do next. Everything
 * else an operator can do sits in the row's menu.
 */
export function ProductionTable({
  caption,
  stage,
  campaigns,
  primaryAction,
  renderMenu,
}: {
  caption: string;
  stage: StageId;
  campaigns: AdminCampaign[];
  primaryAction: (campaign: AdminCampaign) => RowAction;
  renderMenu: (campaign: AdminCampaign) => ReactNode;
}) {
  return (
    <Table caption={caption}>
      <THead>
        <TR>
          <TH>Campaign</TH>
          <TH>Advertiser</TH>
          <TH>Location</TH>
          <TH numeric>Vehicles</TH>
          <TH>Submitted</TH>
          <TH>{stage === 'running' ? 'Ends' : 'Go live by'}</TH>
          <TH>Status</TH>
          <TH>Budget used</TH>
          <TH>
            <span className="sr-only">Actions</span>
          </TH>
        </TR>
      </THead>
      <TBody>
        {campaigns.map((c) => {
          const primary = primaryAction(c);
          const percent = Math.round(progressOf(c) * 100);
          const overdue = isOverdue(c, stage);

          return (
            <TR key={c.id}>
              <TD>
                <div className="flex items-center gap-3">
                  <CampaignThumb campaign={c} />
                  <span className="min-w-0">
                    <span className="block max-w-[220px] truncate font-medium text-slate-900">
                      {c.name}
                    </span>
                    <span className="mt-0.5 block max-w-[220px] truncate text-[12px] text-slate-500">
                      {c.brandName} · {vehicleTypeLabel(c.vehicleType)}
                    </span>
                  </span>
                </div>
              </TD>
              <TD>
                <span className="text-slate-800">{c.advertiser.brandName}</span>
                <span className="mt-0.5 block max-w-[180px] truncate text-[12px] text-slate-500">
                  {c.advertiser.legalName}
                </span>
              </TD>
              <TD>
                <span className="inline-flex items-center gap-1.5 text-slate-700">
                  <MapPin className="text-brand-500 size-3.5 shrink-0" aria-hidden />
                  {c.city}
                </span>
              </TD>
              <TD numeric>{formatCount(c.vehicleCount)}</TD>
              <TD>
                <span className="block text-slate-800">{formatDate(c.submittedAt)}</span>
                <span className="mt-0.5 block text-[12px] text-slate-500">
                  {formatTime(c.submittedAt)}
                </span>
              </TD>
              <TD>
                <span className={cn('block', overdue ? 'text-rose-600' : 'text-slate-800')}>
                  {formatDate(`${deadlineOf(c, stage)}T00:00:00Z`)}
                </span>
                {overdue ? (
                  <span className="mt-0.5 block text-[12px] font-medium text-rose-600">Overdue</span>
                ) : null}
              </TD>
              <TD>
                <CampaignStatusBadge status={c.status} />
              </TD>
              <TD>
                <div className="w-28">
                  <span className="numeric text-[12px] text-slate-600">{percent}%</span>
                  <div
                    role="progressbar"
                    aria-label={`Budget used for ${c.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"
                  >
                    <div
                      className={cn('h-full rounded-full', BAR[stage])}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </TD>
              <TD className="w-px">
                <div className="flex items-center justify-end gap-1.5">
                  <Button variant="secondary" size="sm" onClick={primary.onSelect}>
                    {primary.label}
                  </Button>
                  <Menu
                    trigger={
                      <button
                        type="button"
                        aria-label={`Actions for ${c.name}`}
                        className={menuTriggerClass}
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    }
                  >
                    {renderMenu(c)}
                  </Menu>
                </div>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
