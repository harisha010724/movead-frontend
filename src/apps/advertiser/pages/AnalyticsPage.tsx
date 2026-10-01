import { useState } from 'react';
import {
  Building2,
  Clock,
  Eye,
  Gauge,
  Home,
  MapPin,
  Store,
  TrafficCone,
  TrainFront,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useCampaigns, useCampaignVisibility } from '@/shared/api/hooks';
import { formatDuration, formatKm, formatPercent } from '@/shared/format';
import { cn } from '@/shared/lib/cn';
import { Page } from '@/shared/layout/Page';
import { isNamed } from '@/shared/maps/tripJourney';
import {
  VISIBILITY_PLACE_LABEL,
  type Campaign,
  type CampaignDayparts,
  type CampaignVisibility,
  type VisibilityKindTotal,
  type VisibilityPlace,
  type VisibilityPlaceKind,
} from '@/shared/types/domain';
import { Card, CardBody, CardHeader, EmptyState, QueryBoundary, Skeleton } from '@/shared/ui';
import { DonutChart } from '@/shared/ui/charts';
import { InlineSelect } from '@/shared/ui/form';

/**
 * How readable the wrap was, from the same GPS that billed the kilometres.
 *
 * A donut rather than a bar: the question is a share of one whole ("how much
 * of what you paid for was slow enough to read while moving"), and a ring
 * with that High share in the centre answers it in one look. The published
 * 15 / 35 km/h cutoffs travel on the slices so the rule cannot be invented
 * on the screen. Nothing here multiplies a charge.
 */

const BAND_COLORS = {
  high: '#16a34a',
  medium: '#d97706',
  low: '#64748b',
} as const;

const DAYPART_COLORS = {
  morning: '#0ea5e9',
  midday: '#eab308',
  evening: '#f97316',
  night: '#334155',
} as const;

