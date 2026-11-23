import { useMemo, useState, type ReactNode } from 'react';
import * as RTabs from '@radix-ui/react-tabs';
import {
  Car,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  ClipboardCheck,
  OctagonX,
  Printer,
  Radio,
  ScanSearch,
  SearchX,
  Truck,
} from 'lucide-react';
import { useAdminCampaigns } from '@/shared/api/hooks';
import { Page } from '@/shared/layout/Page';
import { Button, Card, EmptyState, MenuItem, Pagination, QueryBoundary, SkeletonTable } from '@/shared/ui';
import { formatCount } from '@/shared/format';
import { platformTodayIso } from '@/shared/lib/civilDate';
import { cn } from '@/shared/lib/cn';
import type { AdminCampaign } from '@/shared/types/domain';
import { AssignVehiclesDialog } from './AssignVehiclesDialog';
import { CampaignStatusDialog, type CampaignAction } from './CampaignStatusDialog';
import { InstalledDialog } from './InstalledDialog';
import { PrintReadyDialog } from './PrintReadyDialog';
import { RejectCampaignDialog } from './RejectCampaignDialog';
import { ReviewCampaignDialog } from './ReviewCampaignDialog';
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  deadlineOf,
  distinctOptions,
  filterCampaigns,
  progressOf,
  sortCampaigns,
  STATUS_LABEL,
  toCsv,
  type ProductionFilters,
  type StageId,
} from './campaignProduction';
import { ProductionTable, type RowAction } from './ProductionTable';
import { ProductionToolbar } from './ProductionToolbar';

/**
 * Most campaigns one stage loads. The server caps a page at 100, and a stage
 * rarely holds more than a few dozen; search and filters work on these.
 */
