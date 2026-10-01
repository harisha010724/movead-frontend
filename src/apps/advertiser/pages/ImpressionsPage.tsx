import { useState } from 'react';
import { Eye, IndianRupee, Route, Users } from 'lucide-react';

import { useCampaignImpressions, useCampaigns } from '@/shared/api/hooks';
import {
  formatCompactCount,
  formatCount,
  formatDate,
  formatINR,
  formatKm,
} from '@/shared/format';
import { Page } from '@/shared/layout/Page';
import type { Campaign, CampaignImpressions, ZoneKey } from '@/shared/types/domain';
import {
  BaselineMixBar,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  QueryBoundary,
  Skeleton,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  ZoneBadge,
} from '@/shared/ui';
import { KmImpressionsChart } from '@/shared/ui/charts';
import { InlineSelect } from '@/shared/ui/form';

import { ImpressionDayDialog } from './ImpressionDayDialog';

/**
 * A campaign's billed kilometres, expressed as an audience.
 *
 * Guarantee what you measure, report what you model. Verified kilometres are
 * GPS-provable and are what the contract is written in; impressions are the
 * media translation of that driving and are labelled as modelled. Opening a
 * day shows every coefficient, so the figure can be argued with. Nothing
 * here multiplies a charge. AC-24.9 still keeps this off the dashboard.
 */

const ZONE_TIER: Record<ZoneKey, 'PRIME' | 'SECONDARY' | 'NETWORK'> = {
  prime: 'PRIME',
  secondary: 'SECONDARY',
  network: 'NETWORK',
};

function dayStamp(date: string) {
  return `${date}T00:00:00+05:30`;
}

const KPI_SKELETONS = [
  'Modelled impressions',
  'Verified distance',
  'Charged',
  'Cost per 1,000',
] as const;

/**
 * The page's own shape, pulsing — not one slab.
 *
 * A single rectangle makes the first paint look empty and then jump. These
 * blocks sit where the cards will sit, with the labels already on, so a
 * campaign change only waits on the numbers.
 */
function ImpressionsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading impressions">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_SKELETONS.map((label) => (
          <div key={label} className="rounded-2xl bg-white p-5 shadow-card">
            <p className="min-h-[26px] text-[11px] leading-tight text-slate-500">{label}</p>
            <Skeleton className="mt-1 h-7 w-28" />
            <Skeleton className="mt-3 h-3 w-40" />
          </div>
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="How much of this is measurement"
            description="Share of the audience that rests on the fleet's own speed of these roads, versus a flat zone assumption."
          />
          <CardBody className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-2.5 w-full rounded-full" />
            <Skeleton className="mt-2 h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="By zone"
            description="The same billed kilometres, in the currency advertisers compare media in."
          />
          <CardBody className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Kilometres and the audience they produced"
          description="A day where the line rises faster than the bars is the same distance in heavier traffic. Open a day for the working."
        />
        <CardBody>
          <Skeleton className="h-64 w-full" />
        </CardBody>
      </Card>
    </div>
  );
}

export default function ImpressionsPage() {
  const campaigns = useCampaigns();

  return (
    <QueryBoundary
      query={campaigns}
      loading={
        <Page title="Impressions">
          <ImpressionsSkeleton />
        </Page>
      }
      errorTitle="Could not load campaigns"
    >
      {(data) => <ImpressionsBody campaigns={data.items} />}
    </QueryBoundary>
  );
}

