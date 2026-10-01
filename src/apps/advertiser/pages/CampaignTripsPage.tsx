import { useParams } from 'react-router-dom';

import { useCampaign, useCampaignTrips } from '@/shared/api/hooks';
import { formatRegistration } from '@/shared/format';
import { Page } from '@/shared/layout/Page';
import { Badge, QueryBoundary } from '@/shared/ui';
import type { Campaign } from '@/shared/types/domain';

import { CampaignTrips, TripsWorkspaceSkeleton } from './CampaignTrips';

/**
 * One driver's recorded trips for a campaign, with the route on the map.
 *
 * The campaign page lists the roster. This page is what the trips icon opens.
 */
export default function CampaignTripsPage() {
  const { campaignId, driverId } = useParams<{ campaignId: string; driverId: string }>();
  const campaign = useCampaign(campaignId);

  return (
    <QueryBoundary
      query={campaign}
      loading={
        <Page
          title="Recorded trips"
          backTo="/campaigns"
          contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-2"
        >
          <TripsWorkspaceSkeleton />
        </Page>
      }
      errorTitle="Could not load this campaign"
    >
      {(data) => <DriverTrips campaign={data} driverId={driverId} />}
    </QueryBoundary>
  );
}

function DriverTrips({ campaign, driverId }: { campaign: Campaign; driverId: string | undefined }) {
  const list = useCampaignTrips(campaign.id, { driverId, limit: 1, offset: 0 });
  const driver = list.data?.drivers.find((item) => item.id === driverId);
  const plate = list.data?.trips[0]?.vehicleRegistration;
  const registration = plate ? formatRegistration(plate) : null;

  return (
    <Page
      title={driver?.name ?? 'Recorded trips'}
      backTo={`/campaigns/${campaign.id}`}
      badge={registration ? <Badge>{registration}</Badge> : undefined}
      greeting={
        registration
          ? `${campaign.name} · ${registration} · recorded trips`
          : `${campaign.name} · recorded trips`
      }
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-2"
    >
      <CampaignTrips campaignId={campaign.id} lockedDriverId={driverId} />
    </Page>
  );
}
