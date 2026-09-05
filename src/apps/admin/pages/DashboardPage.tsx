import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Car,
  Route as RouteIcon,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react';
import { useAdminDashboard } from '@/shared/api/hooks';
import { adminPath } from '@/shared/auth/portals';
import { Page } from '@/shared/layout/Page';
import {
  Card,
  CardBody,
  CardHeader,
  LiveMapPanel,
  QueryBoundary,
  SkeletonStatCards,
  StatCard,
  ZoneBreakdownBar,
} from '@/shared/ui';
import { InlineSelect } from '@/shared/ui/form';
import { TrendAreaChart } from '@/shared/ui/charts';
import {
  formatCount,
  formatINR,
  formatINRCompact,
  formatKmWhole,
  formatPercent,
} from '@/shared/format';
import {
  previousPeriod,
  RANGE_LABELS,
  resolveRange,
  shortRangeLabel,
  type RangePreset,
} from '@/shared/lib/dateRange';

const QUEUES = [
  {
    key: 'documentsPending' as const,
    label: 'Documents to verify',
    icon: BadgeCheck,
    to: '/verification',
  },
  {
    key: 'installationsPending' as const,
    label: 'Installations to approve',
    icon: Wrench,
    to: '/verification',
  },
  {
    key: 'kmFlagged' as const,
    label: 'Flagged kilometres',
    icon: AlertTriangle,
    to: '/gps-audit',
  },
  {
    key: 'payoutsAwaitingRelease' as const,
    label: 'Payout runs to release',
    icon: Banknote,
    to: '/payouts',
  },
];

export default function DashboardPage() {
  const [preset, setPreset] = useState<RangePreset>('today');
  const range = useMemo(() => resolveRange(preset), [preset]);
  const comparisonLabel = useMemo(() => shortRangeLabel(previousPeriod(range)), [range]);
  const query = useAdminDashboard(range);

  return (
    <Page
      title="Operations"
      greeting="Supply, inventory and money across the platform"
      controls={
        <InlineSelect
          label="Date range"
          value={preset}
          onValueChange={(v) => setPreset(v as RangePreset)}
          options={(['today', 'last7', 'last30'] as RangePreset[]).map((p) => ({
            value: p,
            label: RANGE_LABELS[p],
          }))}
          className="min-w-40"
        />
      }
    >
      <QueryBoundary query={query} loading={<SkeletonStatCards />}>
        {(data) => (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Registered drivers"
                value={formatCount(data.supply.registeredDrivers)}
                icon={Users}
                tone="brand"
                hint="All time"
                drillTo="/drivers"
              />
              <StatCard
                label="Approved drivers"
                value={formatCount(data.supply.approvedDrivers)}
                icon={BadgeCheck}
                tone="green"
                hint={`${formatPercent(
                  data.supply.approvedDrivers / (data.supply.registeredDrivers || 1),
                )} of registered`}
                drillTo="/drivers"
              />
              <StatCard
                label="Currently tracking"
                value={formatCount(data.supply.currentlyTracking)}
                icon={Car}
                tone="blue"
                hint={`${formatPercent(
                  data.supply.currentlyTracking / (data.supply.approvedDrivers || 1),
                )} of approved fleet`}
              />
              <StatCard
                label="Gross spread"
                value={formatINRCompact(data.moneyToday.grossSpread)}
                icon={TrendingUp}
                tone="amber"
                hint={`Revenue ${formatINRCompact(data.moneyToday.advertiserRevenue)}`}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader
                  title="Revenue trend"
                  description={`Compared with ${comparisonLabel}`}
                />
                <CardBody>
                  <TrendAreaChart
                    data={data.revenueDaily}
                    seriesName="Revenue"
                    formatValue={(v) => formatINR(String(v))}
                    formatAxis={(v) => formatINRCompact(String(v))}
                    height={220}
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Money"
                  description="What is owed, not what has left the bank"
                />
                <CardBody>
                  <dl className="space-y-4">
                    <div className="flex items-baseline justify-between">
                      <dt className="text-sm text-slate-600">Advertiser revenue</dt>
                      <dd className="numeric text-lg font-semibold text-slate-900">
                        {formatINR(data.moneyToday.advertiserRevenue)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <dt className="text-sm text-slate-600">Driver liability</dt>
                      <dd className="numeric text-lg font-semibold text-slate-900">
                        −{formatINR(data.moneyToday.driverLiability)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between border-t border-slate-100 pt-4">
                      <dt className="text-sm font-medium text-slate-700">Gross spread</dt>
                      <dd className="numeric text-2xl font-semibold text-[color:var(--color-positive)]">
                        {formatINR(data.moneyToday.grossSpread)}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
                    Driver liability accrues the moment a kilometre is verified, not when it is
                    paid.
                  </p>
                </CardBody>
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <Card>
                <CardHeader
                  title="Inventory"
                  description="Verified distance produced in this period"
                />
                <CardBody>
                  <ZoneBreakdownBar km={data.inventoryToday} />
                  <dl className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Total recorded</dt>
                      <dd className="numeric text-slate-900">
                        {formatKmWhole(data.inventoryToday.total)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Rejected</dt>
                      <dd className="numeric text-slate-900">
                        {formatKmWhole(data.inventoryToday.rejected)}
                        <span className="ml-2 text-xs text-slate-400">
                          {formatPercent(
                            data.inventoryToday.rejected / (data.inventoryToday.total || 1),
                          )}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Fleet right now" />
                <CardBody>
                  <LiveMapPanel
                    statuses={data.vehicleStatus}
                    viewAllTo="/drivers"
                    height={300}
                  />
                </CardBody>
              </Card>
            </div>

            <section aria-labelledby="queues-heading">
              <h2 id="queues-heading" className="mb-3 text-sm font-semibold text-slate-700">
                Work queues
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {QUEUES.map(({ key, label, icon: Icon, to }) => {
                  const count = data.queues[key];
                  return (
                    <Link
                      key={key}
                      to={to}
                      className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover"
                    >
                      <div
                        className={`grid size-11 shrink-0 place-items-center rounded-xl ${
                          count > 0
                            ? 'bg-amber-50 text-amber-500'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="numeric text-xl font-semibold text-slate-900">
                          {formatCount(count)}
                        </p>
                        <p className="truncate text-xs text-slate-500">{label}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            <Card>
              <CardHeader
                title="Reconciliation"
                description="Every kilometre must answer six questions"
              />
              <CardBody>
                <div className="flex items-start gap-3">
                  <RouteIcon className="mt-0.5 size-4 shrink-0 text-slate-400" />
                  <p className="text-sm text-slate-600">
                    For any billed kilometre the GPS audit view shows which vehicle drove it,
                    when and where, which campaign owned it, which zone and rate applied, and
                    the resulting advertiser charge and driver earning.{' '}
                    <Link
                      to={adminPath('/gps-audit')}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      Open GPS audit
                    </Link>
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </QueryBoundary>
    </Page>
  );
}
