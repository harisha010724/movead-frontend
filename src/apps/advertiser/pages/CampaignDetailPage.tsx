import { type ComponentType, type ReactNode, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Car,
  ChevronLeft,
  ChevronRight,
  Eye,
  IndianRupee,
  MapPin,
  Pencil,
  Route,
  Search,
  UserRound,
  Users,
} from 'lucide-react';

import {
  useAdvertiserDashboard,
  useCampaign,
  useCampaignDrivers,
  useCampaignVisibility,
  type AdvertiserDashboard,
} from '@/shared/api/hooks';
import { Can } from '@/shared/auth/guards';
import { ADVERTISER_PERMISSIONS as PERMISSIONS } from '@/shared/auth/permissions';
import {
  formatCount,
  formatDateRange,
  formatINR,
  formatKm,
  formatKmWhole,
  formatPercent,
  formatRegistration,
  formatSignedPercent,
} from '@/shared/format';
import { cn } from '@/shared/lib/cn';
import { Page } from '@/shared/layout/Page';
import { canEditCampaign } from '@/shared/schemas/campaign';
import {
  Card,
  CardFooter,
  CardHeader,
  CampaignStatusBadge,
  EmptyState,
  LiveStateBadge,
  QueryBoundary,
  Skeleton,
  SkeletonStatCards,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/shared/ui';
import { resolveRange } from '@/shared/lib/dateRange';
import type { Campaign, CampaignVisibility } from '@/shared/types/domain';

/**
 * One campaign, who is carrying it, and what the driving has amounted to.
 *
 * The roster is a list again — a campaign has one or more drivers, and a KPI
 * card cannot hold that. Recorded trips open on their own page, per driver,
 * so the map is only asked for after someone is chosen.
 */

export default function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const campaign = useCampaign(campaignId);

  return (
    <QueryBoundary
      query={campaign}
      loading={
        <Page title="Campaign" backTo="/campaigns">
          <SkeletonStatCards count={4} />
        </Page>
      }
      errorTitle="Could not load this campaign"
    >
      {(data) => <CampaignDetail campaign={data} />}
    </QueryBoundary>
  );
}

function CampaignDetail({ campaign }: { campaign: Campaign }) {
  const dashboard = useAdvertiserDashboard(campaign.id, resolveRange('campaign', campaign.startDate));
  const visibility = useCampaignVisibility(campaign.id);

  return (
    <Page
      title={campaign.name}
      backTo="/campaigns"
      badge={<CampaignStatusBadge status={campaign.status} />}
      greeting={`${campaign.brandName} · ${campaign.city} · ${campaign.vehicleType === 'AUTO' ? 'Auto' : 'Cab'} · ${formatDateRange(campaign.startDate, campaign.endDate)}`}
      controls={
        <Can permission={PERMISSIONS.campaignCreate}>
          {canEditCampaign(campaign.status) ? (
            <Link
              to={`/campaigns/${campaign.id}/edit`}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="size-4" />
              Edit brief
            </Link>
          ) : null}
        </Can>
      }
    >
      <div className="space-y-5">
        <Figures campaign={campaign} dashboard={dashboard.data} visibility={visibility.data} />
        <DriversTable campaignId={campaign.id} />
      </div>
    </Page>
  );
}

const iconWell: Record<'green' | 'amber' | 'blue' | 'violet', string> = {
  green: 'bg-emerald-50 text-emerald-500',
  amber: 'bg-amber-50 text-amber-500',
  blue: 'bg-sky-50 text-sky-500',
  violet: 'bg-violet-50 text-violet-500',
};

function FigureCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ComponentType<{ className?: string }>;
  tone: keyof typeof iconWell;
  href?: string;
}) {
  const body = (
    <div className="flex h-full items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-slate-500">{label}</p>
        <div className="mt-1.5 text-[22px] leading-7 font-semibold tracking-tight text-slate-900">
          {value}
        </div>
        {hint ? <div className="mt-2 text-[12px] leading-5 text-slate-400">{hint}</div> : null}
      </div>
      <div className={cn('grid size-10 shrink-0 place-items-center rounded-full', iconWell[tone])}>
        <Icon className="size-4" />
      </div>
    </div>
  );

  const frame = 'block h-full rounded-2xl bg-white p-5 shadow-card';

  return href ? (
    <Link to={href} className={cn(frame, 'transition-shadow hover:shadow-card-hover')}>
      {body}
    </Link>
  ) : (
    <div className={frame}>{body}</div>
  );
}

function Figures({
  campaign,
  dashboard,
  visibility,
}: {
  campaign: Campaign;
  dashboard: AdvertiserDashboard | undefined;
  visibility: CampaignVisibility | undefined;
}) {
  const budget = Number(campaign.budget);
  const spent = Number(campaign.spent);
  const consumed = budget > 0 ? spent / budget : null;
  const kmChange = dashboard?.comparison.verifiedKm;
  const showKmChange =
    kmChange !== undefined && kmChange !== null && Number.isFinite(kmChange) && Math.abs(kmChange) >= 0.0005;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <FigureCard
        label="Verified Distance"
        value={
          <span className="flex items-baseline gap-2">
            <span className="numeric">{formatKm(campaign.verifiedKm)}</span>
            {showKmChange ? (
              <span
                className={cn(
                  'text-[13px] font-semibold',
                  kmChange < 0 ? 'text-rose-600' : 'text-emerald-600',
                )}
              >
                {formatSignedPercent(kmChange).replace('+', '')}
              </span>
            ) : null}
          </span>
        }
        icon={MapPin}
        tone="green"
        hint="Proved by GPS, and what you are billed on"
      />
      <FigureCard
        label="Spent"
        value={<span className="numeric">{formatINR(campaign.spent)}</span>}
        icon={IndianRupee}
        tone="amber"
        hint={
          <span className="block space-y-2">
            <span>
              {consumed === null
                ? `of ${formatINR(campaign.budget)}`
                : `${formatPercent(consumed)} of ${formatINR(campaign.budget)}`}
            </span>
            {consumed === null ? null : (
              <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="block h-full rounded-full bg-brand-500"
                  style={{ width: `${Math.min(consumed, 1) * 100}%` }}
                />
              </span>
            )}
          </span>
        }
      />
      <FigureCard
        label="Vehicles"
        value={<span className="numeric">{formatCount(campaign.vehicleCount)}</span>}
        icon={Car}
        tone="blue"
        href="/vehicles"
        hint="Carrying this campaign"
      />
      <FigureCard
        label="Readable while moving"
        value={
          <span className="numeric">
            {visibility && visibility.classifiedKm > 0 ? formatPercent(visibility.highShare) : '—'}
          </span>
        }
        icon={Eye}
        tone="violet"
        href="/analytics"
        hint={
          visibility && visibility.classifiedKm > 0
            ? `${formatKm(visibility.highKm)} of billed km under 15 km/h. Not what you are billed on.`
            : 'Share of billed km slow enough to read. Not what you are billed on.'
        }
      />
    </div>
  );
}

