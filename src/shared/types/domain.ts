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

export type VehicleType = 'AUTO' | 'CAB' | 'BUS' | 'TRUCK' | 'TEMPO';

export interface RateCard {
  advertiser: Record<ZoneTier, Money>;
  driver: Record<ZoneTier, Money>;
  effectiveFrom: string;
}

/** Per-advertiser ₹/km card operations set. Used on create and estimate. */
export interface AdvertiserRateCard {
  prime: Money;
  secondary: Money;
  network: Money;
  driver: { prime: Money; secondary: Money; network: Money };
  source: 'default' | 'custom';
  effectiveFrom: string | null;
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
  adDimension?: string | null;
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
  /** Advertiser ₹/km snapshotted when this campaign was created. */
  rateCard?: { prime: Money; secondary: Money; network: Money };
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

export const BRANDING_ANGLES = [...PHOTO_ANGLES, 'AD_CLOSEUP'] as const;
export type BrandingAngle = (typeof BRANDING_ANGLES)[number];

export const BRANDING_PROOF_STATUSES = [
  'REQUESTED',
  'IN_PROGRESS',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
] as const;
export type BrandingProofStatus = (typeof BRANDING_PROOF_STATUSES)[number];

export interface BrandingProofPhoto {
  id: string;
  angle: BrandingAngle;
  fileName: string;
  lat: number;
  lon: number;
  capturedAt: string;
  uploadedAt: string;
}

export interface BrandingProof {
  id: string;
  assignmentId: string;
  campaignId: string;
  campaignName: string;
  registrationNumber: string;
  driverName: string;
  vehicleCategory: string;
  status: BrandingProofStatus;
  dueAt: string;
  requestedAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  photoCount: number;
  required: BrandingAngle[];
  uploaded: BrandingAngle[];
  photos: BrandingProofPhoto[];
}

export interface BrandingProofEligible {
  assignmentId: string;
  campaignId: string;
  campaignName: string;
  registrationNumber: string;
  driverName: string;
}

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
  vehicle: { registrationNumber: string; category: string; makeModel: string } | null;
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

// --- GPS audit (AC-25) ---------------------------------------------------

export type TripStatus = 'verified' | 'pending_review' | 'rejected';
export type SegmentState = 'BILLABLE' | 'PENDING_REVIEW' | 'NON_BILLABLE';

/** Lowercase on the wire, unlike `ZoneTier`, which is how the badge wants it. */
export type ZoneKey = 'prime' | 'secondary' | 'network';

/**
 * One drive, not one shift.
 *
 * A tracking session runs from the driver's press of Start to their press of
 * Stop and can hold a whole morning; the server cuts it at the stops in it, so
 * a trip here is a journey between two of them. `id` names the drive and is
 * what the trip detail endpoint takes.
 */
export interface AuditTrip {
  id: string;
  sequence: number;
  startedAt: string;
  endedAt: string;
  verifiedKm: number;
  earnings: Money;
  status: TripStatus;
  /**
   * How long the vehicle stood still before this drive. Null when it opened a
   * shift, where the hours before it were the driver's own time.
   */
  idleSecondsBefore: number | null;
  zoneBreakdown: { zone: ZoneKey; km: number; earnings: Money }[] | null;
}

export interface AuditDay {
  vehicle: { id: string; registrationNumber: string };
  date: string;
  totalVerifiedKm: number;
  totalEarnings: Money;
  totalCharge: Money;
  trips: AuditTrip[];
}

/**
 * A stretch of one journey that the pricing pipeline treated as a single
 * fact: same zone, same state, same reason. Consecutive GPS pairs agreeing on
 * all three arrive merged, so the count is in `segments` rather than in rows.
 */
export interface TripLeg {
  zone: ZoneKey;
  state: SegmentState;
  flagReason: string | null;
  startedAt: string;
  endedAt: string;
  distanceKm: number;
  advertiserRate: Money;
  driverRate: Money;
  advertiserCharge: Money;
  driverEarning: Money;
  segments: number;
  path: { lat: number; lng: number }[];
}

export interface TripDetail {
  id: string;
  vehicleRegistration: string;
  campaignName: string;
  driverName: string;
  startedAt: string;
  endedAt: string | null;
  distanceKm: number;
  advertiserCharge: Money;
  driverEarning: Money;
  legs: TripLeg[];
}

/**
 * One drive recorded while carrying an advertiser's campaign.
 *
 * Driver money is not here. Names are, so the advertiser can pick whose trips
 * to open — the same names the vehicles table already shows.
 */
export interface CampaignDriver {
  id: string;
  name: string;
}

export interface CampaignRosterDriver {
  id: string;
  name: string;
  vehicleRegistration: string | null;
  area: string | null;
  verifiedKm: number;
  state: LiveVehicleState | null;
}

export interface CampaignRoster {
  drivers: CampaignRosterDriver[];
  total: number;
  limit: number;
  offset: number;
}

export interface CampaignTrip {
  id: string;
  vehicleRegistration: string;
  startedAt: string;
  endedAt: string;
  verifiedKm: number;
  charge: Money;
  status: TripStatus;
  idleSecondsBefore: number | null;
  /** Modelled opportunities-to-see on the billed hops. Not a people count. */
  impressions: number;
}

export interface CampaignTripStatusCounts {
  all: number;
  verified: number;
  pending_review: number;
  rejected: number;
}

export interface CampaignTrips {
  drivers: CampaignDriver[];
  trips: CampaignTrip[];
  total: number;
  limit: number;
  offset: number;
  statusCounts: CampaignTripStatusCounts;
  nextBefore: string | null;
}

/** How readable the wrap was on a stretch, from GPS speed. Not a billing input. */
export type VisibilityBand = 'high' | 'medium' | 'low';

/** The priced ground under a campaign trip, without the driver's side of it. */
export interface CampaignTripLeg {
  zone: ZoneKey;
  state: SegmentState;
  flagReason: string | null;
  startedAt: string;
  endedAt: string;
  distanceKm: number;
  advertiserRate: Money;
  advertiserCharge: Money;
  segments: number;
  visibility: VisibilityBand | null;
  path: { lat: number; lng: number }[];
}

/** Where readable driving sat still. Junction until a map feature names it. */
export type VisibilityPlaceKind = 'signal' | 'mall' | 'transit' | 'residential' | 'junction';

export const VISIBILITY_PLACE_LABEL: Record<VisibilityPlaceKind, string> = {
  signal: 'Traffic signal',
  mall: 'Mall / retail',
  transit: 'Transit',
  residential: 'Residential',
  junction: 'Junction',
};

export interface VisibilityPlace {
  kind: VisibilityPlaceKind;
  name: string;
  lat: number;
  lng: number;
  km: number;
  seconds: number;
  visits: number;
  source: 'gps' | 'osm';
}

export interface VisibilityKindTotal {
  kind: VisibilityPlaceKind;
  km: number;
  count: number;
}

/**
 * A campaign's billable kilometres, banded by how readable the wrap was.
 *
 * `classifiedKm` can be smaller than the campaign's verified kilometres:
 * parked and near-zero stretches are omitted so a night in a depot cannot
 * become high visibility. Nothing here multiplies a charge.
 */
export type VisibilityDaypart = 'morning' | 'midday' | 'evening' | 'night';

export interface CampaignDayparts {
  version: string;
  morningKm: number;
  middayKm: number;
  eveningKm: number;
  nightKm: number;
  readableKm: number;
  peakShare: number;
  windows: Record<VisibilityDaypart, string>;
}

export interface CampaignVisibility {
  campaignId: string;
  version: string;
  highKm: number;
  mediumKm: number;
  lowKm: number;
  classifiedKm: number;
  highShare: number;
  bands: { high: string; medium: string; low: string };
  places: VisibilityPlace[];
  byKind: VisibilityKindTotal[];
  when: CampaignDayparts;
}

export interface CampaignTripDetail {
  id: string;
  vehicleRegistration: string;
  startedAt: string;
  endedAt: string | null;
  distanceKm: number;
  advertiserCharge: Money;
  status: TripStatus;
  legs: CampaignTripLeg[];
  places: VisibilityPlace[];
  parked: CampaignParked | null;
}

export interface CampaignParked {
  seconds: number;
  lat: number;
  lng: number;
}

// --- Impressions ---------------------------------------------------------

/**
 * A campaign's driving, expressed as an audience.
 *
 * Every shape here is advertiser-scoped and carries no driver identity and no
 * driver earning — the admin audit of the same segments carries both, which is
 * why it sits behind its own permission. Keep the two apart: a field added
 * here that names a driver undoes that separation silently.
 *
 * `verifiedKm` is GPS-provable and is what the contract is denominated in.
 * `impressions` is the media translation of it and is a model output, which is
 * why `modelVersion` and `baselineMix` travel with it everywhere. A modelled
 * figure shown without either is indistinguishable from an invented one.
 */
export interface ZoneImpressions {
  zone: ZoneKey;
  verifiedKm: number;
  impressions: number;
  charge: Money;
}

export interface DayImpressions {
  date: string;
  verifiedKm: number;
  impressions: number;
}

/** Shares of the impressions, summing to one. */
export interface BaselineMix {
  /** Rests on measurement of that road in that hour of the week. */
  cellHour: number;
  /** Rests on measurement of that road across the whole week. */
  cell: number;
  /** Rests on a flat per-zone assumption, because the road is barely driven. */
  zoneDefault: number;
}

export interface ImpressionTotals {
  modelVersion: string;
  verifiedKm: number;
  impressions: number;
  charge: Money;
  /** Cost per thousand — the figure that compares to other media. */
  cpm: Money;
  byZone: ZoneImpressions[];
  /** Oldest first. Days with no billable driving are absent, not zeroed. */
  byDay: DayImpressions[];
  baselineMix: BaselineMix;
}

export interface CampaignImpressions extends ImpressionTotals {
  campaignId: string;
  campaignName: string;
}

/** Every coefficient the model multiplied, so the arithmetic can be repeated. */
export interface ImpressionWorking {
  jamDensity: number;
  occupantsPerVehicle: number;
  lineOfSightShare: number;
  wrapQuality: number;
  zones: { zone: ZoneKey; lanes: number; pedestrianDensity: number }[];
  /** Null on a day whose segments have not been priced into impressions yet. */
  medianObservedKmh: number | null;
  medianBaselineKmh: number | null;
}

export interface CampaignDayImpressions extends ImpressionTotals {
  campaignId: string;
  date: string;
  working: ImpressionWorking;
}

export type ReportType =
  | 'proof-pack'
  | 'billing-statement'
  | 'zone-summary'
  | 'vehicle-summary'
  | 'km-detail';

export type ReportFormat = 'html' | 'csv';

export interface ReportExport {
  id: string;
  type: ReportType;
  format: ReportFormat;
  campaignId: string;
  campaignName: string;
  from: string;
  to: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  checksum: string;
  generatedAt: string;
  expiresAt: string;
  status: 'ready';
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
