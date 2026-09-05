import { AlertTriangle, Car, Info, MapPin } from 'lucide-react';
import { useAcceptAssignment, useDriverCampaign } from '@/shared/api/hooks';
import { toDisplayMessage } from '@/shared/api/errors';
import { formatDateRange, formatINR, formatKm } from '@/shared/format';
import { Page } from '@/shared/layout/Page';
import type { DriverCampaign } from '@/shared/types/domain';
import { Button, Card, CardBody, CardHeader, EmptyState, QueryBoundary } from '@/shared/ui';
import { FormError } from '@/shared/ui/form';

import { DriverCampaignStatusBadge } from '../campaignStatus';

/**
 * My Campaign — UI-025 to UI-028.
 *
 * The campaign appears from the advertiser's vehicle request onward, not only
 * once it is live: the driver has to see it to accept it (AC-22.5), and being
 * picked is worth knowing before operations confirms it (AC-22.4). The badge
 * and the stage banner carry how firm it is, so "requested" and "assigned but
 * not yet installed" are never mistaken for "running".
 */
export default function CampaignPage() {
  const query = useDriverCampaign();

  return (
    <Page title="My Campaign" greeting="The wrap you are carrying and how far it has to go">
      <QueryBoundary query={query} errorTitle="Could not load campaign">
        {(data) => (data ? <CampaignDetail campaign={data} /> : <NoCampaign />)}
      </QueryBoundary>
    </Page>
  );
}

/** UI-024.4 — an explanatory empty state, not a blank card. */
function NoCampaign() {
  return (
    <Card>
      <CardBody>
        <EmptyState
          icon={Car}
          title="No campaign assigned"
          description="When an advertiser books your vehicle, the campaign and its installation appointment appear here."
        />
      </CardBody>
    </Card>
  );
}

function CampaignDetail({ campaign }: { campaign: DriverCampaign }) {
  const accept = useAcceptAssignment();
  const progress =
    campaign.totalDays > 0 ? Math.round((campaign.elapsedDays / campaign.totalDays) * 100) : 0;

  return (
    <div className="space-y-5">
      <StageBanner campaign={campaign} />

      <Card>
        <CardHeader
          title={campaign.name}
          description={`${campaign.brandName} · ${formatDateRange(campaign.startDate, campaign.endDate)}`}
          action={<DriverCampaignStatusBadge status={campaign.status} />}
        />
        <CardBody>
          <dl className="grid gap-4 text-[13px] sm:grid-cols-3">
            <div>
              <dt className="text-slate-400">Vehicle</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {campaign.vehicleRegistration}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Monthly target</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {formatKm(campaign.minMonthlyTargetKm)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Days left</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{campaign.daysLeft}</dd>
            </div>
          </dl>

          {/* UI-027: elapsed against total, as a bar and as a label. */}
          <div className="mt-5">
            <div className="flex justify-between text-[12px] text-slate-500">
              <span>
                {campaign.elapsedDays} / {campaign.totalDays} days
              </span>
              <span>Expected {formatINR(campaign.expectedMonthlyEarning)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-500 transition-[width]"
                style={{ width: `${String(Math.min(100, Math.max(0, progress)))}%` }}
              />
            </div>
          </div>

          {/*
            Guarded on the id, not only on the status: a requested campaign has
            no assignment, and a button that posts to `/assignments/null/accept`
            is worse than no button.
          */}
          {campaign.status === 'assigned' && campaign.assignmentId !== null && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-[13px] text-slate-600">
                Accept this campaign to book your installation appointment.
              </p>
              <Button
                className="mt-3"
                onClick={() => accept.mutate(campaign.assignmentId as string)}
                disabled={accept.isPending}
              >
                {accept.isPending ? 'Accepting…' : 'Accept campaign'}
              </Button>
              {accept.isError && <FormError message={toDisplayMessage(accept.error)} />}
            </div>
          )}
        </CardBody>
      </Card>

      {/* UI-028: the rate the driver is paid, which is not the advertiser's rate. */}
      <Card>
        <CardHeader
          title="What you earn"
          description="Per verified kilometre, by the zone you are driving in."
        />
        <CardBody>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {campaign.rateCard.zones.map((zone) => (
              <li key={zone.zone} className="flex items-center justify-between px-4 py-3">
                <span className="text-[13px] font-medium text-slate-800">{zone.label}</span>
                <span className="text-[13px] tabular-nums text-slate-900">
                  {formatINR(zone.ratePerKm)} / km
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {campaign.areas.length > 0 && (
        <Card>
          <CardHeader
            title="Campaign areas"
            description="Driving inside these areas earns the higher rate."
          />
          <CardBody>
            <ul className="flex flex-wrap gap-2">
              {campaign.areas.map((area) => (
                <li
                  key={area.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] text-slate-700"
                >
                  <MapPin className="size-3.5 text-slate-400" aria-hidden />
                  {area.name}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="What you agree to" />
        <CardBody>
          <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-slate-600">
            {campaign.terms.map((term) => (
              <li key={term}>{term}</li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * The one thing the driver most needs to know before they start driving: why
 * they are not earning yet, and what happens next.
 *
 * A request gets a calmer treatment than the installation stages. Amber here
 * means "you have something to do"; waiting for operations to confirm is the
 * one stage where the driver has nothing to do, and dressing it as an alert
 * would train them to ignore the ones that are.
 */
function StageBanner({ campaign }: { campaign: DriverCampaign }) {
  if (campaign.status === 'requested') {
    return (
      <div className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-sky-600" aria-hidden />
        <div>
          <p className="text-[13px] font-medium text-sky-900">Not confirmed yet</p>
          <p className="mt-0.5 text-[13px] text-sky-800">
            An advertiser has asked for your vehicle. Operations checks every request before
            anything is fitted — you will be asked to accept once they confirm it. Nothing is
            booked and you do not need to do anything yet.
          </p>
        </div>
      </div>
    );
  }

  const installation = campaign.installation;
  if (!installation || campaign.status === 'active') return null;

  const message =
    installation.status === 'REJECTED'
      ? (installation.rejectionReason ??
        'The wrap needs to be redone before this campaign can start.')
      : campaign.status === 'assigned'
        ? 'Accept the campaign and operations will book your installation appointment.'
        : installation.status === 'SUBMITTED'
          ? 'Your installation photos are with operations. You can start earning as soon as they are approved.'
          : 'Get the wrap fitted, then operations will check the photos and switch the campaign on.';

  return (
    <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
      <div>
        <p className="text-[13px] font-medium text-amber-900">Not earning yet</p>
        <p className="mt-0.5 text-[13px] text-amber-800">{message}</p>
      </div>
    </div>
  );
}