const DRIVER_PAGE = 5;

function DriversTableHead() {
  return (
    <THead>
      <TR>
        <TH>Driver</TH>
        <TH>Vehicle</TH>
        <TH>Area</TH>
        <TH numeric align="left">
          Verified KM
        </TH>
        <TH>Status</TH>
        <TH className="w-14">
          <span className="sr-only">Recorded trips</span>
        </TH>
      </TR>
    </THead>
  );
}

/**
 * The roster's own rows, pulsing — not one slab inside the card.
 *
 * Header, search, and column names stay put so a fetch only waits on the
 * people. Each placeholder follows the live cells: avatar, name, plate, area.
 */
function DriversSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading drivers">
      <Table>
        <DriversTableHead />
        <TBody>
          {Array.from({ length: DRIVER_PAGE }, (_, index) => (
            <TR key={index}>
              <TD>
                <span className="flex items-center gap-2.5">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                </span>
              </TD>
              <TD>
                <Skeleton className="h-4 w-24" />
              </TD>
              <TD>
                <Skeleton className="h-4 w-36" />
              </TD>
              <TD numeric align="left">
                <Skeleton className="h-4 w-16" />
              </TD>
              <TD>
                <Skeleton className="h-5 w-14 rounded-full" />
              </TD>
              <TD>
                <Skeleton className="size-8 rounded-full" />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

function DriversTable({ campaignId }: { campaignId: string }) {
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(draft.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const offset = (page - 1) * DRIVER_PAGE;
  const list = useCampaignDrivers(campaignId, { q, limit: DRIVER_PAGE, offset });
  const drivers = list.data?.drivers ?? [];
  const total = list.data?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = offset + drivers.length;
  const pageCount = Math.max(1, Math.ceil(total / DRIVER_PAGE));

  return (
    <Card>
      <CardHeader
        title="Drivers"
        description="Everyone carrying this campaign. Open recorded trips to see that person's route."
        action={
          <label className="relative w-72 max-w-full">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Search driver or vehicle..."
              aria-label="Search drivers"
              className="h-9 w-full rounded-full border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 focus:outline-none"
            />
          </label>
        }
      />
      {list.isPending ? (
        <DriversSkeleton />
      ) : total === 0 && !q ? (
        <EmptyState
          icon={Users}
          title="No drivers on this campaign yet"
          description="Drivers appear here once operations assigns a vehicle, or once someone starts tracking."
        />
      ) : drivers.length === 0 ? (
        <p className="px-5 pb-8 text-center text-sm text-slate-500">No drivers match that search.</p>
      ) : (
        <Table caption="Drivers on this campaign">
          <DriversTableHead />
          <TBody>
            {drivers.map((driver) => (
              <TR key={driver.id}>
                <TD>
                  <span className="flex items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                      <UserRound className="size-4" aria-hidden />
                    </span>
                    <span className="font-medium text-slate-900">{driver.name}</span>
                  </span>
                </TD>
                <TD>
                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                    <Car className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                    {driver.vehicleRegistration
                      ? formatRegistration(driver.vehicleRegistration)
                      : '—'}
                  </span>
                </TD>
                <TD>
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <MapPin className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                    {driver.area ?? '—'}
                  </span>
                </TD>
                <TD numeric align="left">
                  {formatKmWhole(driver.verifiedKm)}
                </TD>
                <TD>{driver.state ? <LiveStateBadge state={driver.state} /> : '—'}</TD>
                <TD>
                  <Link
                    to={`/campaigns/${campaignId}/trips/${driver.id}`}
                    aria-label={`Recorded trips for ${driver.name}`}
                    className="grid size-8 place-items-center rounded-full text-slate-400 hover:bg-slate-50 hover:text-brand-600"
                  >
                    <Route className="size-4" />
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {total > 0 ? (
        <CardFooter className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-slate-500">
            Showing {from}–{to} of {total} drivers
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous drivers page"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="grid size-7 place-items-center rounded-md text-slate-500 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
              <button
                key={number}
                type="button"
                aria-label={`Drivers page ${number}`}
                aria-current={number === page ? 'page' : undefined}
                onClick={() => setPage(number)}
                className={cn(
                  'grid size-7 place-items-center rounded-md text-[12px] font-medium',
                  number === page ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                {number}
              </button>
            ))}
            <button
              type="button"
              aria-label="Next drivers page"
              disabled={page === pageCount}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              className="grid size-7 place-items-center rounded-md text-slate-500 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </CardFooter>
      ) : null}
    </Card>
  );
}
