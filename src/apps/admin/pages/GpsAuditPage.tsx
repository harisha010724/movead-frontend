import { useState, type FormEvent } from 'react';
import { AlertTriangle, Route, Search } from 'lucide-react';
import { Page } from '@/shared/layout/Page';
import { useGpsAuditTrip, useGpsAuditTrips } from '@/shared/api/hooks';
import { formatINR, formatKm, formatRate, formatRegistration, formatTime } from '@/shared/format';
import { TripRouteMap } from '@/shared/maps/TripRouteMap';
import type { AuditTrip, TripLeg } from '@/shared/types/domain';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  QueryBoundary,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  ZoneBadge,
} from '@/shared/ui';
import { DateField, TextField } from '@/shared/ui/form';

/**
 * AC-25 — the screen that settles disputes.
 *
 * When an advertiser questions an invoice or a driver questions a payout, this
 * is where the answer comes from: the individual runs behind a day's distance,
 * each with its zone, rate, advertiser charge and driver earning, drawn on the
 * ground they were driven on.
 *
 * Entered by plate and date because that is how a dispute arrives, and keyed
 * on the vehicle rather than the driver for the same reason: the livery is on
 * the car, so a vehicle handed to a relief driver mid-campaign was still
 * working, and splitting that day in two would answer a question nobody asked.
 */
export default function GpsAuditPage() {
  const [vehicleRef, setVehicleRef] = useState('');
  const [date, setDate] = useState('');
  const [search, setSearch] = useState<{ vehicleRef: string; date: string } | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [selectedLeg, setSelectedLeg] = useState<number | null>(null);

  const day = useGpsAuditTrips(search?.vehicleRef ?? '', search?.date ?? '');
  const trip = useGpsAuditTrip(tripId);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!vehicleRef.trim() || !date) return;
    // A new search invalidates whatever was open, or the route on the right
    // would keep describing a trip that is no longer in the list on the left.
    setTripId(null);
    setSelectedLeg(null);
    setSearch({ vehicleRef: vehicleRef.trim(), date });
  };

  const openTrip = (id: string) => {
    setTripId(id);
    setSelectedLeg(null);
  };

  return (
    <Page
      title="GPS audit"
      greeting="Trace any billed kilometre back to the GPS points that produced it"
    >
      <Card className="mb-5">
        <CardBody className="pt-5">
          <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-4">
            <TextField
              label="Vehicle"
              placeholder="KA01AB1234"
              hint="The full registration. Spacing and case do not matter."
              containerClassName="min-w-56 flex-1"
              value={vehicleRef}
              onChange={(e) => setVehicleRef(e.target.value)}
            />
            <DateField
              label="Date"
              containerClassName="min-w-44"
              value={date}
              onChange={setDate}
            />
            <Button
              type="submit"
              disabled={!vehicleRef.trim() || !date}
              leadingIcon={<Search className="size-4" />}
            >
              Find trips
            </Button>
          </form>
        </CardBody>
      </Card>

      {!search ? (
        <Card>
          <EmptyState
            icon={Search}
            title="Search for a vehicle and date"
            description="You will see every tracking session that day, the distance in each zone, and the runs behind it."
          />
        </Card>
      ) : (
        <QueryBoundary query={day} errorTitle="Could not load that day">
          {(loaded) => (
            <>
              <DayTotals
                registration={loaded.vehicle.registrationNumber}
                verifiedKm={loaded.totalVerifiedKm}
                earnings={loaded.totalEarnings}
                charge={loaded.totalCharge}
              />

              {loaded.trips.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={Route}
                    title="This vehicle did not work that day"
                    description="No tracking session was recorded. Nothing was billed for it, and nothing is owed on it."
                  />
                </Card>
              ) : (
                <div className="grid gap-5 xl:grid-cols-3">
                  <Card className="xl:col-span-2">
                    <CardHeader
                      title="Route"
                      description={
                        tripId
                          ? 'Each stretch coloured by the zone it was classified into'
                          : 'Pick a trip to replay it'
                      }
                    />
                    <CardBody>
                      {!tripId ? (
                        <div className="grid h-[26rem] place-items-center rounded-xl bg-slate-50">
                          <p className="max-w-xs text-center text-sm text-slate-500">
                            Choose a trip on the right to see where it ran and which zone paid for
                            each part of it.
                          </p>
                        </div>
                      ) : (
                        <QueryBoundary query={trip} errorTitle="Could not load that trip">
                          {(detail) => (
                            <>
                              <TripRouteMap
                                legs={detail.legs}
                                selectedLeg={selectedLeg}
                                onSelectLeg={setSelectedLeg}
                              />
                              <TripSummary
                                campaignName={detail.campaignName}
                                driverName={detail.driverName}
                                distanceKm={detail.distanceKm}
                                charge={detail.advertiserCharge}
                                earning={detail.driverEarning}
                              />
                              <LegTable
                                legs={detail.legs}
                                selected={selectedLeg}
                                onSelect={setSelectedLeg}
                              />
                            </>
                          )}
                        </QueryBoundary>
                      )}
                    </CardBody>
                  </Card>

                  <Card className="self-start">
                    <CardHeader title="Trips" description="Sessions recorded on this date" />
                    <CardBody className="space-y-2">
                      {loaded.trips.map((item) => (
                        <TripButton
                          key={item.id}
                          trip={item}
                          selected={item.id === tripId}
                          onSelect={() => openTrip(item.id)}
                        />
                      ))}
                    </CardBody>
                  </Card>
                </div>
              )}
            </>
          )}
        </QueryBoundary>
      )}
    </Page>
  );
}

