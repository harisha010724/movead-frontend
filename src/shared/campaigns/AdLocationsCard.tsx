import { useEffect, useMemo, useState } from 'react';
import { Car, MapPin, Maximize2, Truck } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Badge, Button, Card, CardBody, CardHeader, Dialog } from '@/shared/ui';
import { FormError } from '@/shared/ui/form';
import { ZoneMapEditor, type ZoneVehiclePin } from '@/shared/maps/ZoneMapEditor';
import { ZONE_MAP_COLORS } from '@/shared/maps/zoneColors';
import type { CampaignLocation, ZonePolygons } from '@/shared/maps/types';
import {
  AVAILABILITY,
  areaLabel,
  hasOutline,
  kindLabel,
  unavailableReason,
  useVehiclesInZones,
  vehicleNumber,
  type AvailableVehicle,
  type VehiclesEndpoint,
} from './vehiclesInZones';

/**
 * Where the ad runs, and who will carry it — one card, because they are one
 * decision.
 *
 * Drawing an outline *is* choosing vehicles: the zone selects them. Splitting
 * the two into separate cards meant drawing a shape at the top of the page and
 * scrolling down to find out what it had caught, then scrolling back to adjust
 * it. Here the list on the left fills in as the outline on the right closes,
 * and the same vehicles appear as pins on the map that selected them.
 *
 * The advertiser picks which ones should carry the ad. That is a request —
 * operations still confirms assignment (AC-22.4).
 */
