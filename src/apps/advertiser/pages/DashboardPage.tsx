import { useMemo, useState } from 'react';
import { Calendar, Car, Eye, Route, Users, Wallet } from 'lucide-react';
import { useAdvertiserDashboard, useCampaigns } from '@/shared/api/hooks';
import { TopBar } from '@/shared/layout/TopBar';
import {
  AlertList,
  Card,
  CardBody,
  CardHeader,
  CampaignStatusBadge,
  LiveMapPanel,
  LiveStateBadge,
  QueryBoundary,
  SkeletonStatCards,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  ViewAllLink,
  type StatTone,
} from '@/shared/ui';
import { InlineSelect } from '@/shared/ui/form';
import { CategoryBarChart, DonutChart, TrendAreaChart } from '@/shared/ui/charts';
import {
  formatCompactCount,
  formatCount,
  formatDateRange,
  formatINR,
  formatKmWhole,
} from '@/shared/format';
import {
  previousPeriod,
  resolveRange,
  shortRangeLabel,
  type RangePreset,
} from '@/shared/lib/dateRange';

const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: 'campaign', label: 'Campaign to date' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'today', label: 'Today' },
];

export default function DashboardPage() {
  const [preset, setPreset] = useState<RangePreset>('campaign');
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [trendGrain, setTrendGrain] = useState<'daily' | 'weekly'>('daily');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dayFilter, setDayFilter] = useState('all');

  const campaignsQuery = useCampaigns();
  const campaigns = campaignsQuery.data?.items ?? [];
  const selected = campaigns.find((c) => c.id === campaignId) ?? campaigns[0] ?? null;

  const range = useMemo(
    () => resolveRange(preset, selected?.startDate),
    [preset, selected?.startDate],
  );
  const comparisonLabel = useMemo(() => shortRangeLabel(previousPeriod(range)), [range]);

  const query = useAdvertiserDashboard(selected?.id ?? null, range);

  return (
    <>
      <TopBar
        title="Dashboard"
        greeting={`Welcome back, ${selected ? selected.brandName : 'there'} 👋`}
        controls={
          <>
            {selected ? (
              <InlineSelect
                label="Campaign"
                value={selected.id}
                onValueChange={setCampaignId}
                options={campaigns.map((c) => ({ value: c.id, label: c.name }))}
                className="min-w-48"
              />
            ) : null}

            <InlineSelect
              label="Date range"
              value={preset}
              onValueChange={(v) => setPreset(v as RangePreset)}
              options={RANGE_OPTIONS}
              leadingIcon={<Calendar className="size-4 shrink-0 text-slate-400" aria-hidden />}
              className="min-w-48"
            />
          </>
        }
      />

      <div className="flex-1 px-6 py-6">
        <QueryBoundary
          query={query}
          loading={<SkeletonStatCards count={5} />}
          errorTitle="Could not load your dashboard"
        >
          {(data) => {
            const kpis: {
              label: string;
              value: string;
              icon: typeof Eye;
              tone: StatTone;
              change: number;
              lowerIsBetter?: boolean;
              drillTo?: string;
            }[] = [
              {
                label: 'Total Impressions',
                value: formatCompactCount(data.impressions),
                icon: Users,
                tone: 'brand',
                change: data.comparison.impressions,
              },
              {
                label: 'Total Verified KM',
                value: formatKmWhole(data.km.prime + data.km.secondary + data.km.network),
                icon: Route,
                tone: 'green',
                change: data.comparison.verifiedKm,
                drillTo: '/reports',
              },
              {
                label: 'Active Vehicles',
                value: formatCount(data.activeVehicles),
                icon: Car,
                tone: 'blue',
                change: data.comparison.activeVehicles,
                drillTo: '/vehicles',
              },
              {
                label: 'Total Spend',
                value: formatINR(data.spend.total),
                icon: Wallet,
                tone: 'amber',
                change: data.comparison.spend,
                drillTo: '/billing',
              },
              {
                label: 'Avg. Cost per 1K Impressions',
                value: formatINR(data.costPerThousandImpressions),
                icon: Eye,
                tone: 'rose',
                change: data.comparison.costPerThousandImpressions,
                // A falling cost per thousand is an improvement, so the colour
                // must not follow the arrow direction here.
                lowerIsBetter: true,
              },
            ];

            return (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {kpis.map((kpi) => (
                    <StatCard
                      key={kpi.label}
                      label={kpi.label}
                      value={kpi.value}
                      icon={kpi.icon}
                      tone={kpi.tone}
                      change={kpi.change}
                      comparisonLabel={comparisonLabel}
                      {...(kpi.lowerIsBetter ? { lowerIsBetter: true } : {})}
                      {...(kpi.drillTo ? { drillTo: kpi.drillTo } : {})}
                    />
                  ))}
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <Card>
                    <CardHeader
                      title={
                        <span className="flex items-center gap-2.5">
                          Live Campaign Tracking
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                            Live
                          </span>
                        </span>
                      }
                      action={
                        <>
                          <InlineSelect
                            label="Filter by vehicle"
                            subtle
                            value={vehicleFilter}
                            onValueChange={setVehicleFilter}
                            options={[{ value: 'all', label: 'All Vehicles' }]}
                          />
                          <InlineSelect
                            label="Filter by status"
                            subtle
                            value={statusFilter}
                            onValueChange={setStatusFilter}
                            options={[
                              { value: 'all', label: 'All Status' },
                              { value: 'RUNNING', label: 'Running' },
                              { value: 'IDLE', label: 'Idle' },
                              { value: 'OFFLINE', label: 'Offline' },
                            ]}
                          />
                        </>
                      }
                    />
                    <CardBody>
                      <LiveMapPanel
                        statuses={data.vehicleStatus}
                        viewAllTo="/tracking"
                        height={400}
                      />
                    </CardBody>
                  </Card>

                  <div className="grid content-start gap-5">
                    <Card>
                      <CardHeader
                        title="Impressions Over Time"
                        action={
                          <InlineSelect
                            label="Trend granularity"
                            subtle
                            value={trendGrain}
                            onValueChange={(v) => setTrendGrain(v as 'daily' | 'weekly')}
                            options={[
                              { value: 'daily', label: 'Daily' },
                              { value: 'weekly', label: 'Weekly' },
                            ]}
                          />
                        }
                      />
                      <CardBody>
                        <TrendAreaChart
                          data={data.impressionsDaily}
                          seriesName="Impressions"
                          formatValue={formatCount}
                          formatAxis={formatCompactCount}
                          height={150}
                        />
                      </CardBody>
                    </Card>

                    <Card>
                      <CardHeader
                        title="Impressions by Hour"
                        action={
                          <InlineSelect
                            label="Day filter"
                            subtle
                            value={dayFilter}
                            onValueChange={setDayFilter}
                            options={[
                              { value: 'all', label: 'All Days' },
                              { value: 'weekdays', label: 'Weekdays' },
                              { value: 'weekends', label: 'Weekends' },
                            ]}
                          />
                        }
                      />
                      <CardBody>
                        <CategoryBarChart
                          data={data.impressionsHourly}
                          seriesName="Impressions"
                          formatValue={formatCount}
                          formatAxis={formatCompactCount}
                          height={150}
                        />
                      </CardBody>
                    </Card>
                  </div>
                </div>

                {/*
                  Explicit fractions rather than a 12-column span: the vehicle
                  table carries seven columns and needs slightly more than half
                  the row to show them all without a horizontal scroll.
                */}
                <div className="grid gap-5 xl:grid-cols-[1.55fr_0.72fr_0.72fr]">
                  <Card>
                    <CardHeader title="Top Performing Vehicles" />
                    <Table dense caption="Top performing vehicles">
                      <THead>
                        <TR>
                          <TH>Vehicle No.</TH>
                          <TH>Driver Name</TH>
                          <TH>Area</TH>
                          <TH numeric align="left">
                            Verified KM
                          </TH>
                          <TH numeric align="left">
                            Impressions
                          </TH>
                          <TH numeric align="left">
                            Spend
                          </TH>
                          <TH>Status</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {data.topVehicles.map((v) => (
                          <TR key={v.vehicleNumber}>
                            <TD className="font-medium text-slate-900">{v.vehicleNumber}</TD>
                            <TD>{v.driverName}</TD>
                            <TD className="text-slate-500">{v.area}</TD>
                            <TD numeric align="left">
                              {formatKmWhole(v.km)}
                            </TD>
                            <TD numeric align="left">
                              {formatCount(v.impressions)}
                            </TD>
                            <TD numeric align="left" className="font-medium text-slate-900">
                              {formatINR(v.spend)}
                            </TD>
                            <TD>
                              <LiveStateBadge state={v.state} />
                            </TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                    <CardBody className="pt-4">
                      <ViewAllLink to="/vehicles">View All Vehicles</ViewAllLink>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader title="Impressions by Area" />
                    <CardBody>
                      <DonutChart
                        data={data.impressionsByArea}
                        centreValue={formatCompactCount(data.impressions)}
                        formatValue={formatCompactCount}
                        size={130}
                      />
                      <div className="mt-4">
                        <ViewAllLink to="/reports">View Full Report</ViewAllLink>
                      </div>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader title="Impressions by Vehicle Type" />
                    <CardBody>
                      <DonutChart
                        data={data.impressionsByVehicleType}
                        centreValue={formatCompactCount(data.impressions)}
                        formatValue={formatCompactCount}
                        size={130}
                      />
                      <div className="mt-4">
                        <ViewAllLink to="/reports">View Full Report</ViewAllLink>
                      </div>
                    </CardBody>
                  </Card>
                </div>

                <div className="grid gap-5 xl:grid-cols-12">
                  <Card className="xl:col-span-8">
                    <CardHeader title="Campaign Summary" />
                    <Table dense caption="Campaign summary">
                      <THead>
                        <TR>
                          <TH>Campaign Name</TH>
                          <TH>Duration</TH>
                          <TH numeric align="left">
                            Vehicles
                          </TH>
                          <TH numeric align="left">
                            Verified KM
                          </TH>
                          <TH numeric align="left">
                            Impressions
                          </TH>
                          <TH numeric align="left">
                            Spend
                          </TH>
                          <TH>Status</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {campaigns.map((c) => (
                          <TR key={c.id}>
                            <TD className="font-medium text-slate-900">{c.name}</TD>
                            <TD className="whitespace-nowrap text-slate-500">
                              {formatDateRange(c.startDate, c.endDate)}
                            </TD>
                            <TD numeric align="left">
                              {formatCount(c.vehicleCount)}
                            </TD>
                            <TD numeric align="left">
                              {formatKmWhole(c.verifiedKm)}
                            </TD>
                            <TD numeric align="left">
                              {formatCompactCount(c.impressions)}
                            </TD>
                            <TD numeric align="left" className="font-medium text-slate-900">
                              {formatINR(c.spent)}
                            </TD>
                            <TD>
                              <CampaignStatusBadge status={c.status} />
                            </TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                    <CardBody className="pt-4">
                      <ViewAllLink to="/campaigns">View All Campaigns</ViewAllLink>
                    </CardBody>
                  </Card>

                  <Card className="xl:col-span-4">
                    <CardHeader title="Recent Alerts" />
                    <CardBody>
                      <AlertList alerts={data.alerts} />
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <ViewAllLink to="/tracking">View All Alerts</ViewAllLink>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            );
          }}
        </QueryBoundary>
      </div>
    </>
  );
}
