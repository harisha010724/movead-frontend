import { useEffect, useState, type ReactNode } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleParking,
  Info,
  Layers2,
  ListFilter,
  Map,
  MapPin,
  Route,
  Search,
} from 'lucide-react';

import { useCampaignTrip, useCampaignTrips } from '@/shared/api/hooks';
import {
  averageKmh,
  formatCount,
  formatDate,
  formatDuration,
  formatINR,
  formatKm,
  formatKmh,
  formatRegistration,
  formatTime,
} from '@/shared/format';
import { cn } from '@/shared/lib/cn';
import { JourneyStrip, JourneyTimeline } from '@/shared/maps/JourneyStops';
import { ParkedLocationDialog } from '@/shared/maps/ParkedLocationDialog';
import { TripRouteMap } from '@/shared/maps/TripRouteMap';
import { useNamedJourney } from '@/shared/maps/useNamedJourney';
import { useParkedName } from '@/shared/maps/useParkedName';
import type { CampaignParked, CampaignTrip, CampaignTripDetail, TripStatus } from '@/shared/types/domain';
import type { JourneyStop } from '@/shared/maps/tripJourney';
import {
  Badge,
  Card,
  CardFooter,
  EmptyState,
  ErrorState,
  Menu,
  MenuItem,
  QueryBoundary,
  Skeleton,
  Tooltip,
} from '@/shared/ui';
import { controlClass, controlHeight, InlineSelect } from '@/shared/ui/form';

const ALL_DRIVERS = 'all';
const PAGE_SIZE = 25;

const ZONE_LEGEND = [
  { label: 'Prime', swatch: 'bg-zone-prime' },
  { label: 'Secondary', swatch: 'bg-zone-secondary' },
  { label: 'Network', swatch: 'bg-zone-network' },
] as const;

const VISIBILITY_LEGEND = [
  { label: 'High <15 km/h', swatch: 'bg-emerald-500' },
  { label: 'Medium 15–35 km/h', swatch: 'bg-amber-500' },
  { label: 'Low >35 km/h', swatch: 'bg-slate-500' },
] as const;

type TripFilter = 'all' | TripStatus;

const STATUS_FILTERS: { id: TripFilter; label: string; dot: string }[] = [
  { id: 'all', label: 'All', dot: 'bg-brand-500' },
  { id: 'verified', label: 'Verified', dot: 'bg-emerald-500' },
  { id: 'pending_review', label: 'In Review', dot: 'bg-amber-400' },
  { id: 'rejected', label: 'Pending', dot: 'bg-slate-400' },
];

function MapCanvasSkeleton() {
  return (
    <div className="relative h-full bg-slate-100">
      <Skeleton className="absolute inset-x-[18%] top-[38%] h-1.5 rounded-full" />
      <Skeleton className="absolute top-[36%] left-[16%] size-3 rounded-full" />
      <Skeleton className="absolute top-[48%] left-[42%] size-3 rounded-full" />
      <Skeleton className="absolute top-[34%] right-[22%] size-3 rounded-full" />
    </div>
  );
}

