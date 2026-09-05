/**
 * Domain vocabulary shared by both portals.
 *
 * These types mirror the backend contract. Once `npm run api:sync` has pulled a
 * real openapi.json, prefer the generated types in `../api/schema.d.ts` for
 * request and response shapes, and keep this file for the small set of
 * primitives the UI reasons about directly.
 */

/**
 * Money always arrives from the API as a decimal string, never a number.
 *
 * The backend stores amounts as NUMERIC and serialises them as strings so no
 * precision is lost in JSON. The branding exists to make it awkward to do
 * arithmetic here: the client formats money, it never calculates it. If you
 * need a total, add it to the API response.
 */
export type Money = string & { readonly __brand: 'Money' };

export const asMoney = (v: string): Money => v as Money;

/** Billable pricing tiers. `OUTSIDE` is recorded but never charged. */
export const ZONE_TIERS = ['PRIME', 'SECONDARY', 'NETWORK'] as const;
export type ZoneTier = (typeof ZONE_TIERS)[number];

export const SEGMENT_TIERS = [...ZONE_TIERS, 'OUTSIDE'] as const;
export type SegmentTier = (typeof SEGMENT_TIERS)[number];

export type CampaignStatus =
  | 'DRAFT'
  | 'PENDING_CONFIRMATION'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'AWAITING_INSTALLATION'
  | 'ACTIVE'
  | 'PAUSED'
  | 'BUDGET_WARNING'
  | 'STOPPED'
  | 'COMPLETED'
  | 'CANCELLED';

export type VehicleStatus =
  | 'PENDING'
  | 'DOCUMENTS_VERIFIED'
  | 'APPROVED'
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'INSTALLING'
  | 'ACTIVE'
  | 'SUSPENDED'
  /** Sent back for correction, and removed from the platform. Both are reachable
   * from the review screen, so both belong in the type the screen reads. */
  | 'REJECTED'
  | 'REMOVED';

/**
 * What a buyer can do with a vehicle right now, collapsed from the ten statuses
 * above. Computed by the server so the picker and the fleet browser cannot
 * disagree about what "booked" means.
 */
export type VehicleAvailability = 'available' | 'booked' | 'pending';

/** Live operating state, distinct from vehicle lifecycle status. */
export type LiveVehicleState = 'RUNNING' | 'IDLE' | 'OFFLINE' | 'GPS_PAUSED';

export type VehicleType = 'AUTO' | 'CAB';

export interface RateCard {
  advertiser: Record<ZoneTier, Money>;
  driver: Record<ZoneTier, Money>;
  effectiveFrom: string;
}

export interface ZoneBreakdown {
  prime: number;
  secondary: number;
  network: number;
}

export interface KmSummary extends ZoneBreakdown {
  total: number;
  rejected: number;
  pending: number;
}

export interface SpendBreakdown {
  prime: Money;
  secondary: Money;
  network: Money;
  total: Money;
}

export interface Campaign {
  id: string;
  name: string;
  brandName: string;
  status: CampaignStatus;
  city: string;
  vehicleType: VehicleType;
  startDate: string;
  endDate: string;
  budget: Money;
  spent: Money;
  remaining: Money;
  zonePrime?: Money;
  zoneSecondary?: Money;
  zoneNetwork?: Money;
  zonePrimeKm?: string;
  zoneSecondaryKm?: string;
  locations?: {
    id: string;
    placeId: string;
    label: string;
    lat: number;
    lng: number;
    tier: 'prime' | 'secondary' | 'network';
  }[];
  zonePolygons?: {
    prime?: { path: { lat: number; lng: number }[] };
    secondary?: { path: { lat: number; lng: number }[] };
  };
  requestedVehicleIds?: string[];
  targetKm?: string | null;
  creativeKey?: string | null;
  creativeFileName?: string | null;
  vehicleCount: number;
  verifiedKm: number;
  /** Reach estimate only — see the note on AdvertiserDashboard.impressions. */
  impressions: number;
}

export interface AdminCampaign extends Campaign {
  advertiser: { id: string; legalName: string; brandName: string };
  createdBy: string;
  submittedAt: string;
}

/**
 * Campaign-to-vehicle assignment and the installation hanging off it — AC-22
 * and AC-06. A vehicle only earns once its installation is APPROVED, which is
 * per vehicle rather than per campaign (AC-06.10).
 */
export const ASSIGNMENT_STATUSES = [
  'ASSIGNED',
  'ACCEPTED',
  'INSTALLING',
  'ACTIVE',
  'ENDED',
  'WITHDRAWN',
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const INSTALLATION_STATUSES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
] as const;
export type InstallationStatus = (typeof INSTALLATION_STATUSES)[number];

export const PHOTO_ANGLES = ['FRONT', 'REAR', 'LEFT', 'RIGHT'] as const;
export type PhotoAngle = (typeof PHOTO_ANGLES)[number];

export interface Assignment {
  id: string;
  campaignId: string;
  vehicleId: string;
  driverId: string;
  registrationNumber: string;
  driverName: string;
  vehicleCategory: string;
  status: AssignmentStatus;
  assignedAt: string;
  acceptedAt: string | null;
  activatedAt: string | null;
  /** Set when the vehicle failed a requirement and was assigned anyway (AC-22.3). */
  overrideReason: string | null;
  installation: {
    status: InstallationStatus;
    photoCount: number;
    requiredCount: number;
    rejectionReason: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
  } | null;
}

