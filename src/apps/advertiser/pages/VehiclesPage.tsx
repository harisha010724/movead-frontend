import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, MapPin, Plus, Truck } from 'lucide-react';
import { useAvailableFleet, type AvailableFleetVehicle } from '@/shared/api/hooks';
import { formatDate, formatRegistration } from '@/shared/format';
import { addIsoDays } from '@/shared/lib/civilDate';
import { Page } from '@/shared/layout/Page';
import { FleetMap } from '@/shared/maps/FleetMap';
import { Badge, Button, Card, CardHeader, EmptyState, QueryBoundary } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import type { VehicleAvailability } from '@/shared/types/domain';

type Filter = 'ALL' | 'CAB' | 'AUTO';

function kindLabel(type: 'CAB' | 'AUTO'): string {
  return type === 'AUTO' ? 'Auto' : 'Cab';
}

const AVAILABILITY: Record<
  VehicleAvailability,
  { label: string; tone: 'success' | 'warning' | 'info' }
> = {
  available: { label: 'Available', tone: 'success' },
  booked: { label: 'Booked', tone: 'info' },
  pending: { label: 'Pending review', tone: 'warning' },
};

function availability(row: AvailableFleetVehicle): { label: string; tone: 'success' | 'warning' | 'info' } {
  return AVAILABILITY[row.availability];
}

/** "Cab · KA 01 AB 1234" — the plate, falling back to the opaque reference. */
function vehicleTitle(row: AvailableFleetVehicle): string {
  const number = row.registrationNumber ? formatRegistration(row.registrationNumber) : row.publicRef;
  return `${kindLabel(row.vehicleType)} · ${number}`;
}

/**
 * Supply browse: every vehicle admin has onboarded with an operating pin.
 *
 * Each is named by its plate (AC-22.4); the driver behind it is not named
 * here. The advertiser uses this to see where they can place ads.
 */
export default function VehiclesPage() {
  const query = useAvailableFleet();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = useMemo(() => {
    const all = query.data?.items ?? [];
    if (filter === 'ALL') return all;
    return all.filter((row) => row.vehicleType === filter);
  }, [filter, query.data?.items]);

  return (
    <Page
      title="All vehicles"
      greeting="Vehicles operations has onboarded — pick a location, then start a campaign"
      contentClassName="flex min-h-0 flex-col"
      controls={
        <Button asChild>
          <Link to="/campaigns/new">
            <Plus className="size-4" aria-hidden />
            New campaign
          </Link>
        </Button>
      }
    >
      <QueryBoundary
        query={query}
        errorTitle="Could not load vehicles"
        isEmpty={(data) => data.items.length === 0}
        empty={
          <Card>
            <EmptyState
              icon={Truck}
              title="No vehicles onboarded yet"
              description="When operations adds a driver and drops their operating pin, the vehicle appears here so you can place ads in that area."
            />
          </Card>
        }
      >
        {(data) => (
          <Card className="flex min-h-[70vh] flex-1 flex-col overflow-hidden lg:min-h-0">
            <CardHeader
              title="Available vehicles"
              description={`${data.cabCount} cab${data.cabCount === 1 ? '' : 's'} · ${data.autoCount} auto${data.autoCount === 1 ? '' : 's'}`}
              action={
                <div className="flex rounded-lg bg-slate-100 p-0.5">
                  {(
                    [
                      ['ALL', 'All'],
                      ['CAB', 'Cabs'],
                      ['AUTO', 'Autos'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                        filter === value
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              }
            />

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
              <ul className="min-h-[22rem] space-y-2 overflow-y-auto border-slate-100 px-5 pb-5 lg:min-h-0 lg:border-r">
                {items.length === 0 ? (
                  <li className="rounded-xl bg-slate-50 px-4 py-8 text-center text-[13px] text-slate-500">
                    No {filter === 'CAB' ? 'cabs' : 'autos'} with an operating pin yet.
                  </li>
                ) : (
                  items.map((row) => {
                    const selected = row.id === selectedId;
                    const chip = availability(row);
                    const Icon = row.vehicleType === 'AUTO' ? Truck : Car;
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(row.id)}
                          className={cn(
                            'flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors',
                            selected
                              ? 'border-brand-300 bg-brand-50/70 ring-1 ring-brand-200'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                          )}
                        >
                          <span
                            className={cn(
                              'grid size-10 shrink-0 place-items-center rounded-lg',
                              row.vehicleType === 'AUTO'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-brand-50 text-brand-700',
                            )}
                          >
                            <Icon className="size-5" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="numeric truncate text-[13px] font-semibold text-slate-900">
                                {vehicleTitle(row)}
                              </span>
                              <Badge tone={chip.tone}>{chip.label}</Badge>
                            </span>
                            <span className="mt-1 flex items-center gap-1 text-[12px] text-slate-500">
                              <MapPin className="size-3 shrink-0" aria-hidden />
                              <span className="truncate">{row.areaLabel}</span>
                            </span>
                            {row.bookedUntil ? (
                              <span className="mt-1 block text-[11px] text-slate-500">
                                Free from {formatDate(addIsoDays(row.bookedUntil, 1))}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>

              <div className="relative min-h-[28rem] overflow-hidden lg:min-h-0">
                <FleetMap
                  pins={items.map((row) => ({
                    id: row.id,
                    lat: row.lat,
                    lng: row.lng,
                    kind: row.vehicleType,
                    title: vehicleTitle(row),
                    subtitle: row.areaLabel,
                  }))}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
                <div className="pointer-events-none absolute right-3 bottom-3 flex gap-2">
                  <Legend color="bg-brand-600" label="Cab" />
                  <Legend color="bg-amber-600" label="Auto" />
                </div>
              </div>
            </div>
          </Card>
        )}
      </QueryBoundary>
    </Page>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2 py-1 text-[11px] font-medium text-slate-600 shadow-card">
      <span className={cn('size-2 rounded-full', color)} aria-hidden />
      {label}
    </span>
  );
}