const LOAD_LIMIT = 100;

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
  const review = useAdminCampaigns({ status: 'PENDING_APPROVAL', pageSize: LOAD_LIMIT });
  const printing = useAdminCampaigns({ status: 'APPROVED', pageSize: LOAD_LIMIT });
  const installing = useAdminCampaigns({ status: 'AWAITING_INSTALLATION', pageSize: LOAD_LIMIT });
  const live = useAdminCampaigns({ status: 'ACTIVE', pageSize: LOAD_LIMIT });
  const paused = useAdminCampaigns({ status: 'PAUSED', pageSize: LOAD_LIMIT });

  const [reviewing, setReviewing] = useState<AdminCampaign | null>(null);
  const [rejecting, setRejecting] = useState<AdminCampaign | null>(null);
  const [printReady, setPrintReady] = useState<AdminCampaign | null>(null);
  const [installed, setInstalled] = useState<AdminCampaign | null>(null);
  const [assigning, setAssigning] = useState<AdminCampaign | null>(null);
  const [changing, setChanging] = useState<{
    campaign: AdminCampaign;
    action: CampaignAction;
  } | null>(null);
  const [picked, setPicked] = useState<StageId | null>(null);

  const openAfterMenuCloses = (open: () => void) => () => {
    setTimeout(open, 0);
  };

  /** Running and paused are one stage: both are campaigns on vehicles. */
  const running = useMemo(
    () => ({
      ...live,
      data:
        live.data && paused.data
          ? {
              ...live.data,
              items: [...live.data.items, ...paused.data.items],
              total: live.data.total + paused.data.total,
            }
          : undefined,
      isPending: live.isPending || paused.isPending,
      isError: live.isError || paused.isError,
      error: live.error ?? paused.error,
      refetch: () => Promise.all([live.refetch(), paused.refetch()]),
    }),
    [live, paused],
  ) as unknown as ReturnType<typeof useAdminCampaigns>;

  // A fixed-length list, so `stages[0]` is known to exist.
  const stages: [Stage, Stage, Stage, Stage] = [
    {
      id: 'review',
      label: 'Awaiting review',
      icon: ClipboardCheck,
      description:
        'Approve the brief to lock it and send the creative to the printer. Reject only with a reason the advertiser can act on.',
      query: review,
      emptyTitle: 'Nothing waiting for review',
      emptyDescription: 'When an advertiser submits a campaign it appears here.',
      primary: (c) => ({ label: 'Review', onSelect: () => setReviewing(c) }),
      menu: (c) => (
        <MenuItem icon={ScanSearch} onSelect={openAfterMenuCloses(() => setReviewing(c))}>
          Review
        </MenuItem>
      ),
    },
    {
      id: 'printing',
      label: 'At printer',
      icon: Printer,
      description:
        'The brief is locked. When the vendor delivers the wraps, mark print ready so installation can start.',
      query: printing,
      emptyTitle: 'Nothing at the printer',
      emptyDescription: 'Approved campaigns wait here until the printer delivers the ads.',
      primary: (c) => ({ label: 'Print received', onSelect: () => setPrintReady(c) }),
      menu: (c) => (
        <>
          <MenuItem icon={Car} onSelect={openAfterMenuCloses(() => setAssigning(c))}>
            Vehicles
          </MenuItem>
          <MenuItem icon={Printer} onSelect={openAfterMenuCloses(() => setPrintReady(c))}>
            Print received
          </MenuItem>
        </>
      ),
    },
    {
      id: 'installing',
      label: 'Installing',
      icon: Truck,
      description:
        'Print is in hand. When the wraps are on the vehicles, mark installed so the campaign goes live.',
      query: installing,
      emptyTitle: 'Nothing being installed',
      emptyDescription: 'Campaigns appear here after the printer delivers the wraps.',
      primary: (c) => ({ label: 'Mark installed', onSelect: () => setInstalled(c) }),
      menu: (c) => (
        <>
          <MenuItem icon={Car} onSelect={openAfterMenuCloses(() => setAssigning(c))}>
            Vehicles
          </MenuItem>
          <MenuItem icon={CheckCircle2} onSelect={openAfterMenuCloses(() => setInstalled(c))}>
            Mark installed
          </MenuItem>
        </>
      ),
    },
    /*
      Everything up to here is getting a campaign onto the road. This is what
      happens to it afterwards, which had no screen at all: a campaign could be
      started and never stopped, and its vehicles stayed booked to it for good.
    */
    {
      id: 'running',
      label: 'On the road',
      icon: Radio,
      description:
        'Running and paused campaigns. Pausing stops the meter without undressing the vehicles; completing or stopping releases them for the next advertiser. Drivers are told either way.',
      query: running,
      emptyTitle: 'Nothing running',
      emptyDescription: 'Campaigns appear here once the wraps are on and they go live.',
      primary: (c) => ({ label: 'Vehicles', onSelect: () => setAssigning(c) }),
      menu: (c) => (
        <>
          <MenuItem icon={Car} onSelect={openAfterMenuCloses(() => setAssigning(c))}>
            Vehicles
          </MenuItem>
          {c.status === 'PAUSED' ? (
            <MenuItem
              icon={CirclePlay}
              onSelect={openAfterMenuCloses(() => setChanging({ campaign: c, action: 'resume' }))}
            >
              Resume
            </MenuItem>
          ) : (
            <MenuItem
              icon={CirclePause}
              onSelect={openAfterMenuCloses(() => setChanging({ campaign: c, action: 'pause' }))}
            >
              Pause
            </MenuItem>
          )}
          <MenuItem
            icon={CheckCircle2}
            onSelect={openAfterMenuCloses(() => setChanging({ campaign: c, action: 'complete' }))}
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
        </>
      ),
    },
  ];

  /*
   * Open on the first stage that has work in it, so an operator is not left
   * looking at an empty "Awaiting review" with the real queue one tab over.
   * Once they choose a tab themselves, that choice stands.
   */
  const settled = stages.every((stage) => !stage.query.isPending);
  const firstWithWork = stages.find((stage) => (stage.query.data?.total ?? 0) > 0)?.id;
  const activeId: StageId = picked ?? (settled ? firstWithWork : undefined) ?? 'review';
  const active = stages.find((stage) => stage.id === activeId) ?? stages[0];

  return (
    <Page
      title="Campaign production"
      greeting="Review the brief, print the ads, install them on vehicles, then run the campaign to its end"
    >
      <RTabs.Root value={activeId} onValueChange={(next) => setPicked(next as StageId)}>
        <RTabs.List
          aria-label="Production stages"
          className="mb-5 grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white xl:grid-cols-4"
        >
          {stages.map((stage, index) => {
            const count = stage.query.data?.total;
            return (
              <RTabs.Trigger
                key={stage.id}
                value={stage.id}
                className={cn(
                  'flex cursor-pointer items-center justify-center gap-2 px-4 py-3.5 text-[13px] font-medium',
                  'text-slate-600 transition-colors hover:bg-slate-50',
                  'focus-visible:ring-brand-500/40 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
                  'data-[state=active]:bg-brand-600 data-[state=active]:text-white data-[state=active]:hover:bg-brand-600',
                  // Two columns on a narrow screen, four on a wide one.
                  'border-slate-200 xl:border-t-0',
                  index % 2 === 1 && 'border-l',
                  index >= 2 && 'border-t',
                  index > 0 && 'xl:border-l',
                )}
              >
                <stage.icon className="size-4 shrink-0" aria-hidden />
                <span>{stage.label}</span>
                <span className="numeric">({count === undefined ? '—' : formatCount(count)})</span>
              </RTabs.Trigger>
            );
          })}
        </RTabs.List>

        <RTabs.Content value={activeId} className="focus-visible:outline-none">
          <Card>
            <p className="px-5 pt-5 text-[13px] text-slate-500">{active.description}</p>
            <QueryBoundary
              query={active.query}
              loading={<SkeletonTable rows={5} columns={7} />}
              isEmpty={(data) => data.items.length === 0}
              empty={
                <EmptyState
                  icon={active.icon}
                  title={active.emptyTitle}
                  description={active.emptyDescription}
                />
              }
            >
              {(data) => (
                <StagePanel
                  // A new stage starts from a clean set of filters and the first page.
                  key={active.id}
                  stage={active}
                  campaigns={data.items}
                  total={data.total}
                />
              )}
            </QueryBoundary>
          </Card>
        </RTabs.Content>
      </RTabs.Root>

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

interface Stage {
  id: StageId;
  label: string;
  icon: typeof ClipboardCheck;
  description: string;
  query: ReturnType<typeof useAdminCampaigns>;
  emptyTitle: string;
  emptyDescription: string;
  /** The one next step for this stage, shown as the row's button. */
  primary: (campaign: AdminCampaign) => RowAction;
  /** Every action, in the row's menu. */
  menu: (campaign: AdminCampaign) => ReactNode;
}

function downloadCsv(filename: string, csv: string): void {
  // The byte-order mark makes Excel read the file as UTF-8, so ₹ and names survive.
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Filters, table and pagination for the stage on screen. */
function StagePanel({
  stage,
  campaigns,
  total,
}: {
  stage: Stage;
  campaigns: AdminCampaign[];
  total: number;
}) {
  const [filters, setFilters] = useState<ProductionFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const cities = useMemo(
    () => distinctOptions(campaigns, (c) => ({ value: c.city, label: c.city })),
    [campaigns],
  );
  const advertisers = useMemo(
    () =>
      distinctOptions(campaigns, (c) => ({ value: c.advertiser.id, label: c.advertiser.brandName })),
    [campaigns],
  );
  const statuses = useMemo(
    () =>
      distinctOptions(campaigns, (c) => ({
        value: c.status,
        label: STATUS_LABEL[c.status] ?? c.status,
      })),
    [campaigns],
  );

  const rows = useMemo(
    () => sortCampaigns(filterCampaigns(campaigns, filters), filters.sort, stage.id),
    [campaigns, filters, stage.id],
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * pageSize, current * pageSize);
  const activeCount = activeFilterCount(filters);

  function change(patch: Partial<ProductionFilters>): void {
    setFilters((was) => ({ ...was, ...patch }));
    setPage(1);
  }

  function reset(): void {
    setFilters((was) => ({ ...DEFAULT_FILTERS, sort: was.sort }));
    setPage(1);
  }

  function exportRows(): void {
    const csv = toCsv(
      [
        'Campaign',
        'Brand',
        'Advertiser',
        'City',
        'Vehicle type',
        'Vehicles',
        'Submitted',
        stage.id === 'running' ? 'Ends' : 'Go live by',
        'Status',
        'Budget used %',
      ],
      rows.map((c) => [
        c.name,
        c.brandName,
        c.advertiser.brandName,
        c.city,
        c.vehicleType,
        String(c.vehicleCount),
        c.submittedAt,
        deadlineOf(c, stage.id),
        c.status,
        String(Math.round(progressOf(c) * 100)),
      ]),
    );
    downloadCsv(`campaigns-${stage.id}-${platformTodayIso()}.csv`, csv);
  }

  return (
    <>
      <div className="px-5 pt-4 pb-4">
        <ProductionToolbar
          filters={filters}
          onChange={change}
          cities={cities}
          advertisers={advertisers}
          statuses={statuses}
          activeCount={activeCount}
          onReset={reset}
          onExport={exportRows}
          canExport={rows.length > 0}
        />
        {total > campaigns.length ? (
          <p className="mt-3 text-[12px] text-slate-500">
            Showing the {formatCount(campaigns.length)} most recent of {formatCount(total)}{' '}
            campaigns in this stage. Search and filters apply to these.
          </p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No campaigns match"
          description="Nothing in this stage fits the search and filters you have set."
          action={
            <Button variant="secondary" size="sm" onClick={reset}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <ProductionTable
            caption={stage.label}
            stage={stage.id}
            campaigns={visible}
            primaryAction={stage.primary}
            renderMenu={stage.menu}
          />
          <Pagination
            page={current}
            pageSize={pageSize}
            total={rows.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            noun="campaigns"
          />
        </>
      )}
    </>
  );
}