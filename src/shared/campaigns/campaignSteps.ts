import type { FormStep } from '@/shared/ui/FormStepper';
import type { AdminCampaignFormValues, CampaignFormValues } from '@/shared/schemas/campaign';

export const ADVERTISER_CAMPAIGN_STEPS = [
  { id: 'details', label: 'Details', hint: 'Campaign and brand name' },
  { id: 'vehicle', label: 'Vehicle wrap', hint: 'City, type and wrap size' },
  { id: 'plan', label: 'Plan', hint: 'Dates and target kilometres' },
  { id: 'locations', label: 'Locations', hint: 'Zones and vehicles' },
  { id: 'creative', label: 'Creative', hint: 'Artwork, then submit' },
] as const satisfies readonly FormStep[];

export const ADVERTISER_STEP_FIELDS: Record<
  (typeof ADVERTISER_CAMPAIGN_STEPS)[number]['id'],
  (keyof CampaignFormValues)[]
> = {
  details: ['name', 'brandName'],
  vehicle: ['city', 'vehicleType', 'adDimension'],
  plan: ['startDate', 'endDate', 'zonePrimeKm', 'zoneSecondaryKm'],
  locations: ['locations', 'requestedVehicleIds'],
  creative: [],
};

export const ADMIN_CAMPAIGN_STEPS = [
  { id: 'advertiser', label: 'Advertiser', hint: 'Who owns and pays' },
  { id: 'details', label: 'Details', hint: 'Campaign and brand name' },
  { id: 'vehicle', label: 'Vehicle wrap', hint: 'City, type and wrap size' },
  { id: 'plan', label: 'Plan', hint: 'Dates and target kilometres' },
  { id: 'locations', label: 'Locations', hint: 'Zones and vehicles' },
  { id: 'instruction', label: 'Instruction', hint: 'How they asked' },
] as const satisfies readonly FormStep[];

export const ADMIN_STEP_FIELDS: Record<
  (typeof ADMIN_CAMPAIGN_STEPS)[number]['id'],
  (keyof AdminCampaignFormValues)[]
> = {
  advertiser: ['advertiserId'],
  details: ['name', 'brandName'],
  vehicle: ['city', 'vehicleType', 'adDimension'],
  plan: ['startDate', 'endDate', 'zonePrimeKm', 'zoneSecondaryKm'],
  locations: ['locations', 'requestedVehicleIds'],
  instruction: ['instructionChannel', 'instructionReference', 'instructionDate'],
};
