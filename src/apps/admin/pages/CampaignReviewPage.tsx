import { useMemo, useState, type ReactNode } from 'react';
import {
  Car,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  ClipboardCheck,
  MoreHorizontal,
  OctagonX,
  Printer,
  Radio,
  ScanSearch,
  Truck,
} from 'lucide-react';
import { useAdminCampaigns } from '@/shared/api/hooks';
import { Page } from '@/shared/layout/Page';
import {
  Badge,
  CampaignStatusBadge,
  Card,
  CardHeader,
  EmptyState,
  Menu,
  MenuItem,
  QueryBoundary,
  SkeletonTable,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/shared/ui';
import { formatCount, formatDate, formatDateRange, formatINR } from '@/shared/format';
import { cn } from '@/shared/lib/cn';
import type { AdminCampaign } from '@/shared/types/domain';
import { AssignVehiclesDialog } from './AssignVehiclesDialog';
import { CampaignStatusDialog, type CampaignAction } from './CampaignStatusDialog';
import { InstalledDialog } from './InstalledDialog';
import { PrintReadyDialog } from './PrintReadyDialog';
import { RejectCampaignDialog } from './RejectCampaignDialog';
import { ReviewCampaignDialog } from './ReviewCampaignDialog';

/**
 * Campaign-level production after an advertiser submits (AC-01.8).
 *
 * Review, print, and install are separate decisions. Marking installed is
 * campaign-level until each vehicle has its own photo record (AC-06). Once a
 * campaign is on the road it can still be paused, resumed, stopped or
 * completed (AC-34.10) — every one of which the advertiser and every driver
 * carrying it are told about.
 */
export default function CampaignReviewPage() {
  const review = useAdminCampaigns({ status: 'PENDING_APPROVAL' });
  const printing = useAdminCampaigns({ status: 'APPROVED' });
  const installing = useAdminCampaigns({ status: 'AWAITING_INSTALLATION' });
  const live = useAdminCampaigns({ status: 'ACTIVE' });
  const paused = useAdminCampaigns({ status: 'PAUSED' });

  const [reviewing, setReviewing] = useState<AdminCampaign | null>(null);
  const [rejecting, setRejecting] = useState<AdminCampaign | null>(null);
  const [printReady, setPrintReady] = useState<AdminCampaign | null>(null);
  const [installed, setInstalled] = useState<AdminCampaign | null>(null);
  const [assigning, setAssigning] = useState<AdminCampaign | null>(null);
  const [changing, setChanging] = useState<{
    campaign: AdminCampaign;
    action: CampaignAction;
  } | null>(null);

  const openAfterMenuCloses = (open: () => void) => () => {
    setTimeout(open, 0);
  };

  const running = useMemo(
    () => ({
      ...live,
      data: live.data && paused.data
        ? { ...live.data, items: [...live.data.items, ...paused.data.items] }
        : undefined,
      isPending: live.isPending || paused.isPending,
    }),
    [live, paused],
  ) as ReturnType<typeof useAdminCampaigns>;

  return (
    <Page
      title="Campaign production"
      greeting="Review the brief, print the ads, install them on vehicles, then run the campaign to its end"
    >
      <ProductionSteps
        counts={[
          review.data?.total,
          printing.data?.total,
          installing.data?.total,
          (live.data?.total ?? 0) + (paused.data?.total ?? 0),
        ]}
      />

      <div className="space-y-6">
        <ProductionQueue
          title="Awaiting review"
          description="Approve the brief to lock it and send the creative to the printer. Reject only with a reason the advertiser can act on."
          query={review}
          emptyTitle="Nothing waiting for review"
          emptyDescription="When an advertiser submits a campaign it appears here."
          emptyIcon={ClipboardCheck}
          renderActions={(c) => (
            <>
              <Badge tone="warning">In review</Badge>
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
                <MenuItem
                  icon={ScanSearch}
                  onSelect={openAfterMenuCloses(() => setReviewing(c))}
                >
                  Review
                </MenuItem>
              </Menu>
            </>
          )}
        />

        <ProductionQueue
          title="At the printer"
          description="The brief is locked. When the vendor delivers the wraps, mark print ready so installation can start."
          query={printing}
          emptyTitle="Nothing at the printer"
          emptyDescription="Approved campaigns wait here until the printer delivers the ads."
          emptyIcon={Printer}
          renderActions={(c) => (
            <>
              <CampaignStatusBadge status={c.status} />
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
                <MenuItem icon={Car} onSelect={openAfterMenuCloses(() => setAssigning(c))}>
                  Vehicles
                </MenuItem>
                <MenuItem
                  icon={Printer}
                  onSelect={openAfterMenuCloses(() => setPrintReady(c))}
                >
                  Print received
                </MenuItem>
              </Menu>
            </>
          )}
        />

        <ProductionQueue
          title="Installing on vehicles"
          description="Print is in hand. When the wraps are on the vehicles, mark installed so the campaign goes live."
          query={installing}
          emptyTitle="Nothing being installed"
          emptyDescription="Campaigns appear here after the printer delivers the wraps."
          emptyIcon={Truck}
          renderActions={(c) => (
            <>
              <CampaignStatusBadge status={c.status} />
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
                <MenuItem icon={Car} onSelect={openAfterMenuCloses(() => setAssigning(c))}>
                  Vehicles
                </MenuItem>
                <MenuItem
                  icon={CheckCircle2}
                  onSelect={openAfterMenuCloses(() => setInstalled(c))}
                >
                  Mark installed
                </MenuItem>
              </Menu>
            </>
          )}
        />

        {/*
          Everything up to here is getting a campaign onto the road. This is
          what happens to it afterwards, which had no screen at all: a campaign
          could be started and never stopped, and its vehicles stayed booked to
          it for good.
        */}
        <ProductionQueue
          title="On the road"
          description="Running and paused campaigns. Pausing stops the meter without undressing the vehicles; completing or stopping releases them for the next advertiser. Drivers are told either way."
          query={running}
          emptyTitle="Nothing running"
          emptyDescription="Campaigns appear here once the wraps are on and they go live."
          emptyIcon={Radio}
          renderActions={(c) => (
            <>
              <CampaignStatusBadge status={c.status} />
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
                <MenuItem icon={Car} onSelect={openAfterMenuCloses(() => setAssigning(c))}>
                  Vehicles
                </MenuItem>
                {c.status === 'PAUSED' ? (
                  <MenuItem
                    icon={CirclePlay}
                    onSelect={openAfterMenuCloses(() =>
                      setChanging({ campaign: c, action: 'resume' }),
                    )}
                  >
                    Resume
                  </MenuItem>
                ) : (
                  <MenuItem
                    icon={CirclePause}
                    onSelect={openAfterMenuCloses(() =>
                      setChanging({ campaign: c, action: 'pause' }),
                    )}
                  >
                    Pause
                  </MenuItem>
                )}
                <MenuItem
                  icon={CheckCircle2}
                  onSelect={openAfterMenuCloses(() =>
                    setChanging({ campaign: c, action: 'complete' }),
                  )}
                >
                  Complete
                </MenuItem>
                <MenuItem
                  icon={OctagonX}
                  destructive
                  onSelect={openAfterMenuCloses(() => setChanging({ campaign: c, action: 'stop' }))}
                >
                  Stop early
                </MenuItem>
              </Menu>
            </>
          )}
        />
      </div>

      <ReviewCampaignDialog
        campaign={reviewing}
        onOpenChange={(open) => {
          if (!open) setReviewing(null);
        }}
        onReject={() => {
          if (!reviewing) return;
          const next = reviewing;
          setReviewing(null);
          setTimeout(() => setRejecting(next), 0);
        }}
      />
      <RejectCampaignDialog
        campaign={rejecting}
        onOpenChange={(open) => {
          if (!open) setRejecting(null);
        }}
      />
      <PrintReadyDialog
        campaign={printReady}
        onOpenChange={(open) => {
          if (!open) setPrintReady(null);
        }}
      />
      <InstalledDialog
        campaign={installed}
        onOpenChange={(open) => {
          if (!open) setInstalled(null);
        }}
      />
      <AssignVehiclesDialog
        campaign={assigning}
        onOpenChange={(open) => {
          if (!open) setAssigning(null);
        }}
      />
      <CampaignStatusDialog
        campaign={changing?.campaign ?? null}
        action={changing?.action ?? 'pause'}
        onOpenChange={(open) => {
          if (!open) setChanging(null);
        }}
      />
    </Page>
  );
}

const STAGES = [
  { label: 'Review brief', hint: 'Accept the creative, then send it to print' },
  { label: 'At printer', hint: 'Wait for the vendor to deliver the wraps' },
  { label: 'Installing', hint: 'Print is going onto the vehicles' },
  { label: 'On the road', hint: 'Pause, resume, or close it out' },
] as const;

/**
 * Where the work is, not a diagram of where it could be.
 *
 * These four tiles were decorative: fixed labels that read the same whether
 * there were thirty campaigns waiting on review or none. The count is the only
 * part an operator needs, so it is the part that has to be real — a stage with
 * nothing in it should recede rather than look like a queue.
 */
function ProductionSteps({ counts }: { counts: (number | undefined)[] }) {
  return (
    <ol aria-label="Production steps" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {STAGES.map((stage, index) => {
        const count = counts[index];
        const waiting = (count ?? 0) > 0;

        return (
          <li
            key={stage.label}
            className={cn(
              'flex items-start gap-3 rounded-xl border bg-white px-4 py-3',
              waiting ? 'border-brand-200 bg-brand-50/40' : 'border-slate-200',
            )}
          >
            <span
              className={cn(
                'numeric grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold',
                waiting ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500',
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold text-slate-900">{stage.label}</span>
                <span
                  className={cn(
                    'numeric text-[12px] font-semibold',
                    waiting ? 'text-brand-700' : 'text-slate-400',
                  )}
                >
                  {count === undefined ? '—' : formatCount(count)}
                </span>
              </span>
              <span className="mt-0.5 block text-[12px] text-slate-500">{stage.hint}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const menuTriggerClass =
  'cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none';

function ProductionQueue({
  title,
  description,
  query,
  emptyTitle,
  emptyDescription,
  emptyIcon: EmptyIcon,
  renderActions,
}: {
  title: string;
  description: string;
  query: ReturnType<typeof useAdminCampaigns>;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon: typeof ClipboardCheck;
  renderActions: (campaign: AdminCampaign) => ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />

      <QueryBoundary
        query={query}
        loading={<SkeletonTable rows={3} columns={6} />}
        isEmpty={(data) => data.items.length === 0}
        empty={
          <EmptyState icon={EmptyIcon} title={emptyTitle} description={emptyDescription} />
        }
      >
        {(data) => (
          <Table caption={title}>
            <THead>
              <TR>
                <TH>Campaign</TH>
                <TH>Advertiser</TH>
                <TH>Duration</TH>
                <TH numeric>Vehicles</TH>
                <TH numeric>Budget</TH>
                <TH>Submitted</TH>
                <TH>
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <span className="font-medium text-slate-900">{c.name}</span>
                    <span className="mt-0.5 block text-[12px] text-slate-500">
                      {c.brandName} · {c.city} · {c.vehicleType === 'AUTO' ? 'Auto' : 'Cab'}
                    </span>
                  </TD>
                  <TD>
                    <span className="text-slate-800">{c.advertiser.brandName}</span>
                    <span className="mt-0.5 block text-[12px] text-slate-500">
                      {c.advertiser.legalName}
                    </span>
                  </TD>
                  <TD className="whitespace-nowrap text-slate-600">
                    {formatDateRange(c.startDate, c.endDate)}
                  </TD>
                  <TD numeric>{formatCount(c.vehicleCount)}</TD>
                  <TD numeric>{formatINR(c.budget)}</TD>
                  <TD className="text-slate-600">{formatDate(c.submittedAt)}</TD>
                  <TD className="w-px">
                    <div className={cn('flex items-center justify-end gap-2')}>{renderActions(c)}</div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </QueryBoundary>
    </Card>
  );
}