export function AdLocationsCard({
  city,
  vehicleType,
  locations,
  polygons,
  onLocationsChange,
  onPolygonsChange,
  endpoint,
  selectedIds,
  onChange,
  locationsError,
  vehiclesError,
}: {
  city: string;
  vehicleType: 'CAB' | 'AUTO';
  locations: CampaignLocation[];
  polygons: ZonePolygons | undefined;
  onLocationsChange: (next: CampaignLocation[]) => void;
  onPolygonsChange: (next: ZonePolygons) => void;
  endpoint: VehiclesEndpoint;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  locationsError?: string;
  vehiclesError?: string;
}) {
  const ready = hasOutline(polygons);
  const query = useVehiclesInZones(endpoint, vehicleType, polygons);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const items = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const selectedSet = new Set(selectedIds);
  const selectable = items.filter((row) => row.availability === 'available');
  const allSelected = selectable.length > 0 && selectable.every((row) => selectedSet.has(row.id));

  /*
   * Only the admin endpoint returns a name. Deciding this from the data rather
   * than from a prop means the field cannot appear on a response that has
   * nothing to put in it.
   */
  const showsDriver = items.some((row) => row.driverName);

  const pins: ZoneVehiclePin[] = useMemo(
    () =>
      items.map((row) => ({
        id: row.id,
        lat: row.lat,
        lng: row.lng,
        kind: row.vehicleType,
        title: `${kindLabel(row.vehicleType)} · ${vehicleNumber(row)}`,
        subtitle:
          row.availability === 'available'
            ? areaLabel(row)
            : `${areaLabel(row)} — ${AVAILABILITY[row.availability].label}`,
        muted: row.availability !== 'available',
      })),
    [items],
  );

  useEffect(() => {
    if (!query.data) return;
    // A vehicle that has been booked or withdrawn since the list was drawn is
    // dropped from the selection rather than silently ordered.
    const orderable = new Set(
      query.data.items.filter((row) => row.availability === 'available').map((row) => row.id),
    );
    const next = selectedIds.filter((id) => orderable.has(id));
    if (next.length !== selectedIds.length) onChange(next);
  }, [onChange, query.data, selectedIds]);

  const toggle = (id: string) => {
    onChange(selectedSet.has(id) ? selectedIds.filter((row) => row !== id) : [...selectedIds, id]);
  };

  /*
   * The editor only ever exists inside the dialog.
   *
   * It was on the page as well, which meant maintaining a map in a column the
   * spend estimate had already narrowed — too small to draw a city zone on, and
   * a second Google map listening for a click on the same corner.
   */
  const editor = (
    <>
      {/*
        The same breakpoint the All vehicles browse splits at, so the two
        screens rearrange at the same window width rather than one of them
        stacking while the other does not.
      */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <section className="order-2 min-w-0 lg:order-1">
            <header className="flex items-baseline justify-between gap-3 pb-2">
              <h3 className="text-[13px] font-semibold text-slate-900">Vehicles in these zones</h3>
              {selectable.length > 0 ? (
                <button
                  type="button"
                  className="text-[12px] font-medium text-slate-600 hover:text-slate-900"
                  onClick={() => {
                    onChange(allSelected ? [] : selectable.map((row) => row.id));
                  }}
                >
                  {allSelected ? 'Clear all' : 'Select all available'}
                </button>
              ) : null}
            </header>

            {!ready ? (
              <p className="rounded-xl bg-slate-50 px-4 py-6 text-[13px] text-slate-500">
                Draw a Prime or Secondary outline and the vehicles inside it are listed here.
              </p>
            ) : query.isPending ? (
              <p className="rounded-xl bg-slate-50 px-4 py-6 text-[13px] text-slate-500">
                Looking up vehicles in these outlines…
              </p>
            ) : query.isError ? (
              <p className="rounded-xl bg-rose-50 px-4 py-6 text-[13px] text-rose-700">
                Could not load vehicles for these zones.
              </p>
            ) : items.length === 0 ? (
              <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-4">
                <Car className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                <p className="text-[13px] text-slate-600">
                  No vehicles have an operating pin inside this outline yet. Widen it, or ask
                  operations to onboard drivers in this area.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[12px] text-slate-500">
                  {query.data?.availableCount ?? 0} available
                  <span className="text-slate-300"> · </span>
                  {query.data?.primeCount ?? 0} Prime
                  <span className="text-slate-300"> · </span>
                  {query.data?.secondaryCount ?? 0} Secondary
                  <span className="text-slate-300"> · </span>
                  <span className="font-medium text-slate-700">
                    {selectedIds.length} selected
                  </span>
                </p>

                <ul className="max-h-[calc(80vh-11rem)] space-y-2 overflow-y-auto pr-1">
                  {items.map((row) => (
                    <VehicleRow
                      key={row.id}
                      row={row}
                      checked={selectedSet.has(row.id)}
                      focused={focusedId === row.id}
                      showsDriver={showsDriver}
                      onToggle={() => toggle(row.id)}
                      onLocate={() => setFocusedId(row.id)}
                    />
                  ))}
                </ul>

                {selectable.length === 0 ? (
                  <p className="text-[12px] text-slate-500">
                    None of these can be ordered yet — they are booked or still in review.
                  </p>
                ) : null}
              </div>
            )}

        {vehiclesError ? <FormError message={vehiclesError} className="mt-3" /> : null}
      </section>

      <div className="order-1 min-w-0 lg:order-2">
        <ZoneMapEditor
          city={city}
          locations={locations}
          polygons={polygons ?? {}}
          onLocationsChange={onLocationsChange}
          onPolygonsChange={onPolygonsChange}
          vehicles={pins}
          selectedVehicleId={focusedId}
          onVehicleSelect={setFocusedId}
          mapClassName="h-[calc(80vh-13rem)] min-h-[24rem]"
          {...(locationsError ? { error: locationsError } : {})}
        />
      </div>
      </div>
    </>
  );

  return (
    <>
      <Card>
        <CardHeader
          title="Ad locations"
          description="Where the ad runs, and which vehicles carry it. Network is leftover geography, not a drawn zone."
        />
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ZoneSummary
              polygons={polygons}
              ready={ready}
              matched={items.length}
              selected={selectedIds.length}
              loading={query.isPending && ready}
            />
            <Button
              type="button"
              variant={ready ? 'secondary' : 'primary'}
              leadingIcon={<Maximize2 className="size-4" />}
              onClick={() => setExpanded(true)}
            >
              {ready ? 'Edit zones and vehicles' : 'Draw zones and pick vehicles'}
            </Button>
          </div>

          {locationsError ? <FormError message={locationsError} className="mt-3" /> : null}
          {vehiclesError ? <FormError message={vehiclesError} className="mt-3" /> : null}
        </CardBody>
      </Card>

      <Dialog
        open={expanded}
        onOpenChange={setExpanded}
        title="Ad locations"
        description="Draw Prime and Secondary outlines on the map. Vehicles whose usual area falls inside them are listed on the left as you draw."
        size="xl"
        footer={
          <Button type="button" onClick={() => setExpanded(false)}>
            Done
          </Button>
        }
      >
        {expanded ? editor : null}
      </Dialog>
    </>
  );
}

/**
 * What the closed card knows: the zones drawn, and what they caught.
 *
 * The editor lives behind a button, so this is the only account of it the form
 * gives. A card that said nothing but "Ad locations" would leave a buyer
 * reopening the dialog to check whether they had drawn anything.
 */
function ZoneSummary({
  polygons,
  ready,
  matched,
  selected,
  loading,
}: {
  polygons: ZonePolygons | undefined;
  ready: boolean;
  matched: number;
  selected: number;
  loading: boolean;
}) {
  if (!ready) {
    return (
      <p className="text-[13px] text-slate-500">
        No zones drawn yet. Prime is ₹5/km and Secondary ₹2/km; everywhere else is Network at
        ₹1/km.
      </p>
    );
  }

  const drawn = (['prime', 'secondary'] as const).filter(
    (tier) => (polygons?.[tier]?.path.length ?? 0) >= 3,
  );

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        {drawn.map((tier) => (
          <span
            key={tier}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
            style={{ background: ZONE_MAP_COLORS[tier].stroke }}
          >
            {tier === 'prime' ? 'Prime' : 'Secondary'}
            <span className="numeric opacity-80">
              {polygons?.[tier]?.path.length ?? 0} corners
            </span>
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[13px] text-slate-600">
        {loading
          ? 'Looking up vehicles in these outlines…'
          : matched === 0
            ? 'No vehicles have an operating pin inside these outlines yet.'
            : `${selected} of ${matched} vehicle${matched === 1 ? '' : 's'} selected.`}
      </p>
    </div>
  );
}

/**
 * Two controls, because there are two things to do with a vehicle.
 *
 * The tick box orders it; the rest of the row shows it on the map. Making the
 * whole row toggle the order would mean a buyer cannot look at a vehicle
 * without also buying it, and a booked row — which cannot be ordered at all —
 * would have nothing left to click.
 */
function VehicleRow({
  row,
  checked,
  focused,
  showsDriver,
  onToggle,
  onLocate,
}: {
  row: AvailableVehicle;
  checked: boolean;
  focused: boolean;
  showsDriver: boolean;
  onToggle: () => void;
  onLocate: () => void;
}) {
  const state = AVAILABILITY[row.availability];
  const orderable = row.availability === 'available';
  const Icon = row.vehicleType === 'AUTO' ? Truck : Car;
  const reason = unavailableReason(row);
  const name = `${kindLabel(row.vehicleType)} ${vehicleNumber(row)}`;

  return (
    <li
      className={cn(
        'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors',
        checked
          ? 'border-brand-300 bg-brand-50/70 ring-1 ring-brand-200'
          : focused
            ? 'border-slate-300 bg-slate-50'
            : 'border-slate-200 bg-white hover:border-slate-300',
      )}
    >
      <input
        type="checkbox"
        className="text-brand-600 focus:ring-brand-500 mt-2 size-4 shrink-0 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
        checked={checked}
        disabled={!orderable}
        onChange={onToggle}
        aria-label={orderable ? `Select ${name}` : `${name} cannot be selected. ${reason}`}
      />

      <button
        type="button"
        onClick={onLocate}
        aria-pressed={focused}
        className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
      >
        <span
          className={cn(
            'mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg',
            !orderable
              ? 'bg-slate-100 text-slate-400'
              : row.vehicleType === 'AUTO'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-brand-50 text-brand-700',
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span
              className={cn(
                'numeric truncate text-[13px] font-semibold',
                orderable ? 'text-slate-900' : 'text-slate-500',
              )}
            >
              {vehicleNumber(row)}
            </span>
            <Badge tone={state.tone}>{state.label}</Badge>
          </span>

          <span className="mt-1 flex items-center gap-1.5 text-[12px] text-slate-500">
            <MapPin className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{areaLabel(row)}</span>
            <span
              className="ml-0.5 shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium text-white"
              style={{ background: ZONE_MAP_COLORS[row.zone].stroke }}
            >
              {row.zone === 'prime' ? 'Prime' : 'Secondary'}
            </span>
            <span className="shrink-0 text-slate-400">{kindLabel(row.vehicleType)}</span>
          </span>

          {showsDriver ? (
            <span className="mt-1 block truncate text-[12px] text-slate-500">
              {row.driverName ?? '—'}
            </span>
          ) : null}

          {!orderable ? (
            <span className="mt-1 block text-[11px] text-slate-500">{reason}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