function TripCardSkeleton() {
  return (
    <div className="rounded-2xl bg-slate-50 px-3.5 py-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="shrink-0 space-y-1.5">
          <Skeleton className="ml-auto h-3.5 w-12" />
          <Skeleton className="ml-auto h-3 w-14" />
        </div>
        <div className="shrink-0 space-y-1.5">
          <Skeleton className="h-3.5 w-12" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * The trips workspace's own shape, pulsing — not one slab.
 *
 * Title, search, map chrome and column of cards stay put so a fetch only
 * waits on the drives and the route.
 */
export function TripsWorkspaceSkeleton() {
  return (
    <div
      className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-slate-200"
      aria-busy="true"
      aria-label="Loading recorded trips"
    >
      <div className="absolute inset-0">
        <MapCanvasSkeleton />
      </div>

      <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
        <div className="inline-flex rounded-full bg-white/95 p-0.5 shadow-lg ring-1 ring-slate-200/80">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-slate-600">
            <Map className="size-3.5" aria-hidden />
            Map
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white">
            <Layers2 className="size-3.5" aria-hidden />
            Satellite
          </span>
        </div>
        <div className="inline-flex rounded-full bg-white/95 p-0.5 shadow-lg ring-1 ring-slate-200/80">
          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white">
            Colour by zone
          </span>
          <span className="rounded-full px-2.5 py-1 text-[11px] font-medium text-slate-600">
            Colour by visibility
          </span>
        </div>
        <ul className="flex flex-wrap justify-end gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[11px] text-slate-600 shadow-lg ring-1 ring-slate-200/80">
          {ZONE_LEGEND.map((item) => (
            <li key={item.label} className="inline-flex items-center gap-1.5">
              <span className={cn('size-2 rounded-full', item.swatch)} aria-hidden />
              {item.label}
            </li>
          ))}
        </ul>
      </div>

      <aside className="absolute inset-y-3 left-3 z-20 flex w-[30rem] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl bg-white/70 shadow-xl ring-1 ring-white/40 backdrop-blur-md">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="px-5 pt-5">
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
              Recorded Trips
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Newest first. Select a trip to replay it on the map.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400" />
                <div
                  className={cn(controlClass, controlHeight, 'rounded-full border-white/60 bg-white/55 pl-9')}
                />
              </div>
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/60 bg-white/50 text-slate-500">
                <ListFilter className="size-4" aria-hidden />
              </span>
            </div>
          </div>
          <ul className="mt-2 min-h-0 flex-1 space-y-2 overflow-hidden px-4 py-3">
            {Array.from({ length: 5 }, (_, index) => (
              <li key={index}>
                <TripCardSkeleton />
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-7 w-24" />
          </div>
        </div>
      </aside>
    </div>
  );
}

/**
 * The drives the driver app already recorded for this campaign.
 *
 * Newest first, and the newest is on the map until another is picked. A
 * campaign with several drivers is filtered from the dropdown — changing it
 * refetches that person's trips and redraws the map. Pages beyond the first
 * arrive as another page of 25, so a long flight can be walked through without
 * asking the server for every trip at once. Search and status are asked of
 * the server too — the list on screen is already the matching page.
 */
export function CampaignTrips({
  campaignId,
  lockedDriverId,
}: {
  campaignId: string;
  /** When set, this page is one driver's trips — no roster picker. */
  lockedDriverId?: string;
}) {
  const [driverId, setDriverId] = useState<string>(lockedDriverId ?? ALL_DRIVERS);

  useEffect(() => {
    if (lockedDriverId) setDriverId(lockedDriverId);
  }, [lockedDriverId]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [selectedLeg, setSelectedLeg] = useState<number | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TripFilter>('all');
  const [page, setPage] = useState(1);
  const [colourBy, setColourBy] = useState<'zone' | 'visibility'>('zone');
  const [parkedOpen, setParkedOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('hybrid');

  useEffect(() => {
    const next = searchDraft.trim();
    const timer = window.setTimeout(() => {
      setSearch((current) => {
        if (current !== next) setPage(1);
        return next;
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const list = useCampaignTrips(campaignId, {
    driverId: driverId === ALL_DRIVERS ? null : driverId,
    q: search,
    status: statusFilter === 'all' ? undefined : statusFilter,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const drivers = list.data?.drivers ?? [];
  const trips = list.data?.trips ?? [];
  const total = list.data?.total ?? 0;
  const statusCounts = list.data?.statusCounts ?? {
    all: 0,
    verified: 0,
    pending_review: 0,
    rejected: 0,
  };
  const selectedId =
    pickedId && trips.some((trip) => trip.id === pickedId) ? pickedId : (trips[0]?.id ?? null);
  const trip = useCampaignTrip(campaignId, selectedId);
  const journey = useNamedJourney(trip.data);
  const parkedName = useParkedName(trip.data?.parked);

  const openTrip = (id: string) => {
    setPickedId(id);
    setSelectedLeg(null);
    setParkedOpen(false);
  };

  const openParked = (id: string) => {
    setPickedId(id);
    setSelectedLeg(null);
    setParkedOpen(true);
  };

  const pickDriver = (value: string) => {
    setDriverId(value);
    setPickedId(null);
    setSelectedLeg(null);
    setParkedOpen(false);
    setPage(1);
  };

  if (list.isPending && !list.data) {
    return <TripsWorkspaceSkeleton />;
  }

  if (list.isError) {
    return (
      <ErrorState
        error={list.error}
        onRetry={() => void list.refetch()}
        title="Could not load the trips for this campaign"
      />
    );
  }

  const driverOptions = [
    { value: ALL_DRIVERS, label: 'All drivers' },
    ...drivers.map((driver) => ({ value: driver.id, label: driver.name })),
  ];
  const picker =
    !lockedDriverId && drivers.length > 1 ? (
      <InlineSelect
        label="Driver"
        value={driverId}
        onValueChange={pickDriver}
        options={driverOptions}
      />
    ) : null;

  if (trips.length === 0 && drivers.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Route}
          title="No trips recorded yet"
          description="Trips appear here once a driver carrying this campaign starts tracking. The most recent drive is shown on the map."
        />
      </Card>
    );
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-slate-200">
      <div className="absolute inset-0">
        {!selectedId ? (
          <div className="grid h-full place-items-center bg-slate-100">
            <p className="max-w-xs text-center text-sm text-slate-500">
              {total === 0 && !search && statusFilter === 'all'
                ? 'This driver has no recorded trips yet.'
                : 'Choose a trip to see where it ran.'}
            </p>
          </div>
        ) : (
          <QueryBoundary
            query={trip}
            loading={<MapCanvasSkeleton />}
            errorTitle="Could not load that trip"
          >
            {(detail) => (
              <TripRoutePanel
                detail={detail}
                stops={journey}
                parkedName={parkedName}
                selectedLeg={selectedLeg}
                onSelectLeg={setSelectedLeg}
                colourBy={colourBy}
                mapType={mapType}
                panelOpen={panelOpen}
                onShowParked={() => openParked(detail.id)}
              />
            )}
          </QueryBoundary>
        )}
      </div>

      <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
        <div
          className="inline-flex rounded-full bg-white/95 p-0.5 shadow-lg ring-1 ring-slate-200/80"
          role="group"
          aria-label="Map style"
        >
          <button
            type="button"
            aria-pressed={mapType === 'roadmap'}
            onClick={() => setMapType('roadmap')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
              mapType === 'roadmap' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            <Map className="size-3.5" aria-hidden />
            Map
          </button>
          <button
            type="button"
            aria-pressed={mapType === 'hybrid'}
            onClick={() => setMapType('hybrid')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
              mapType === 'hybrid' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            <Layers2 className="size-3.5" aria-hidden />
            Satellite
          </button>
        </div>
        <div
          className="inline-flex rounded-full bg-white/95 p-0.5 shadow-lg ring-1 ring-slate-200/80"
          role="group"
          aria-label="Colour the route by"
        >
          {(
            [
              ['zone', 'Colour by zone'],
              ['visibility', 'Colour by visibility'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={colourBy === value}
              onClick={() => setColourBy(value)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-medium',
                colourBy === value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <ul className="flex flex-wrap justify-end gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[11px] text-slate-600 shadow-lg ring-1 ring-slate-200/80">
          {(colourBy === 'visibility' ? VISIBILITY_LEGEND : ZONE_LEGEND).map((item) => (
            <li key={item.label} className="inline-flex items-center gap-1.5">
              <span className={cn('size-2 rounded-full', item.swatch)} aria-hidden />
              {item.label}
            </li>
          ))}
        </ul>
      </div>

      {panelOpen ? (
        <aside className="absolute inset-y-3 left-3 z-20 flex w-[30rem] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl bg-white/70 shadow-xl ring-1 ring-white/40 backdrop-blur-md">
          <RecordedTripsCard
            trips={trips}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            selectedId={selectedId}
            statusCounts={statusCounts}
            statusFilter={statusFilter}
            onStatusFilter={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
            search={searchDraft}
            onSearch={setSearchDraft}
            picker={picker}
            onPage={setPage}
            onSelect={openTrip}
            journey={journey}
            parked={trip.data?.id === selectedId ? trip.data.parked : null}
            parkedName={trip.data?.id === selectedId ? parkedName : null}
            onShowParked={openParked}
            onCollapse={() => setPanelOpen(false)}
          />
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label="Show recorded trips"
          className="absolute top-3 left-3 z-20 inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-2 text-[13px] font-medium text-slate-800 shadow-lg ring-1 ring-white/50 backdrop-blur-md"
        >
          <Route className="size-4 text-brand-500" aria-hidden />
          Recorded trips
        </button>
      )}

      <ParkedLocationDialog
        open={parkedOpen}
        onClose={() => setParkedOpen(false)}
        parked={trip.data?.id === selectedId ? trip.data.parked : null}
        loading={trip.isPending}
      />
    </div>
  );
}

function TripRoutePanel({
  detail,
  stops,
  parkedName,
  selectedLeg,
  onSelectLeg,
  colourBy,
  mapType,
  panelOpen,
  onShowParked,
}: {
  detail: CampaignTripDetail;
  stops: JourneyStop[];
  parkedName: string | null;
  selectedLeg: number | null;
  onSelectLeg: (index: number | null) => void;
  colourBy: 'zone' | 'visibility';
  mapType: 'roadmap' | 'hybrid';
  panelOpen: boolean;
  onShowParked: () => void;
}) {
  const [journeyOpen, setJourneyOpen] = useState(true);
  const overlayStart = panelOpen ? 'left-[31.5rem]' : 'left-3';

  return (
    <div className="relative h-full">
      <TripRouteMap
        legs={detail.legs}
        selectedLeg={selectedLeg}
        onSelectLeg={onSelectLeg}
        colourBy={colourBy}
        mapType={mapType}
        showLegend={false}
        stops={stops}
        parked={
          detail.parked
            ? { ...detail.parked, name: parkedName ?? 'Parked here' }
            : null
        }
      />
      {detail.parked ? (
        <button
          type="button"
          onClick={() => onShowParked()}
          aria-label={`Parked ${formatDuration(detail.parked.seconds)}. Show where`}
          className={cn(
            'absolute z-10 flex max-w-md items-start gap-2 rounded-2xl bg-white/70 px-3 py-2.5 text-left text-[13px] text-slate-700 shadow-lg ring-1 ring-white/40 backdrop-blur-md',
            overlayStart,
            journeyOpen && stops.length > 0 ? 'bottom-[5.25rem]' : 'bottom-3',
          )}
        >
          <CircleParking className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
          <span>
            <span className="font-medium">
              Parked {formatDuration(detail.parked.seconds)}
            </span>
            {' at '}
            {parkedName ?? `${detail.parked.lat.toFixed(5)}, ${detail.parked.lng.toFixed(5)}`}
          </span>
        </button>
      ) : null}
      {stops.length > 0 && journeyOpen ? (
        <div
          className={cn(
            'absolute right-3 bottom-3 z-10 rounded-xl bg-white/70 px-3 py-1.5 shadow-lg ring-1 ring-white/40 backdrop-blur-md',
            overlayStart,
          )}
        >
          <div className="flex items-start gap-2">
            <p className="w-16 shrink-0 pt-1 text-[11px] font-semibold text-slate-800">
              Start to end
            </p>
            <JourneyStrip stops={stops} className="min-w-0 flex-1" />
            <button
              type="button"
              onClick={() => setJourneyOpen(false)}
              aria-label="Hide trip journey"
              className="grid size-6 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-white/70 hover:text-slate-700"
            >
              <ChevronDown className="size-3.5" />
            </button>
          </div>
        </div>
      ) : stops.length > 0 ? (
        <button
          type="button"
          onClick={() => setJourneyOpen(true)}
          aria-label="Show trip journey"
          className={cn(
            'absolute bottom-3 z-10 inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-2 text-[13px] font-medium text-slate-800 shadow-lg ring-1 ring-white/50 backdrop-blur-md',
            overlayStart,
          )}
        >
          <Route className="size-4 text-brand-500" aria-hidden />
          Start to end
        </button>
      ) : null}
    </div>
  );
}

function RecordedTripsCard({
  trips,
  total,
  page,
  pageSize,
  selectedId,
  statusCounts,
  statusFilter,
  onStatusFilter,
  search,
  onSearch,
  picker,
  onPage,
  onSelect,
  journey,
  parked,
  parkedName,
  onShowParked,
  onCollapse,
}: {
  trips: CampaignTrip[];
  total: number;
  page: number;
  pageSize: number;
  selectedId: string | null;
  statusCounts: Record<TripFilter, number>;
  statusFilter: TripFilter;
  onStatusFilter: (value: TripFilter) => void;
  search: string;
  onSearch: (value: string) => void;
  picker: ReactNode;
  onPage: (page: number) => void;
  onSelect: (id: string) => void;
  journey: JourneyStop[];
  parked: CampaignParked | null;
  parkedName: string | null;
  onShowParked: (id: string) => void;
  onCollapse: () => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + trips.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
              Recorded Trips
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Newest first. Select a trip to replay it on the map.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {picker}
            <button
              type="button"
              onClick={onCollapse}
              aria-label="Hide recorded trips"
              className="grid size-8 place-items-center rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search trip, vehicle or date..."
              aria-label="Search trips"
              className={cn(controlClass, controlHeight, 'rounded-full border-white/60 bg-white/55 pl-9')}
            />
          </label>
          <Menu
            trigger={
              <button
                type="button"
                aria-label="Filter trips"
                aria-pressed={statusFilter !== 'all'}
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-full border text-slate-500 hover:bg-white/70',
                  statusFilter !== 'all'
                    ? 'border-brand-200 bg-white/80 text-brand-600'
                    : 'border-white/60 bg-white/50',
                )}
              >
                <ListFilter className="size-4" />
              </button>
            }
          >
            {STATUS_FILTERS.map((filter) => (
              <MenuItem key={filter.id} onSelect={() => onStatusFilter(filter.id)}>
                <span className={cn('size-2 shrink-0 rounded-full', filter.dot)} aria-hidden />
                <span className="min-w-0 flex-1">{filter.label}</span>
                <span className="numeric text-[12px] text-slate-400">
                  {statusCounts[filter.id]}
                </span>
              </MenuItem>
            ))}
          </Menu>
        </div>
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
        {total === 0 && !search && statusFilter === 'all' ? (
          <p className="grid h-full place-items-center px-5 py-10 text-center text-sm text-slate-500">
            No trips for this driver yet.
          </p>
        ) : trips.length === 0 ? (
          <p className="grid h-full place-items-center px-5 py-10 text-center text-sm text-slate-500">
            No trips match that search.
          </p>
        ) : (
          <ul className="space-y-2 px-4 py-3">
            {trips.map((item) => (
              <li key={item.id}>
                <TripButton
                  trip={item}
                  selected={item.id === selectedId}
                  onSelect={() => onSelect(item.id)}
                  onShowParked={() => onShowParked(item.id)}
                  stops={item.id === selectedId ? journey : []}
                  parked={item.id === selectedId ? parked : null}
                  parkedName={item.id === selectedId ? parkedName : null}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {total > 0 ? (
        <CardFooter className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-slate-500">
            Showing {from}–{to} of {total} trips
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              disabled={page === 1}
              onClick={() => onPage(Math.max(1, page - 1))}
              className="grid size-7 place-items-center rounded-md text-slate-500 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
              <button
                key={number}
                type="button"
                aria-label={`Page ${number}`}
                aria-current={number === page ? 'page' : undefined}
                onClick={() => onPage(number)}
                className={cn(
                  'grid size-7 place-items-center rounded-md text-[12px] font-medium',
                  number === page
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                {number}
              </button>
            ))}
            <button
              type="button"
              aria-label="Next page"
              disabled={page === pageCount}
              onClick={() => onPage(Math.min(pageCount, page + 1))}
              className="grid size-7 place-items-center rounded-md text-slate-500 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </CardFooter>
      ) : null}
    </div>
  );
}

function TripButton({
  trip,
  selected,
  onSelect,
  onShowParked,
  stops,
  parked,
  parkedName,
}: {
  trip: CampaignTrip;
  selected: boolean;
  onSelect: () => void;
  onShowParked: () => void;
  stops: JourneyStop[];
  parked: CampaignParked | null;
  parkedName: string | null;
}) {
  const [placesOpen, setPlacesOpen] = useState(selected);

  useEffect(() => {
    if (selected) setPlacesOpen(true);
  }, [selected]);

  const togglePlaces = () => {
    if (!selected) onSelect();
    setPlacesOpen((open) => (selected ? !open : true));
  };

  const kmh = averageKmh(
    trip.verifiedKm,
    (Date.parse(trip.endedAt) - Date.parse(trip.startedAt)) / 1000,
  );

  return (
    <div
      className={cn(
        'rounded-2xl px-3.5 py-3 transition-colors',
        selected
          ? 'bg-brand-50 ring-1 ring-brand-200'
          : 'bg-slate-50 ring-1 ring-transparent hover:bg-slate-100',
      )}
    >
    <div className="flex items-center gap-1">
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="flex min-w-0 flex-1 items-center gap-3 text-left"
    >
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-full',
          selected ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-400',
        )}
      >
        <MapPin className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-slate-900">
          {formatDate(trip.startedAt)}
        </span>
        <span className="mt-0.5 block text-[12px] text-slate-500">
          {formatTime(trip.startedAt)} – {formatTime(trip.endedAt)}
        </span>
        <span className="mt-0.5 block text-[12px] whitespace-nowrap text-slate-500">
          {formatRegistration(trip.vehicleRegistration)}
        </span>
      </span>
      <span className="numeric shrink-0 text-right text-[13px] text-slate-600">
        <span className="block">{formatKm(trip.verifiedKm)}</span>
        {kmh == null ? null : (
          <span className="mt-0.5 flex items-center justify-end gap-1 text-[12px] text-slate-500">
            <span>{formatKmh(kmh)}</span>
            <Tooltip label="Avg Speed">
              <span
                className="inline-flex text-slate-400"
                aria-label="Avg Speed"
              >
                <Info className="size-3" aria-hidden />
              </span>
            </Tooltip>
          </span>
        )}
        {trip.impressions > 0 ? (
          <span className="mt-0.5 flex items-center justify-end gap-1 text-[12px] text-slate-500">
            <span>{formatCount(trip.impressions)}</span>
            <Tooltip label="Modelled impressions">
              <span className="inline-flex text-slate-400" aria-label="Modelled impressions">
                <Info className="size-3" aria-hidden />
              </span>
            </Tooltip>
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="numeric text-[13px] font-semibold text-slate-900">
          {formatINR(trip.charge)}
        </span>
        {trip.status === 'pending_review' ? (
          <Badge tone="warning">In review</Badge>
        ) : trip.status === 'rejected' ? (
          <Badge tone="neutral">Pending</Badge>
        ) : (
          <Badge tone="success">Verified</Badge>
        )}
      </span>
    </button>
    <button
      type="button"
      aria-expanded={selected && placesOpen}
      aria-label={
        !selected
          ? 'Show trip places'
          : placesOpen
            ? 'Collapse trip places'
            : 'Expand trip places'
      }
      onClick={togglePlaces}
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-full',
        selected ? 'text-brand-500 hover:bg-brand-100' : 'text-slate-300 hover:bg-slate-50',
      )}
    >
      <ChevronDown className={cn('size-4 transition-transform', selected && placesOpen ? 'rotate-180' : '')} />
    </button>
    </div>
    {trip.idleSecondsBefore != null ? (
      <button
        type="button"
        onClick={onShowParked}
        aria-label={`Parked ${formatDuration(trip.idleSecondsBefore)}. Show where`}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[12px] font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-white hover:text-slate-800"
      >
        <CircleParking className="size-3.5 shrink-0" aria-hidden />
        Parked {formatDuration(trip.idleSecondsBefore)}
        {selected && parked ? (
          <span className="font-normal text-slate-500">
            · {parkedName ?? `${parked.lat.toFixed(5)}, ${parked.lng.toFixed(5)}`}
          </span>
        ) : null}
      </button>
    ) : null}
    {selected && placesOpen && stops.length > 0 ? <JourneyTimeline stops={stops} /> : null}
    </div>
  );
}