function DayTotals({
  registration,
  verifiedKm,
  earnings,
  charge,
}: {
  registration: string;
  verifiedKm: number;
  earnings: string;
  charge: string;
}) {
  return (
    <Card className="mb-5">
      <CardBody className="flex flex-wrap items-center gap-x-10 gap-y-4 pt-5">
        <Figure label="Vehicle" value={formatRegistration(registration)} />
        <Figure label="Verified distance" value={formatKm(verifiedKm)} />
        <Figure label="Advertiser charged" value={formatINR(charge)} />
        <Figure label="Driver earned" value={formatINR(earnings)} />
      </CardBody>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="numeric mt-0.5 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function TripButton({
  trip,
  selected,
  onSelect,
}: {
  trip: AuditTrip;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-xl px-3.5 py-3 text-left transition-colors ${
        selected ? 'bg-brand-50 ring-brand-300 ring-1' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-slate-900">Trip {trip.sequence}</span>
        <span className="numeric text-[13px] text-slate-500">
          {formatTime(trip.startedAt)} – {formatTime(trip.endedAt)}
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <span className="numeric text-[13px] text-slate-600">
          {formatKm(trip.verifiedKm)} · {formatINR(trip.earnings)}
        </span>
        {trip.status === 'pending_review' ? (
          <Badge tone="warning">In review</Badge>
        ) : trip.status === 'rejected' ? (
          <Badge tone="danger">Not counted</Badge>
        ) : (
          <Badge tone="success">Verified</Badge>
        )}
      </div>
      {trip.zoneBreakdown ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {trip.zoneBreakdown.map((part) => (
            <span key={part.zone} className="numeric text-[11px] text-slate-500">
              {part.zone} {formatKm(part.km)}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}

function TripSummary({
  campaignName,
  driverName,
  distanceKm,
  charge,
  earning,
}: {
  campaignName: string;
  driverName: string;
  distanceKm: number;
  charge: string;
  earning: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-[13px] text-slate-600">
      <span>
        Campaign <span className="font-medium text-slate-900">{campaignName}</span>
      </span>
      <span>
        Driver <span className="font-medium text-slate-900">{driverName}</span>
      </span>
      <span className="numeric">
        {formatKm(distanceKm)} billed · {formatINR(charge)} charged · {formatINR(earning)} earned
      </span>
    </div>
  );
}

/**
 * The runs, not the segments.
 *
 * A segment is one pair of GPS fixes seconds apart and an afternoon holds
 * thousands of them; consecutive segments agreeing on zone, state and reason
 * are one fact about the journey, so the API merges them and reports how many
 * went into each. The count is the audit trail — a run of 312 segments is a
 * claim about 312 measurements, and it is here so it can be challenged.
 */
function LegTable({
  legs,
  selected,
  onSelect,
}: {
  legs: TripLeg[];
  selected: number | null;
  onSelect: (index: number | null) => void;
}) {
  return (
    <div className="mt-4 border-t border-slate-100 pt-1">
      <Table caption="Priced runs behind this trip">
        <THead>
          <TR>
            <TH>Zone</TH>
            <TH>From</TH>
            <TH numeric>Distance</TH>
            <TH numeric>Rate</TH>
            <TH numeric>Charged</TH>
            <TH numeric>Earned</TH>
            <TH numeric>Segments</TH>
          </TR>
        </THead>
        <TBody>
          {legs.map((leg, index) => (
            <TR
              key={`${leg.startedAt}-${String(index)}`}
              className={selected === index ? 'bg-brand-50' : ''}
            >
              <TD>
                <button
                  type="button"
                  onClick={() => onSelect(selected === index ? null : index)}
                  aria-pressed={selected === index}
                  className="cursor-pointer"
                >
                  <ZoneBadge tier={leg.zone.toUpperCase() as 'PRIME' | 'SECONDARY' | 'NETWORK'} />
                </button>
                {leg.state !== 'BILLABLE' ? (
                  <span
                    className="mt-1 flex items-center gap-1 text-[11px] text-amber-700"
                    title={leg.flagReason ?? undefined}
                  >
                    <AlertTriangle className="size-3" aria-hidden />
                    {leg.state === 'PENDING_REVIEW' ? 'Held' : 'Not counted'}
                  </span>
                ) : null}
              </TD>
              <TD className="numeric">{formatTime(leg.startedAt)}</TD>
              <TD numeric>{formatKm(leg.distanceKm)}</TD>
              <TD numeric>{formatRate(leg.advertiserRate)}</TD>
              <TD numeric>{formatINR(leg.advertiserCharge)}</TD>
              <TD numeric>{formatINR(leg.driverEarning)}</TD>
              <TD numeric>{leg.segments}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
