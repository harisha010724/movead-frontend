import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Car, Eye, IndianRupee, Pencil, Route, Users } from 'lucide-react';

import {
  useAdvertiserDashboard,
  useCampaign,
  useCampaignImpressions,
  useLivePositions,
} from '@/shared/api/hooks';
import { Can } from '@/shared/auth/guards';
import { ADVERTISER_PERMISSIONS as PERMISSIONS } from '@/shared/auth/permissions';
import {
  formatCompactCount,
  formatCount,
  formatDateRange,
  formatINR,
  formatKm,
  formatPercent,
  formatRate,
  formatRegistration,
} from '@/shared/format';
import { Page } from '@/shared/layout/Page';
import { LiveFleetMap } from '@/shared/maps/LiveFleetMap';
import { canEditCampaign } from '@/shared/schemas/campaign';
import {
  BaselineMixBar,
  CampaignStatusBadge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  LiveStateBadge,
  QueryBoundary,
  Skeleton,
  SkeletonStatCards,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  ZoneBadge,
  ZoneBreakdownBar,
} from '@/shared/ui';
import { KmImpressionsChart, type KmImpressionsPoint } from '@/shared/ui/charts';
import { resolveRange } from '@/shared/lib/dateRange';
import type {
  Campaign,
  CampaignImpressions,
  ZoneBreakdown,
  ZoneKey,
} from '@/shared/types/domain';

import { ImpressionDayDialog } from './ImpressionDayDialog';

/**
 * One campaign, and what its driving has amounted to.
 *
 * The campaigns list used to be a dead end: rows named a campaign, quoted a
 * spend and offered nothing but Edit. Everything below already existed behind
 * endpoints nobody was calling.
 *
 * Two figures do the work here and they are not interchangeable. Verified
 * kilometres are GPS-provable and are what the contract is denominated in.
 * Impressions are the media translation of exactly those kilometres, and are
 * a model output — which is why the model's version, its evidence mix and its
 * full working are on this page rather than a footnote. Guarantee what you
 * measure; report what you model, and show the working.
 */

const ZONE_TIER: Record<ZoneKey, 'PRIME' | 'SECONDARY' | 'NETWORK'> = {
  prime: 'PRIME',
  secondary: 'SECONDARY',
  network: 'NETWORK',
};

/** Matches the zone rate card the pipeline stamps onto every segment. */
const ADVERTISER_RATE: Record<ZoneKey, string> = {
  prime: '5.0000',
  secondary: '2.0000',
  network: '1.0000',
};

export default function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const campaign = useCampaign(campaignId);

  return (
    <QueryBoundary
      query={campaign}
      loading={
        <Page title="Campaign">
          <SkeletonStatCards count={5} />
        </Page>
      }
      errorTitle="Could not load this campaign"
    >
      {(data) => <CampaignDetail campaign={data} />}
    </QueryBoundary>
  );
}