/** AC-22.8: required against assigned, installed and active. */
export interface AssignmentSummary {
  requested: number;
  assigned: number;
  accepted: number;
  installing: number;
  active: number;
}

export interface InstallationPhoto {
  id: string;
  angle: PhotoAngle;
  fileName: string;
  uploadedAt: string;
}

/**
 * What the driver sees. Identical to the mobile app's `Campaign` type, so the
 * phone and the web portal read one contract.
 */
/**
 * The signed-in driver, as `/v1/driver/me` returns them. Lowercase status,
 * like every other driver-facing enum — the admin's uppercase `DriverStatus`
 * is a different audience's view of the same column.
 */
export type DriverPortalStatus = 'pending' | 'documents_submitted' | 'approved' | 'suspended';

export interface DriverProfile {
  id: string;
  name: string;
  mobile: string;
  status: DriverPortalStatus;
  /** Why they are suspended or were rejected, verbatim. Null when there is nothing to explain. */
  statusReason: string | null;
  /** AC-05: driver and vehicle both approved. Badge on this, not on `status`. */
  canTrack: boolean;
  photoUrl: string | null;
  joinedAt: string;
  vehicle: { registrationNumber: string; category: 'CAB' | 'AUTO'; makeModel: string } | null;
}

export type DocumentKind = 'RC' | 'LICENCE' | 'INSURANCE' | 'POLLUTION' | 'PERMIT' | 'OTHER';

/**
 * `missing`, `expiring` and `expired` are computed server-side rather than
 * stored — the first is the absence of a row, the others a date comparison.
 */
export type DocumentChecklistStatus =
  | 'missing'
  | 'uploaded'
  | 'verified'
  | 'rejected'
  | 'expiring'
  | 'expired';

export interface DocumentChecklistItem {
  kind: DocumentKind;
  isMandatory: boolean;
  status: DocumentChecklistStatus;
  /** Null while the document is `missing`; there is nothing to fetch or decide on. */
  documentId: string | null;
  expiresOn: string | null;
  rejectionReason: string | null;
  /** Decides between an image and a PDF frame without fetching the bytes first. */
  contentType: string | null;
  uploadedAt: string | null;
}

export interface AdminVehicle {
  id: string;
  driverId: string;
  registrationNumber: string;
  category: VehicleType;
  bodyType: string | null;
  makeModel: string | null;
  colour: string | null;
  manufactureYear: number | null;
  fuelType: string | null;
  imageKey: string | null;
  /** Derived from `imageKey`. The key is an object-store path and no use to an `<img>`. */
  imageUrl: string | null;
  status: VehicleStatus;
  rejectionReason: string | null;
  suspendedReason: string | null;
}

/** `/v1/admin/drivers/:id` — the driver, their vehicles, and both checklists. */
export interface AdminDriverDetail {
  driver: {
    id: string;
    mobile: string;
    name: string;
    photoKey: string | null;
    status: 'PENDING' | 'DOCUMENTS_SUBMITTED' | 'APPROVED' | 'SUSPENDED';
    suspendedReason: string | null;
    rejectionReason: string | null;
    joinedAt: string;
    city: string;
    location: { city: string; label: string; lat: number; lng: number } | null;
  };
  vehicles: AdminVehicle[];
  driverDocuments: DocumentChecklistItem[];
  /** Keyed by vehicle id, because papers belong to a plate and not to a person. */
  vehicleDocuments: Record<string, DocumentChecklistItem[]>;
}

export type DriverCampaignStatus =
  /** An advertiser has picked this vehicle; operations has not confirmed it (AC-22.4). */
  | 'requested'
  | 'assigned'
  | 'installation_pending'
  | 'active'
  | 'paused'
  | 'completed';

export interface DriverCampaign {
  id: string;
  /** Null while `status` is `requested` — there is no assignment to accept. */
  assignmentId: string | null;
  name: string;
  brandName: string;
  logoUrl: string | null;
  creativeUrl: string | null;
  status: DriverCampaignStatus;
  startDate: string;
  endDate: string;
  vehicleId: string;
  vehicleRegistration: string;
  rateCard: { model: 'zoned'; zones: { zone: string; label: string; ratePerKm: Money }[] };
  payoutType: 'per_km';
  minMonthlyTargetKm: number;
  expectedMonthlyEarning: Money;
  elapsedDays: number;
  totalDays: number;
  daysLeft: number;
  achievedKm: number;
  terms: string[];
  areas: { id: string; name: string; zone: string; polygon: { lat: number; lng: number }[] }[];
  installation: {
    status: InstallationStatus;
    scheduledFor: string | null;
    rejectionReason: string | null;
  } | null;
}

export interface EligibilityCheck {
  id: string;
  label: string;
  passed: boolean;
  /** What to do next; null when the check passes. */
  remedy: string | null;
}

export interface LivePosition {
  vehicleRef: string;
  lat: number;
  lon: number;
  state: LiveVehicleState;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
