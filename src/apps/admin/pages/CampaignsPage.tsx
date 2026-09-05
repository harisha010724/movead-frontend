import { Megaphone, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAdminCampaigns } from '@/shared/api/hooks';
import { Page } from '@/shared/layout/Page';
import {
  Button,
  CampaignStatusBadge,
  Card,
  EmptyState,
  QueryBoundary,
  SkeletonTable,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/shared/ui';
import { Can } from '@/shared/auth/guards';
import { ADMIN_PERMISSIONS as PERMISSIONS } from '@/shared/auth/permissions';
import { adminPath } from '@/shared/auth/portals';
import { formatCount, formatDateRange, formatINR, formatKmWhole } from '@/shared/format';

export default function CampaignsPage() {
  const query = useAdminCampaigns();

  return (
    <Page
      title="Campaigns"
      greeting="Every campaign on the platform — assignment and spend live here after print is ready"
      controls={
        <Can permission={PERMISSIONS.campaignCreate}>
          <Button asChild>
            <Link to={adminPath('/campaigns/new')}>
              <Plus className="size-4" aria-hidden />
              Create for advertiser
            </Link>
          </Button>
        </Can>
      }
    >
      <Card>
        <QueryBoundary
          query={query}
          loading={<SkeletonTable rows={5} columns={7} />}
          isEmpty={(d) => d.items.length === 0}
          empty={<EmptyState icon={Megaphone} title="No campaigns" />}
        >
          {(data) => (
            <Table caption="All campaigns">
              <THead>
                <TR>
                  <TH>Campaign</TH>
                  <TH>Advertiser</TH>
                  <TH>Status</TH>
                  <TH>Dates</TH>
                  <TH numeric>Vehicles</TH>
                  <TH numeric>Verified km</TH>
                  <TH numeric>Spent</TH>
                  <TH numeric>Remaining</TH>
                </TR>
              </THead>
              <TBody>
                {data.items.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <span className="font-medium text-slate-900">{c.name}</span>
                      <span className="block text-xs text-slate-500">
                        {c.brandName} · {c.city}
                      </span>
                    </TD>
                    <TD className="text-slate-600">{c.advertiser.brandName}</TD>
                    <TD>
                      <CampaignStatusBadge status={c.status} />
                    </TD>
                    <TD className="whitespace-nowrap text-slate-600">
                      {formatDateRange(c.startDate, c.endDate)}
                    </TD>
                    <TD numeric>{formatCount(c.vehicleCount)}</TD>
                    <TD numeric>{formatKmWhole(c.verifiedKm)}</TD>
                    <TD numeric>{formatINR(c.spent)}</TD>
                    <TD numeric>{formatINR(c.remaining)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </QueryBoundary>
      </Card>
    </Page>
  );
}
