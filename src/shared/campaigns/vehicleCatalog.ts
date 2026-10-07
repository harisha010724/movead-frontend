/**
 * Vehicle kinds and wrap sizes an advertiser can book.
 *
 * Types follow the Indian transit mix Wrap2Earn sells (auto, cab, bus, truck,
 * tempo). Cab wrap names follow the Wrapify / Firefly 180–270–360 standard.
 * Panel sizes are the usual production specs; a given make can differ by a few
 * inches, and operations still cuts to the vehicle.
 */

export const VEHICLE_TYPES = ['AUTO', 'CAB', 'BUS', 'TRUCK', 'TEMPO'] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export interface VehicleTypeOption {
  value: VehicleType;
  label: string;
}

export const VEHICLE_TYPE_OPTIONS: VehicleTypeOption[] = [
  { value: 'AUTO', label: 'Auto' },
  { value: 'CAB', label: 'Car / cab' },
  { value: 'BUS', label: 'Bus' },
  { value: 'TRUCK', label: 'Truck' },
  { value: 'TEMPO', label: 'Tempo / delivery van' },
];

export interface AdDimensionOption {
  value: string;
  label: string;
  hint: string;
}

export const AD_DIMENSIONS: Record<VehicleType, AdDimensionOption[]> = {
  AUTO: [
    { value: 'HOOD', label: 'Hood', hint: '24 × 18 in' },
    { value: 'REAR_HALF', label: 'Rear panel (half)', hint: '24 × 18 in' },
    { value: 'REAR_FULL', label: 'Rear panel (full)', hint: '36 × 24 in' },
    { value: 'SIDE_PANEL', label: 'Side panels', hint: '20 × 12 in' },
    { value: 'FULL_WRAP', label: 'Full wrap', hint: 'Hood, sides and rear' },
  ],
  CAB: [
    { value: 'WRAP_180', label: '180 — doors', hint: 'Driver and passenger doors' },
    { value: 'WRAP_270', label: '270 — doors + rear', hint: 'Doors, quarter panels and boot' },
    { value: 'WRAP_360', label: '360 — full body', hint: 'All body panels except the roof' },
    { value: 'REAR_WINDOW', label: 'Rear window', hint: 'Perforated rear glass' },
    { value: 'HOOD', label: 'Hood', hint: 'Bonnet only' },
  ],
  BUS: [
    { value: 'SIDE_PANEL', label: 'Side panel', hint: 'One long side' },
    { value: 'BACK_PANEL', label: 'Back panel', hint: 'Rear face' },
    { value: 'FULL_WRAP', label: 'Full wrap', hint: 'End-to-end exterior' },
  ],
  TRUCK: [
    { value: 'SIDE_PANEL', label: 'Side panel', hint: 'Cargo-box side' },
    { value: 'REAR_DOOR', label: 'Rear door', hint: 'Tailgate or shutter' },
    { value: 'FULL_WRAP', label: 'Full wrap', hint: 'Cab and cargo box' },
  ],
  TEMPO: [
    { value: 'SIDE_PANEL', label: 'Side panel', hint: '5 × 6 ft per side' },
    { value: 'REAR_DOOR', label: 'Rear door', hint: 'Back doors' },
    { value: 'FULL_WRAP', label: 'Full wrap', hint: 'Both sides and rear — about 60 sq ft' },
  ],
};

const LABELS = Object.fromEntries(VEHICLE_TYPE_OPTIONS.map((row) => [row.value, row.label])) as Record<
  VehicleType,
  string
>;

export function vehicleTypeLabel(type: string): string {
  return LABELS[type as VehicleType] ?? type;
}

export function adDimensionsFor(type: string): AdDimensionOption[] {
  return AD_DIMENSIONS[(type as VehicleType) || 'CAB'] ?? AD_DIMENSIONS.CAB;
}

export function defaultAdDimension(type: string): string {
  return adDimensionsFor(type)[0]?.value ?? 'FULL_WRAP';
}

export function isAdDimensionFor(type: string, dimension: string): boolean {
  return adDimensionsFor(type).some((row) => row.value === dimension);
}

export function adDimensionLabel(type: string, dimension: string | null | undefined): string {
  if (!dimension) return '';
  return adDimensionsFor(type).find((row) => row.value === dimension)?.label ?? dimension;
}