function ImpressionsBody({ campaigns }: { campaigns: Campaign[] }) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const selected = campaigns.find((campaign) => campaign.id === pickedId) ?? campaigns[0] ?? null;
  const impressions = useCampaignImpressions(selected?.id);

  if (campaigns.length === 0) {
    return (
      <Page title="Impressions" greeting="Modelled opportunities to see the wrap, from the kilometres you billed">
        <Card>
          <EmptyState
            icon={Eye}
            title="No campaigns yet"
            description="An audience appears here once a campaign has billed kilometres and those kilometres have been modelled. It is not a second price."
          />
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title="Impressions"
      greeting="Modelled opportunities to see the wrap, from the kilometres you billed"
      controls={
        <InlineSelect
          label="Campaign"
          value={selected?.id ?? ''}
          onValueChange={(id) => {
            setPickedId(id);
            setDay(null);
          }}
          options={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))}
        />
      }
    >
      <QueryBoundary
        query={impressions}
        loading={<ImpressionsSkeleton />}
        errorTitle="Could not load impressions"
      >
        {(report) => (
          <>
            <ImpressionsReport report={report} onSelectDay={setDay} />
            {selected ? (
              <ImpressionDayDialog campaignId={selected.id} date={day} onClose={() => setDay(null)} />
            ) : null}
          </>
        )}
      </QueryBoundary>
    </Page>
  );
}

function ImpressionsReport({
  report,
  onSelectDay,
}: {
  report: CampaignImpressions;
  onSelectDay: (date: string) => void;
}) {
  if (report.verifiedKm <= 0 && report.impressions <= 0) {
    return (
      <Card>
        <EmptyState
          icon={Eye}
          title="No modelled audience yet"
          description={`${report.campaignName} has no billed kilometres that have been priced into an audience. The worker writes that after the kilometre is billed. This is not what you are billed on.`}
        />
      </Card>
    );
  }

  const chart = report.byDay.map((row) => ({
    date: row.date,
    label: formatDate(dayStamp(row.date)),
    verifiedKm: row.verifiedKm,
    impressions: row.impressions,
  }));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Modelled impressions"
          value={formatCount(report.impressions)}
          icon={Users}
          tone="brand"
          hint={`Model ${report.modelVersion}. Not a count of people, and not what you are billed on.`}
        />
        <StatCard
          label="Verified distance"
          value={formatKm(report.verifiedKm)}
          icon={Route}
          tone="green"
          hint="GPS-provable, and what you are billed on"
        />
        <StatCard
          label="Charged"
          value={formatINR(report.charge)}
          icon={IndianRupee}
          tone="amber"
          hint="The same rupees as the campaign spend"
        />
        <StatCard
          label="Cost per 1,000"
          value={formatINR(report.cpm)}
          icon={Eye}
          tone="rose"
          hint="Charge over modelled impressions"
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="How much of this is measurement"
            description="Share of the audience that rests on the fleet's own speed of these roads, versus a flat zone assumption."
          />
          <CardBody>
            <BaselineMixBar mix={report.baselineMix} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="By zone"
            description="The same billed kilometres, in the currency advertisers compare media in."
          />
          <CardBody>
            {report.byZone.length === 0 ? (
              <p className="text-[13px] text-slate-500">No zone has been modelled yet.</p>
            ) : (
              <Table caption="Impressions by zone" dense>
                <THead>
                  <TR>
                    <TH>Zone</TH>
                    <TH numeric align="right">
                      Verified
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
                  {report.byZone.map((row) => (
                    <TR key={row.zone}>
                      <TD>
                        <ZoneBadge tier={ZONE_TIER[row.zone]} />
                      </TD>
                      <TD numeric align="right">
                        {formatKm(row.verifiedKm)}
                      </TD>
                      <TD numeric align="right">
                        {formatCount(row.impressions)}
                      </TD>
                      <TD numeric align="right">
                        {formatINR(row.charge)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Kilometres and the audience they produced"
          description="A day where the line rises faster than the bars is the same distance in heavier traffic. Open a day for the working."
        />
        <CardBody>
          {chart.length === 0 ? (
            <p className="text-[13px] text-slate-500">No billed day has been modelled yet.</p>
          ) : (
            <KmImpressionsChart
              data={chart}
              formatKm={formatKm}
              formatImpressions={formatCount}
              formatAxis={formatCompactCount}
              onSelectDay={onSelectDay}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
