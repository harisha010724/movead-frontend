import { Link } from 'react-router-dom';
import { useDriverCampaign, useDriverEarnings, useDriverProfile } from '@/shared/api/hooks';
import { Page } from '@/shared/layout/Page';
import { Button, Card, CardBody, CardHeader, QueryBoundary, StatCard } from '@/shared/ui';
import { formatINR, formatKm } from '@/shared/format';

import { DriverCampaignStatusBadge } from '../campaignStatus';

export default function DashboardPage() {
  const profile = useDriverProfile();
  const earnings = useDriverEarnings();
  const campaign = useDriverCampaign();

  return (
    <Page
      title={profile.data ? `Hello, ${profile.data.name.split(' ')[0]}` : 'Home'}
      greeting="Today’s verified kilometres and what they earned"
    >
      <QueryBoundary query={earnings} errorTitle="Could not load earnings">
        {(data) => (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Today" value={formatKm(data.todayVerifiedKm)} hint={formatINR(data.todayEarnings)} />
              <StatCard
                label="This month"
                value={formatKm(data.monthVerifiedKm)}
                hint={formatINR(data.monthEarnings)}
              />
              <StatCard label="Available" value={formatINR(data.availableBalance)} hint="Ready to withdraw" />
              <StatCard label="Pending" value={formatINR(data.pendingBalance)} hint="In review" />
            </div>

            <Card>
              <CardHeader
                // Not "Active campaign": a requested or assigned campaign shows
                // here too, and neither is running yet.
                title="Your campaign"
                description={campaign.data ? campaign.data.brandName : 'Nothing assigned yet'}
                action={
                  <Button asChild variant="secondary" size="sm">
                    <Link to="/driver/campaign">View</Link>
                  </Button>
                }
              />
              <CardBody>
                {campaign.data ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-semibold text-slate-900">{campaign.data.name}</p>
                      <p className="mt-0.5 text-[13px] text-slate-500">
                        {formatKm(campaign.data.achievedKm)} of{' '}
                        {formatKm(campaign.data.minMonthlyTargetKm)} this month ·{' '}
                        {campaign.data.vehicleRegistration}
                      </p>
                    </div>
                    <DriverCampaignStatusBadge status={campaign.data.status} />
                  </div>
                ) : (
                  <p className="text-[13px] text-slate-500">
                    When an advertiser picks your vehicle for a campaign it appears here.
                  </p>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </QueryBoundary>
    </Page>
  );
}