function DonutSkeleton({ legend = 3 }: { legend?: number }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative size-[220px] shrink-0">
        <Skeleton className="h-full w-full rounded-full" />
        <div className="absolute inset-[17%] rounded-full bg-white" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <dl className="w-full max-w-xs space-y-1.5">
        {Array.from({ length: legend }, (_, index) => (
          <div key={index} className="flex items-center gap-2">
            <Skeleton className="size-2 shrink-0 rounded-full" />
            <Skeleton className="h-3 min-w-0 flex-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * The page's own shape, pulsing — not one slab.
 *
 * A single rectangle makes the first paint look empty and then jump. These
 * cards sit where the mix, the clock and the places will sit, titles already
 * on, so a campaign change only waits on the kilometres.
 */
function AnalyticsSkeleton() {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-2" aria-busy="true" aria-label="Loading analytics">
      <Card>
        <CardHeader
          title="Visibility mix"
          description="Share of billed kilometres that were slow enough to read while moving. Parked time is omitted. This is not what you are billed on."
        />
        <CardBody className="space-y-4">
          <DonutSkeleton legend={3} />
          <Skeleton className="mx-auto h-4 w-3/4" />
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="When it was readable"
          description="Of the kilometres slow enough to read, when they ran. Not a count of people, and not what you are billed on."
        />
        <CardBody>
          <DonutSkeleton legend={4} />
        </CardBody>
      </Card>
      <div className="xl:col-span-2">
        <Card>
          <CardHeader
            title="Where it was readable"
            description="Slow kilometres on the route, grouped by kind of place. A name appears when the map knows a mall, signal, station or apartment — not a count of people."
          />
          <CardBody className="space-y-5">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <li key={index} className="rounded-xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-6 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="mt-2 h-6 w-16" />
                  <Skeleton className="mt-1.5 h-3 w-14" />
                </li>
              ))}
            </ul>
            <ul className="divide-y divide-slate-100">
              {Array.from({ length: 4 }, (_, index) => (
                <li key={index} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-3.5 w-14" />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const campaigns = useCampaigns();

  return (
    <QueryBoundary
      query={campaigns}
      loading={
        <Page title="Analytics">
          <AnalyticsSkeleton />
        </Page>
      }
      errorTitle="Could not load campaigns"
    >
      {(data) => <AnalyticsBody campaigns={data.items} />}
    </QueryBoundary>
  );
}

function AnalyticsBody({ campaigns }: { campaigns: Campaign[] }) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const selected = campaigns.find((campaign) => campaign.id === pickedId) ?? campaigns[0] ?? null;
  const visibility = useCampaignVisibility(selected?.id);

  if (campaigns.length === 0) {
    return (
      <Page title="Analytics" greeting="How readable the wrap was, from the kilometres you billed">
        <Card>
          <EmptyState
            icon={Eye}
            title="No campaigns yet"
            description="Visibility mix appears here once a campaign has billed kilometres. It is a read of that GPS, not a second price."
          />
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title="Analytics"
      greeting="How readable the wrap was, from the kilometres you billed"
      controls={
        <InlineSelect
          label="Campaign"
          value={selected?.id ?? ''}
          onValueChange={setPickedId}
          options={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))}
        />
      }
    >
      <QueryBoundary
        query={visibility}
        loading={<AnalyticsSkeleton />}
        errorTitle="Could not load visibility mix"
      >
        {(mix) => <VisibilityMixChart mix={mix} campaign={selected} />}
      </QueryBoundary>
    </Page>
  );
}

function VisibilityMixChart({
  mix,
  campaign,
}: {
  mix: CampaignVisibility;
  campaign: Campaign | null;
}) {
  if (mix.classifiedKm <= 0) {
    return (
      <Card>
        <EmptyState
          icon={Gauge}
          title="No classifiable distance yet"
          description={
            campaign
              ? `${campaign.name} has not billed kilometres that can be banded by speed. Parked and near-zero stretches are omitted on purpose.`
              : 'Parked and near-zero stretches are omitted on purpose.'
          }
        />
      </Card>
    );
  }

  const slices = [
    { label: `High ${mix.bands.high}`, value: mix.highKm, color: BAND_COLORS.high },
    { label: `Medium ${mix.bands.medium}`, value: mix.mediumKm, color: BAND_COLORS.medium },
    { label: `Low ${mix.bands.low}`, value: mix.lowKm, color: BAND_COLORS.low },
  ];

  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader
          title="Visibility mix"
          description="Share of billed kilometres that were slow enough to read while moving. Parked time is omitted. This is not what you are billed on."
        />
        <CardBody className="space-y-4">
          <DonutChart
            data={slices}
            centreValue={formatPercent(mix.highShare)}
            centreLabel="Readable while moving"
            formatValue={formatKm}
            size={220}
          />
          <p className="text-center text-[13px] text-slate-600">
            <span className="numeric font-semibold text-slate-900">{formatKm(mix.highKm)}</span>
            {' of '}
            <span className="numeric">{formatKm(mix.classifiedKm)}</span>
            {` billed was under 15 km/h — congested or crawling, not an audience count.`}
          </p>
        </CardBody>
      </Card>
      <WhenCard when={mix.when} />
      <div className="xl:col-span-2">
        <PlacesCard places={mix.places} byKind={mix.byKind} />
      </div>
    </div>
  );
}

function WhenCard({ when }: { when: CampaignDayparts }) {
  if (when.readableKm <= 0) {
    return (
      <Card>
        <EmptyState
          icon={Clock}
          title="No readable kilometres yet"
          description="Time of day is only counted on kilometres already slow enough to read. A daytime fly-by is not a peak hour."
        />
      </Card>
    );
  }

  const slices = [
    { label: `Morning ${when.windows.morning}`, value: when.morningKm, color: DAYPART_COLORS.morning },
    { label: `Midday ${when.windows.midday}`, value: when.middayKm, color: DAYPART_COLORS.midday },
    { label: `Evening ${when.windows.evening}`, value: when.eveningKm, color: DAYPART_COLORS.evening },
    { label: `Night ${when.windows.night}`, value: when.nightKm, color: DAYPART_COLORS.night },
  ];

  return (
    <Card>
      <CardHeader
        title="When it was readable"
        description="Of the kilometres slow enough to read, when they ran. Not a count of people, and not what you are billed on."
      />
      <CardBody>
        <DonutChart
          data={slices}
          centreValue={formatPercent(when.peakShare)}
          centreLabel="Peak hours"
          formatValue={formatKm}
          size={220}
        />
      </CardBody>
    </Card>
  );
}

const KIND_ICON: Record<VisibilityPlaceKind, LucideIcon> = {
  mall: Store,
  signal: TrafficCone,
  transit: TrainFront,
  residential: Home,
  junction: Building2,
};

const KIND_TONE: Record<VisibilityPlaceKind, string> = {
  mall: 'bg-orange-100 text-orange-600',
  signal: 'bg-amber-100 text-amber-700',
  transit: 'bg-blue-100 text-blue-600',
  residential: 'bg-teal-100 text-teal-700',
  junction: 'bg-violet-100 text-violet-700',
};

const KIND_CARD_LABEL: Record<VisibilityPlaceKind, string> = {
  ...VISIBILITY_PLACE_LABEL,
  junction: 'Slow stretches',
};

function PlacesCard({
  places,
  byKind,
}: {
  places: VisibilityPlace[];
  byKind: VisibilityKindTotal[];
}) {
  if (places.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={MapPin}
          title="No visibility places yet"
          description="Malls, signals, stations and apartments appear here once readable driving sits still long enough to cluster. A fly-by is not a place."
        />
      </Card>
    );
  }

  const named = places.filter(isNamed);
  const listed = [...places].sort((left, right) => {
    const namedDelta = Number(isNamed(right)) - Number(isNamed(left));
    if (namedDelta !== 0) return namedDelta;
    return right.km - left.km;
  });

  return (
    <Card>
      <CardHeader
        title="Where it was readable"
        description="Slow kilometres on the route, grouped by kind of place. A name appears when the map knows a mall, signal, station or apartment — not a count of people."
      />
      <CardBody className="space-y-5">
        <ul
          className={cn(
            'grid gap-3',
            byKind.length === 1 ? 'sm:grid-cols-1 md:max-w-xs' : 'sm:grid-cols-2 lg:grid-cols-4',
          )}
          aria-label="Places by kind"
        >
          {byKind.map((row) => {
            const Icon = KIND_ICON[row.kind];
            return (
              <li key={row.kind} className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
                  <span className={cn('grid size-6 place-items-center rounded-full', KIND_TONE[row.kind])}>
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  {KIND_CARD_LABEL[row.kind]}
                </p>
                <p className="numeric mt-2 text-[18px] font-semibold tracking-tight text-slate-900">
                  {formatKm(row.km)}
                </p>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  {row.count} {row.count === 1 ? 'stop' : 'stops'}
                </p>
              </li>
            );
          })}
        </ul>

        {named.length === 0 ? (
          <p className="text-[13px] text-slate-500">
            No mall, signal or station named yet. These are the slow stretches the GPS found.
          </p>
        ) : null}

        <ul className="divide-y divide-slate-100" aria-label="Named visibility places">
          {listed.map((place) => {
            const Icon = KIND_ICON[place.kind];
            const title = isNamed(place) ? place.name : 'Slow enough to read';
            return (
              <li
                key={`${place.kind}-${place.lat}-${place.lng}`}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full',
                    KIND_TONE[place.kind],
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-slate-900">
                    {title}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-slate-500">
                    {KIND_CARD_LABEL[place.kind]}
                    {place.visits > 1 ? ` · ${place.visits} visits` : ''}
                    {place.seconds > 0 ? ` · ${formatDuration(place.seconds)}` : ''}
                  </span>
                </span>
                <span className="numeric shrink-0 text-[13px] font-medium text-slate-700">
                  {formatKm(place.km)}
                </span>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
