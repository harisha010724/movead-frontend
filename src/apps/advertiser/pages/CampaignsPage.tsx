import { Link, useNavigate } from 'react-router-dom';
import { Megaphone, MoreHorizontal, Pencil, Plus } from 'lucide-react';
import { useCampaigns } from '@/shared/api/hooks';
import { Page } from '@/shared/layout/Page';
import {
  Card,
  CampaignStatusBadge,
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
import { Can } from '@/shared/auth/guards';
import { ADVERTISER_PERMISSIONS as PERMISSIONS } from '@/shared/auth/permissions';
import {
  formatCompactCount,
  formatCount,
  formatDateRange,
  formatINR,
  formatKmWhole,
} from '@/shared/format';
import { canEditCampaign } from '@/shared/schemas/campaign';

export default function CampaignsPage() {
  const query = useCampaigns();
  const navigate = useNavigate();

  return (
    <Page
      title="Campaigns"
      greeting="Every campaign you have created, and what each has spent so far"
      controls={
        <Can permission={PERMISSIONS.campaignCreate}>
          <Link
            to="/campaigns/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
          >
            <Plus className="size-4" />
            New campaign
          </Link>
        </Can>
      }
    >
      <Card>
        <QueryBoundary
          query={query}
          loading={<SkeletonTable rows={4} columns={8} />}
          isEmpty={(d) => d.items.length === 0}
          empty={
            <EmptyState
              icon={Megaphone}
              title="No campaigns yet"
              description="Create a campaign to choose a city, Prime and Secondary kilometres, and the areas you want to advertise in."
            />
          }
        >
          {(data) => (
            <Table caption="Campaigns">
              <THead>
                <TR>
                  <TH>Campaign</TH>
                  <TH>Status</TH>
                  <TH>Duration</TH>
                  <TH numeric>Vehicles</TH>
                  <TH numeric>Verified KM</TH>
                  <TH numeric>Impressions</TH>
                  <TH numeric>Budget</TH>
                  <TH numeric>Spent</TH>
                  <TH className="w-px">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {data.items.map((c) => {
                  const editable = canEditCampaign(c.status);
                  return (
                    <TR key={c.id}>
                      <TD>
                        <span className="font-medium text-slate-900">{c.name}</span>
                        <span className="block text-xs text-slate-500">
                          {c.brandName} · {c.city} · {c.vehicleType === 'AUTO' ? 'Auto' : 'Cab'}
                        </span>
                      </TD>
                      <TD>
                        <CampaignStatusBadge status={c.status} />
                      </TD>
                      <TD className="whitespace-nowrap text-slate-500">
                        {formatDateRange(c.startDate, c.endDate)}
                      </TD>
                      <TD numeric>{formatCount(c.vehicleCount)}</TD>
                      <TD numeric>{formatKmWhole(c.verifiedKm)}</TD>
                      <TD numeric>{formatCompactCount(c.impressions)}</TD>
                      <TD numeric>{formatINR(c.budget)}</TD>
                      <TD numeric className="font-medium text-slate-900">
                        {formatINR(c.spent)}
                      </TD>
                      <TD className="w-px">
                        <Menu
                          trigger={
                            <button
                              type="button"
                              aria-label={`Actions for ${c.name}`}
                              className="focus-visible:ring-brand-500/40 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:outline-none"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          }
                        >
                          <Can permission={PERMISSIONS.campaignCreate}>
                            <MenuItem
                              icon={Pencil}
                              disabled={!editable}
                              onSelect={() => void navigate(`/campaigns/${c.id}/edit`)}
                            >
                              {editable ? 'Edit' : 'Edit (locked after approval)'}
                            </MenuItem>
                          </Can>
                        </Menu>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </QueryBoundary>
      </Card>
    </Page>
  );
}
