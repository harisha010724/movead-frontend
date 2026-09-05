import { useState, type FormEvent } from 'react';
import { MapPin, Search } from 'lucide-react';
import { Page } from '@/shared/layout/Page';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ZoneBadge,
} from '@/shared/ui';
import { DateField, TextField } from '@/shared/ui/form';

/**
 * AC-25 — the screen that settles disputes.
 *
 * When an advertiser questions an invoice or a driver questions a payout, this
 * is where the answer comes from: the individual segments behind a day's
 * distance, each with its zone, rate, advertiser charge and driver earning.
 * Build it early; it pays for itself the first week of the pilot.
 */
export default function GpsAuditPage() {
  const [vehicleRef, setVehicleRef] = useState('');
  const [date, setDate] = useState('');
  const [searched, setSearched] = useState(false);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSearched(true);
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
              placeholder="KA01AB1234 or VH-1001"
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
            <Button type="submit" leadingIcon={<Search className="size-4" />}>
              Find trips
            </Button>
          </form>
        </CardBody>
      </Card>

      {!searched ? (
        <Card>
          <EmptyState
            icon={Search}
            title="Search for a vehicle and date"
            description="You will see every tracking session that day, the distance in each zone, and the segments behind it."
          />
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Route"
              description="Segments coloured by the zone they were classified into"
            />
            <CardBody>
              <div className="grid h-[420px] place-items-center rounded-xl bg-slate-100">
                <div className="text-center">
                  <MapPin className="mx-auto size-6 text-slate-400" />
                  <p className="mt-2 text-sm text-slate-600">Route polyline mounts here</p>
                  <p className="mt-1 max-w-sm text-xs text-slate-400">
                    Draw the trip as one polyline per segment so a boundary crossing is visible:
                    a trip that enters and leaves Prime must show as separate coloured runs, not
                    one colour for the whole journey.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <ZoneBadge tier="PRIME" />
                <ZoneBadge tier="SECONDARY" />
                <ZoneBadge tier="NETWORK" />
                <ZoneBadge tier="OUTSIDE" />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Trips" description="Sessions recorded on this date" />
            <CardBody>
              <p className="text-sm text-slate-500">
                The trip list and its per-zone breakdown mount here, each row expanding to the
                segments and rate that produced its charge.
              </p>
            </CardBody>
          </Card>
        </div>
      )}
    </Page>
  );
}
