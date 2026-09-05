import { useState } from 'react';
import { Filter, MapPin } from 'lucide-react';
import { useLivePositions } from '@/shared/api/hooks';
import { Page } from '@/shared/layout/Page';
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  FleetStatusBar,
  LiveMapPanel,
  LiveStateBadge,
  QueryBoundary,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  liveStateLabel,
} from '@/shared/ui';
import { formatCount, formatRelative } from '@/shared/format';
import type { LiveVehicleState } from '@/shared/types/domain';

/*
 * GPS_PAUSED sits next to IDLE rather than at the end: both mean the vehicle
 * is reachable but not accruing kilometres, and reading them together is how
 * an advertiser sees how much of the fleet is not currently earning.
 */
const STATE_ORDER: LiveVehicleState[] = ['RUNNING', 'IDLE', 'GPS_PAUSED', 'OFFLINE'];

export default function LiveTrackingPage() {
  const query = useLivePositions(null);
  const [filter, setFilter] = useState<LiveVehicleState | null>(null);

  return (
    <Page
      title="Live Tracking"
      greeting="Positions refresh every ten seconds while this tab is in the foreground"
    >
      <QueryBoundary
        query={query}
        errorTitle="Could not load live positions"
        isEmpty={(d) => d.items.length === 0}
        empty={
          <Card>
            <EmptyState
              icon={MapPin}
              title="No vehicles are currently tracking"
              description="Positions appear here when drivers start a campaign session."
            />
          </Card>
        }
      >
        {(data) => {
          const counts = STATE_ORDER.map((state) => ({
            state,
            count: data.items.filter((v) => v.state === state).length,
          }));

          const visible = filter ? data.items.filter((v) => v.state === filter) : data.items;

          return (
            <div className="space-y-5">
              <FleetStatusBar
                statuses={counts}
                selected={filter}
                onSelect={setFilter}
                updatedLabel={`Updated ${formatRelative(data.updatedAt)}`}
              />

              <div className="grid gap-5 xl:grid-cols-3">
                <Card className="xl:col-span-2">
                  <CardHeader
                    title="Map"
                    description={
                      filter
                        ? `Showing ${liveStateLabel(filter).toLowerCase()} vehicles only`
                        : 'All tracking vehicles'
                    }
                  />
                  <CardBody>
                    {/*
                      No status overlay here: the counts live in the fleet bar
                      above, and duplicating them let the two disagree.
                    */}
                    <LiveMapPanel height={440} />
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader
                    title="Vehicles"
                    description="Identifiers are anonymised. Driver details are never shared with advertisers."
                  />

                  {filter ? (
                    <div className="flex items-center justify-between border-y border-slate-100 bg-slate-50/70 px-5 py-2">
                      <p className="text-[11px] text-slate-500">
                        Showing{' '}
                        <span className="numeric font-medium text-slate-700">
                          {formatCount(visible.length)}
                        </span>{' '}
                        of <span className="numeric">{formatCount(data.items.length)}</span> ·{' '}
                        {liveStateLabel(filter)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setFilter(null)}
                        className="text-brand-600 hover:text-brand-700 text-[11px] font-medium"
                      >
                        Clear
                      </button>
                    </div>
                  ) : null}

                  {visible.length === 0 ? (
                    <EmptyState
                      icon={Filter}
                      title={`No ${liveStateLabel(filter ?? 'RUNNING').toLowerCase()} vehicles`}
                      description="Clear the filter to see the rest of the fleet."
                      action={
                        <button
                          type="button"
                          onClick={() => setFilter(null)}
                          className="text-brand-600 hover:text-brand-700 text-[13px] font-medium"
                        >
                          Show all vehicles
                        </button>
                      }
                    />
                  ) : (
                    <div className="max-h-[480px] overflow-y-auto">
                      <Table caption="Live vehicle positions" dense>
                        <THead>
                          <TR>
                            <TH>Vehicle</TH>
                            <TH>State</TH>
                            <TH align="right">Updated</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {visible.map((v) => (
                            <TR key={v.vehicleRef}>
                              <TD className="font-medium text-slate-900">{v.vehicleRef}</TD>
                              <TD>
                                <LiveStateBadge state={v.state} />
                              </TD>
                              <TD align="right" className="text-[11px] text-slate-500">
                                {formatRelative(v.updatedAt)}
                              </TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          );
        }}
      </QueryBoundary>
    </Page>
  );
}
