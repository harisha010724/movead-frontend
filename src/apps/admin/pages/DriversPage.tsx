import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileSearch, MoreHorizontal, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useDrivers, type DriverListing } from '@/shared/api/hooks';
import { Page } from '@/shared/layout/Page';
import { adminPath } from '@/shared/auth/portals';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Menu,
  MenuItem,
  MenuSeparator,
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
import { formatDate, formatRegistration } from '@/shared/format';
import { EditDriverDialog } from './EditDriverDialog';
import { OnboardDriverDialog } from './OnboardDriverDialog';
import { RemoveDriverDialog } from './RemoveDriverDialog';

/*
 * The four states a driver can actually be in. Anything else here would be
 * rejected by the API rather than quietly returning nothing, because the
 * status filter is validated against the same enum the column uses.
 */
const STATUS_FILTERS = [
  'ALL',
  'PENDING',
  'DOCUMENTS_SUBMITTED',
  'APPROVED',
  'SUSPENDED',
] as const;

const statusTone = (status: string) => {
  if (status === 'APPROVED') return 'success' as const;
  if (status === 'SUSPENDED') return 'danger' as const;
  if (status === 'PENDING') return 'warning' as const;
  return 'info' as const;
};

export default function DriversPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('ALL');
  const [onboarding, setOnboarding] = useState(false);
  const [editing, setEditing] = useState<DriverListing | null>(null);
  const [removing, setRemoving] = useState<DriverListing | null>(null);
  const query = useDrivers(status === 'ALL' ? undefined : { status });

  /*
   * Radix returns focus to the menu trigger as it closes. Opening a dialog in
   * the same tick means the two fight over focus and the page can be left with
   * `pointer-events: none` on the body, so the dialog opens and nothing in it
   * can be clicked. Deferring by a frame lets the menu finish first.
   */
  const openAfterMenuCloses = (open: () => void) => () => {
    setTimeout(open, 0);
  };

  return (
    <Page
      title="Drivers"
      greeting="Everyone who has registered, and where they are in onboarding"
      controls={
        <Can permission={PERMISSIONS.driverApprove}>
          <Button onClick={() => setOnboarding(true)} leadingIcon={<Plus className="size-4" />}>
            Onboard driver
          </Button>
        </Can>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              status === s
                ? 'bg-brand-500 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 ring-inset hover:bg-slate-50'
            }`}
          >
            {s === 'ALL' ? 'All' : s.replace(/_/g, ' ').toLowerCase()}
          </button>
        ))}
      </div>

      <Card>
        <QueryBoundary
          query={query}
          loading={<SkeletonTable rows={6} columns={7} />}
          isEmpty={(d) => d.items.length === 0}
          empty={
            <EmptyState
              icon={Users}
              title="No drivers match this filter"
              description="Try a different status, or onboard a new driver."
              action={
                <Can permission={PERMISSIONS.driverApprove}>
                  <Button variant="secondary" onClick={() => setOnboarding(true)}>
                    Onboard driver
                  </Button>
                </Can>
              }
            />
          }
        >
          {(data) => (
            <Table caption="Registered drivers">
              <THead>
                <TR>
                  <TH>Driver</TH>
                  <TH>Mobile</TH>
                  <TH>Vehicle</TH>
                  <TH>Registration</TH>
                  <TH>Area</TH>
                  <TH>Status</TH>
                  <TH>Registered</TH>
                  <TH>
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {data.items.map((d) => (
                  <TR key={d.id}>
                    <TD>
                      {/*
                        The name is the way in to the review screen. An operator
                        looking for a driver's documents reaches for their name
                        long before they think to open a row menu.
                      */}
                      <Link
                        to={adminPath(`/drivers/${d.id}`)}
                        className="hover:text-brand-600 font-medium text-slate-900 hover:underline"
                      >
                        {d.name}
                      </Link>
                    </TD>
                    <TD className="numeric text-slate-600">{d.mobile}</TD>
                    <TD>{d.vehicle ? (d.vehicle.category === 'AUTO' ? 'Auto' : 'Cab') : '—'}</TD>
                    <TD className="numeric text-slate-600">
                      {d.vehicle ? formatRegistration(d.vehicle.registrationNumber) : '—'}
                    </TD>
                    <TD className="max-w-[10rem] truncate text-slate-600">
                      {d.location?.label ?? '—'}
                    </TD>
                    <TD>
                      <Badge tone={statusTone(d.status)}>
                        {d.status.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                    </TD>
                    <TD className="text-slate-600">{formatDate(d.joinedAt)}</TD>
                    <TD className="w-px">
                      <Menu
                        trigger={
                          <button
                            type="button"
                            aria-label={`Actions for ${d.name}`}
                            className="focus-visible:ring-brand-500/40 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:outline-none"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        }
                      >
                        <Can permission={PERMISSIONS.driverRead}>
                          <MenuItem
                            icon={FileSearch}
                            onSelect={openAfterMenuCloses(() =>
                              void navigate(adminPath(`/drivers/${d.id}`)),
                            )}
                          >
                            Review documents
                          </MenuItem>
                        </Can>
                        <Can permission={PERMISSIONS.driverCreate}>
                          <MenuItem
                            icon={Pencil}
                            onSelect={openAfterMenuCloses(() => setEditing(d))}
                          >
                            Edit driver
                          </MenuItem>
                        </Can>
                        <Can permission={PERMISSIONS.driverDelete}>
                          <MenuSeparator />
                          <MenuItem
                            icon={Trash2}
                            destructive
                            onSelect={openAfterMenuCloses(() => setRemoving(d))}
                          >
                            Remove driver
                          </MenuItem>
                        </Can>
                      </Menu>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </QueryBoundary>
      </Card>

      <OnboardDriverDialog open={onboarding} onOpenChange={setOnboarding} />
      <EditDriverDialog driver={editing} onOpenChange={() => setEditing(null)} />
      <RemoveDriverDialog driver={removing} onOpenChange={() => setRemoving(null)} />
    </Page>
  );
}