function CampaignDetail({ campaign }: { campaign: Campaign }) {
  const [openDay, setOpenDay] = useState<string | null>(null);

  const impressions = useCampaignImpressions(campaign.id);
  /*
   * The whole flight, not a picker's window. The impressions endpoint has no
   * date filter yet, so a range control here would quietly apply to the
   * vehicle table and not to the audience beside it — two panels on one screen
   * answering about different periods is worse than one period nobody chose.
   */
  const dashboard = useAdvertiserDashboard(campaign.id, resolveRange('campaign', campaign.startDate));

  return (
    <Page
      title={campaign.name}
      greeting={`${campaign.brandName} · ${campaign.city} · ${campaign.vehicleType === 'AUTO' ? 'Auto' : 'Cab'} · ${formatDateRange(campaign.startDate, campaign.endDate)}`}
      controls={
        <div className="flex items-center gap-3">
          <CampaignStatusBadge status={campaign.status} />
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
        </div>
      }
    >
      <div className="space-y-5">
        <Figures campaign={campaign} impressions={impressions.data} />

        <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <Card>
            <CardHeader
              title="Distance and audience, day by day"
              description="Bars are kilometres the GPS proved. The line is what the model makes of them — select a day to see the working."
            />
            <CardBody>
              <QueryBoundary
                query={impressions}
                loading={<Skeleton className="h-[260px] w-full" />}
                isEmpty={(d) => d.byDay.length === 0}
                empty={
                  <EmptyState
                    icon={Route}
                    title="No billable driving yet"
                    description="Days appear here once vehicles carrying this campaign have driven and the distance has cleared verification."
                  />
                }
                errorTitle="Could not load the audience for this campaign"
              >
                {(data) => (
                  <KmImpressionsChart
                    data={dailyPoints(data)}
                    formatKm={formatKm}
                    formatImpressions={formatCount}
                    formatAxis={formatCompactCount}
                    onSelectDay={setOpenDay}
                  />
                )}
              </QueryBoundary>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="How much of this is measured"
              description="The share of the audience resting on the fleet's own readings of these roads, rather than on a zone-wide assumption."
            />
            <CardBody>
              <QueryBoundary
                query={impressions}
                loading={<Skeleton className="h-40 w-full" />}
                errorTitle="Could not load the evidence mix"
              >
                {(data) => (
                  <>
                    <BaselineMixBar mix={data.baselineMix} />
                    <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
                      Model {data.modelVersion}. A figure is never revised in place — improving
                      the baselines produces a new model version beside the old one, not a
                      different answer to the same question.
                    </p>
                  </>
                )}
              </QueryBoundary>
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_1.6fr]">
          <Card>
            <CardHeader
              title="Where the kilometres went"
              description="The same distance is worth between ₹1 and ₹5 depending on this split."
            />
            <CardBody>
              <QueryBoundary
                query={impressions}
                loading={<Skeleton className="h-40 w-full" />}
                errorTitle="Could not load the zone split"
              >
                {(data) => <ZoneBreakdownBar km={zoneKm(data)} />}
              </QueryBoundary>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Zone by zone" />
            <QueryBoundary
              query={impressions}
              loading={<Skeleton className="m-5 h-32" />}
              isEmpty={(d) => d.byZone.length === 0}
              empty={
                <EmptyState
                  title="Nothing billable yet"
                  description="Zones appear here as soon as the campaign has driven in them."
                />
              }
              errorTitle="Could not load the zone split"
            >
              {(data) => (
                <Table caption="Audience and charge by pricing zone" dense>
                  <THead>
                    <TR>
                      <TH>Zone</TH>
                      <TH align="right">Rate</TH>
                      <TH numeric align="right">
                        Verified KM
                      </TH>
                      <TH numeric align="right">
                        Impressions
                      </TH>
                      <TH numeric align="right">
                        Charged
                      </TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.byZone.map((zone) => (
                      <TR key={zone.zone}>
                        <TD>
                          <ZoneBadge tier={ZONE_TIER[zone.zone]} />
                        </TD>
                        <TD align="right" className="text-slate-500">
                          {formatRate(ADVERTISER_RATE[zone.zone])}
                        </TD>
                        <TD numeric align="right">
                          {formatKm(zone.verifiedKm)}
                        </TD>
                        <TD numeric align="right">
                          {formatCount(zone.impressions)}
                        </TD>
                        <TD numeric align="right" className="font-medium text-slate-900">
                          {formatINR(zone.charge)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </QueryBoundary>
          </Card>
        </div>

        <Vehicles query={dashboard} />

        <CampaignMap campaignId={campaign.id} />
      </div>

      <ImpressionDayDialog
        campaignId={campaign.id}
        date={openDay}
        onClose={() => setOpenDay(null)}
      />
    </Page>
  );
}

/**
 * The five figures, with the audience ones absent rather than zero while they
 * load. A campaign showing "0 impressions" for a second is a campaign the
 * advertiser reads as having reached nobody.
 */
function Figures({
  campaign,
  impressions,
}: {
  campaign: Campaign;
  impressions: CampaignImpressions | undefined;
}) {
  const budget = Number(campaign.budget);
  const spent = Number(campaign.spent);
  const consumed = budget > 0 ? spent / budget : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <StatCard
        label="Verified Distance"
        value={formatKm(campaign.verifiedKm)}
        icon={Route}
        tone="green"
        hint="Proved by GPS, and what you are billed on"
      />
      <StatCard
        label="Spent"
        value={formatINR(campaign.spent)}
        icon={IndianRupee}
        tone="amber"
        hint={
          consumed === null
            ? `of ${formatINR(campaign.budget)}`
            : `${formatPercent(consumed)} of ${formatINR(campaign.budget)}`
        }
      />
      {/*
        "Modelled" in the label rather than in the hint. It sits beside a
        figure the platform guarantees, and the difference between the two is
        the whole reason the working below is published.
      */}
      <StatCard
        label="Modelled Impressions"
        value={impressions ? formatCompactCount(impressions.impressions) : '—'}
        icon={Users}
        tone="brand"
        hint={impressions ? `Model ${impressions.modelVersion}` : 'Loading'}
      />
      <StatCard
        label="Cost per 1,000 Impressions"
        value={impressions ? formatINR(impressions.cpm) : '—'}
        icon={Eye}
        tone="rose"
        hint="Comparable to other media"
      />
      <StatCard
        label="Vehicles"
        value={formatCount(campaign.vehicleCount)}
        icon={Car}
        tone="blue"
        drillTo="/vehicles"
        hint="Carrying this campaign"
      />
    </div>
  );
}

/**
 * What each vehicle contributed. Spend here is the advertiser's charge, not
 * the driver's earning — the two differ by the platform's margin and the
 * second is never sent to this portal.
 */
function Vehicles({ query }: { query: ReturnType<typeof useAdvertiserDashboard> }) {
  return (
    <Card>
      <CardHeader
        title="Vehicles on this campaign"
        description="Ranked by the distance each has proved."
      />
      <QueryBoundary
        query={query}
        loading={<Skeleton className="m-5 h-32" />}
        isEmpty={(d) => d.topVehicles.length === 0}
        empty={
          <EmptyState
            icon={Car}
            title="No vehicle has driven for this campaign yet"
            description="Vehicles appear here once their wrap is fitted and they start recording distance."
          />
        }
        errorTitle="Could not load the vehicles"
      >
        {(data) => (
          <Table caption="Vehicles on this campaign" dense>
            <THead>
              <TR>
                <TH>Vehicle</TH>
                <TH>Driver</TH>
                <TH>Area</TH>
                <TH numeric align="right">
                  Verified KM
                </TH>
                <TH numeric align="right">
                  Impressions
                </TH>
                <TH numeric align="right">
                  Charged
                </TH>
                <TH>State</TH>
              </TR>
            </THead>
            <TBody>
              {data.topVehicles.map((vehicle) => (
                <TR key={vehicle.vehicleNumber}>
                  <TD className="font-medium text-slate-900">
                    {formatRegistration(vehicle.vehicleNumber)}
                  </TD>
                  <TD>{vehicle.driverName}</TD>
                  <TD className="text-slate-500">{vehicle.area}</TD>
                  <TD numeric align="right">
                    {formatKm(vehicle.km)}
                  </TD>
                  <TD numeric align="right">
                    {formatCount(vehicle.impressions)}
                  </TD>
                  <TD numeric align="right" className="font-medium text-slate-900">
                    {formatINR(vehicle.spend)}
                  </TD>
                  <TD>
                    <LiveStateBadge state={vehicle.state} />
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

/**
 * Where the campaign is right now. Scoped server-side to this campaign, so a
 * competitor's fleet cannot appear on it even briefly.
 */
function CampaignMap({ campaignId }: { campaignId: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const query = useLivePositions(campaignId);

  return (
    <Card>
      <CardHeader
        title="On the road now"
        description="Positions refresh every ten seconds while this tab is in the foreground."
      />
      <CardBody>
        <QueryBoundary
          query={query}
          loading={<Skeleton className="h-[380px] w-full" />}
          isEmpty={(d) => d.items.length === 0}
          empty={
            <EmptyState
              icon={Car}
              title="No vehicle is tracking right now"
              description="The map fills in when a driver carrying this campaign starts a session."
            />
          }
          errorTitle="Could not load live positions"
        >
          {(data) => (
            <div className="h-[380px]">
              <LiveFleetMap
                positions={data.items}
                selectedRef={selected}
                onSelect={setSelected}
              />
            </div>
          )}
        </QueryBoundary>
      </CardBody>
    </Card>
  );
}

/** Day labels are already the civil day the backend billed on; only shortened. */
function dailyPoints(data: CampaignImpressions): KmImpressionsPoint[] {
  return data.byDay.map((day) => ({
    date: day.date,
    label: day.date.slice(5).replace('-', '/'),
    verifiedKm: day.verifiedKm,
    impressions: day.impressions,
  }));
}

/** The zone bar wants all three zones; the API omits ones never driven in. */
function zoneKm(data: CampaignImpressions): ZoneBreakdown {
  const find = (zone: ZoneKey) => data.byZone.find((z) => z.zone === zone)?.verifiedKm ?? 0;
  return { prime: find('prime'), secondary: find('secondary'), network: find('network') };
}
