import { useCampaignDayImpressions } from '@/shared/api/hooks';
import { formatCount, formatDate, formatINR, formatKm, formatPercent } from '@/shared/format';
import {
  BaselineMixBar,
  Dialog,
  ErrorState,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  ZoneBadge,
} from '@/shared/ui';
import type { CampaignDayImpressions, ImpressionWorking, ZoneKey } from '@/shared/types/domain';

/**
 * One day of a campaign, with the model's working shown.
 *
 * The reason this screen exists at all: an impression count nobody can take
 * apart is a number an advertiser has to take on trust, and trust is the thing
 * the rest of this platform is built to avoid asking for. Everything here is
 * published so the figure can be argued with — coefficient by coefficient,
 * each of which someone can disagree with individually.
 */

const ZONE_TIER: Record<ZoneKey, 'PRIME' | 'SECONDARY' | 'NETWORK'> = {
  prime: 'PRIME',
  secondary: 'SECONDARY',
  network: 'NETWORK',
};

const kmh = (value: number) => `${value.toFixed(1)} km/h`;

export function ImpressionDayDialog({
  campaignId,
  date,
  onClose,
}: {
  campaignId: string;
  /** Null closes the dialog; the query is disabled with it. */
  date: string | null;
  onClose: () => void;
}) {
  const query = useCampaignDayImpressions(campaignId, date);

  return (
    <Dialog
      open={date !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={date ? formatDate(`${date}T00:00:00+05:30`) : 'Day'}
      description="Every coefficient the model multiplied to reach this day's audience, and the two speeds the congestion was read from."
      size="lg"
    >
      {query.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          onRetry={() => void query.refetch()}
          title="Could not load this day"
        />
      ) : (
        <DayWorking day={query.data} />
      )}
    </Dialog>
  );
}

function DayWorking({ day }: { day: CampaignDayImpressions }) {
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Figure label="Verified distance" value={formatKm(day.verifiedKm)} />
        <Figure label="Impressions" value={formatCount(day.impressions)} />
        <Figure label="Charged" value={formatINR(day.charge)} />
        <Figure label="Cost per 1,000" value={formatINR(day.cpm)} />
      </dl>

      <Speeds working={day.working} />

      <section>
        <h3 className="text-[13px] font-semibold text-slate-900">What was assumed</h3>
        <p className="mt-1 text-xs text-slate-500">
          Fixed by model {day.modelVersion} and identical for every campaign, so two advertisers
          reading the same road get the same answer.
        </p>

        <dl className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
          <Assumption
            label="Jam density"
            value={`${formatCount(day.working.jamDensity)} vehicles per lane-km`}
            hint="Bumper to bumper. The one parameter that can be defended from a photograph."
          />
          <Assumption
            label="Occupants per vehicle"
            value={day.working.occupantsPerVehicle.toFixed(2)}
            hint="Mean across the traffic mix, not per cab."
          />
          <Assumption
            label="Line of sight"
            value={formatPercent(day.working.lineOfSightShare)}
            hint="Share of people present who could see the wrap at all. Geometry, not print quality."
          />
          <Assumption
            label="Wrap legibility"
            value={formatPercent(day.working.wrapQuality)}
            hint="How readable the livery is, for those who can see it."
          />
        </dl>
      </section>

      <section>
        <h3 className="text-[13px] font-semibold text-slate-900">Per zone</h3>
        <p className="mt-1 text-xs text-slate-500">
          Pedestrian density is the one input with no measurement behind it.
        </p>

        <div className="mt-3">
          <Table caption="Zone assumptions" dense>
            <THead>
              <TR>
                <TH>Zone</TH>
                <TH numeric align="right">
                  Lanes in view
                </TH>
                <TH numeric align="right">
                  Pedestrians per km
                </TH>
              </TR>
            </THead>
            <TBody>
              {day.working.zones.map((zone) => (
                <TR key={zone.zone}>
                  <TD>
                    <ZoneBadge tier={ZONE_TIER[zone.zone]} />
                  </TD>
                  <TD numeric align="right">
                    {formatCount(zone.lanes)}
                  </TD>
                  <TD numeric align="right">
                    {formatCount(zone.pedestrianDensity)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </section>

      <section>
        <h3 className="text-[13px] font-semibold text-slate-900">Evidence behind this day</h3>
        <div className="mt-3">
          <BaselineMixBar mix={day.baselineMix} />
        </div>
      </section>
    </div>
  );
}

/**
 * The measured half of the model, and the only part that varies by day.
 *
 * Both figures are medians of their own distributions, so they are reported as
 * two medians rather than divided into a single congestion percentage: the
 * median of a ratio is not the ratio of the medians, and a headline number
 * computed that way would be wrong in exactly the cases it matters most.
 */
function Speeds({ working }: { working: ImpressionWorking }) {
  const observed = working.medianObservedKmh;
  const baseline = working.medianBaselineKmh;

  if (observed === null || baseline === null) {
    return (
      <section className="rounded-xl bg-slate-50 px-4 py-3">
        <h3 className="text-[13px] font-semibold text-slate-900">How busy the roads were</h3>
        <p className="mt-1 text-[13px] text-slate-500">
          No speeds were recorded for this day, so no congestion could be read from it.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl bg-slate-50 px-4 py-3">
      <h3 className="text-[13px] font-semibold text-slate-900">How busy the roads were</h3>
      <p className="mt-1 text-[13px] text-slate-600">
        Half the driving was at or below{' '}
        <span className="numeric font-semibold text-slate-900">{kmh(observed)}</span>, on roads
        that run at <span className="numeric font-semibold text-slate-900">{kmh(baseline)}</span>{' '}
        when clear. The gap between the two is the traffic, and the traffic is the audience.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Speed is derived from each segment&rsquo;s own distance and duration, never from what the
        handset claimed it was doing.
      </p>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className="numeric mt-0.5 text-[17px] font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function Assumption({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <dt className="text-[13px] text-slate-700">{label}</dt>
        <dd className="mt-0.5 text-xs text-slate-400">{hint}</dd>
      </div>
      <dd className="numeric shrink-0 text-[13px] font-medium text-slate-900">{value}</dd>
    </div>
  );
}
