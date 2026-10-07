import type { ReactNode } from 'react';
import { CalendarDays, Car, Layers2, MapPin, Route } from 'lucide-react';

import { formatDate, formatINR, formatKm } from '@/shared/format';
import { Card, CardBody, CardHeader } from '@/shared/ui';
import type { CampaignLocation, ZonePolygons } from '@/shared/maps/types';
import { adDimensionLabel, defaultAdDimension, vehicleTypeLabel } from './vehicleCatalog';
import { VehicleAdPreview } from './VehicleAdPreview';
import { LocationPinList, draftLocationPins } from './LocationPinList';
import {
  DEFAULT_ZONE_RATES,
  previewZoneEstimate,
  rupeeValue,
  type ZoneRates,
} from '@/shared/schemas/campaign';

export interface CampaignDraftPreviewValues {
  name?: string;
  brandName?: string;
  city?: string;
  vehicleType?: string;
  adDimension?: string;
  startDate?: string;
  endDate?: string;
  zonePrimeKm?: string;
  zoneSecondaryKm?: string;
  locations?: CampaignLocation[];
  zonePolygons?: ZonePolygons;
  vehiclesCount?: number;
  advertiserName?: string;
}

/** Wizard order used to decide which later blocks are allowed to appear. */
const STEP_ORDER = [
  'advertiser',
  'details',
  'vehicle',
  'plan',
  'locations',
  'creative',
  'instruction',
] as const;

function hasReached(farthestStepId: string | undefined, stepId: string): boolean {
  if (!farthestStepId) return false;
  return STEP_ORDER.indexOf(farthestStepId as (typeof STEP_ORDER)[number]) >=
    STEP_ORDER.indexOf(stepId as (typeof STEP_ORDER)[number]);
}

/**
 * The preview grows with the brief. A row only appears after that input
 * has a value, and later steps stay hidden until the advertiser reaches them
 * — so a default cab wrap does not show on the name step.
 */
export function CampaignDraftPreview({
  values,
  farthestStepId,
  rates = DEFAULT_ZONE_RATES,
}: {
  values: CampaignDraftPreviewValues;
  farthestStepId?: string;
  rates?: ZoneRates;
}) {
  const name = values.name?.trim();
  const brand = values.brandName?.trim();
  const city = values.city?.trim();
  const startDate = values.startDate?.trim();
  const endDate = values.endDate?.trim();
  const hasKm = rupeeValue(values.zonePrimeKm) + rupeeValue(values.zoneSecondaryKm) > 0;
  const estimate = previewZoneEstimate(values, rates);
  const showVehicle = hasReached(farthestStepId, 'vehicle');
  const showPlan = hasReached(farthestStepId, 'plan');
  const showLocations = hasReached(farthestStepId, 'locations');
  const locationPins = showLocations
    ? draftLocationPins(values.locations, values.zonePolygons)
    : [];
  const vehicleType = values.vehicleType;
  const adDimension = values.adDimension;
  const hasIdentity = Boolean(name || brand || values.advertiserName);
  const hasAnything =
    hasIdentity ||
    Boolean(city) ||
    (showVehicle && Boolean(vehicleType)) ||
    (showPlan && Boolean(startDate || hasKm)) ||
    (showLocations && Boolean(locationPins.length || values.vehiclesCount));

  return (
    <aside data-testid="campaign-draft-preview" className="space-y-4">
      <Card>
        <CardHeader
          title="Preview"
          description={
            hasAnything ? 'Filled in as you complete each step.' : 'Each answer you enter appears here.'
          }
        />
        <CardBody className="space-y-4">
          {hasAnything ? (
            <>
              {values.advertiserName ? (
                <p className="text-[12px] text-slate-500">
                  For <span className="font-medium text-slate-800">{values.advertiserName}</span>
                </p>
              ) : null}

              {hasIdentity ? (
                <div>
                  {name ? (
                    <p className="text-[16px] font-semibold tracking-tight text-slate-900">{name}</p>
                  ) : null}
                  {brand ? <p className="mt-0.5 text-[13px] text-slate-500">{brand}</p> : null}
                </div>
              ) : null}

              {showVehicle && vehicleType ? (
                <VehicleAdPreview
                  vehicleType={vehicleType}
                  adDimension={adDimension || defaultAdDimension(vehicleType)}
                />
              ) : null}

              <dl className="space-y-2.5 text-[13px]">
                {city ? (
                  <PreviewRow icon={<MapPin className="size-3.5" />} label="City" value={city} />
                ) : null}
                {showVehicle && vehicleType ? (
                  <PreviewRow
                    icon={<Layers2 className="size-3.5" />}
                    label="Vehicle wrap"
                    value={`${vehicleTypeLabel(vehicleType)}${
                      adDimension ? ` · ${adDimensionLabel(vehicleType, adDimension)}` : ''
                    }`}
                  />
                ) : null}
                {showPlan && startDate ? (
                  <PreviewRow
                    icon={<CalendarDays className="size-3.5" />}
                    label="Dates"
                    value={
                      endDate
                        ? `${formatDate(`${startDate}T00:00:00Z`)} – ${formatDate(`${endDate}T00:00:00Z`)}`
                        : `From ${formatDate(`${startDate}T00:00:00Z`)}`
                    }
                  />
                ) : null}
                {showPlan && hasKm ? (
                  <PreviewRow
                    icon={<Route className="size-3.5" />}
                    label="Kilometres"
                    value={`${formatKm(estimate.totalKm)} · ${formatINR(estimate.totalAmount.toFixed(2))}`}
                  />
                ) : null}
                {showLocations && values.vehiclesCount ? (
                  <PreviewRow
                    icon={<Car className="size-3.5" />}
                    label="Vehicles"
                    value={`${values.vehiclesCount} selected`}
                  />
                ) : null}
              </dl>

              {locationPins.length > 0 ? (
                <div>
                  <p className="mb-2 text-[12px] font-medium text-slate-500">
                    {locationPins.length} pin{locationPins.length === 1 ? '' : 's'}
                  </p>
                  <LocationPinList pins={locationPins} compact />
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-[13px] leading-relaxed text-slate-500">
              Start with the campaign name. The wrap, city, dates and kilometres join the preview
              when you fill those steps.
            </p>
          )}
        </CardBody>
      </Card>
    </aside>
  );
}

function PreviewRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-slate-500">
        {icon ? <span className="text-slate-400">{icon}</span> : null}
        {label}
      </dt>
      <dd className="max-w-[60%] text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}
