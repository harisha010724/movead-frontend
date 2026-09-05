/**
 * Canned responses used when VITE_USE_MOCK_API=true.
 *
 * Every figure reconciles the way the real engine must: zone distances sum to
 * verified distance, and zone spend equals distance × the ₹5 / ₹2 / ₹1 rates.
 * Treat these as a worked example of the API contract rather than decoration —
 * if a change here stops reconciling, the same change would be a defect in
 * production.
 */

import { zoneForPoint } from '@/shared/maps/geo';
import { asMoney, type DriverCampaign, type DriverProfile } from '@/shared/types/domain';

/**
 * `GET /v1/auth/me`, mocked. The field names are the API's, `audience` included
 * — a fixture that quietly used the client's vocabulary would hide a mapping
 * bug until the mock was switched off.
 */
export const mockUser = {
  id: '11111111-1111-4111-8111-111111111111',
  fullName: 'Priya Menon',
  email: 'priya@abcadvertising.in',
  status: 'ACTIVE' as const,
  audience: 'advertiser' as const,
  advertiserId: '22222222-2222-4222-8222-222222222222',
  driverId: null,
  organisationName: 'ABC Advertising',
  roles: ['ADVERTISER'],
  permissions: [
    'advertiser.campaign.read',
    'advertiser.campaign.create',
    'advertiser.campaign.confirm',
    'advertiser.vehicle.read',
    'advertiser.vehicle.select',
    'advertiser.order.place',
    'advertiser.tracking.read',
    'advertiser.report.read',
    'advertiser.wallet.read',
    'advertiser.wallet.topup',
  ],
  mfaEnabled: false,
  lastLoginAt: '2026-08-19T09:14:00+05:30',
};

export const mockAdminUser = {
  id: '33333333-3333-4333-8333-333333333333',
  fullName: 'Rahul Iyer',
  email: 'rahul@movead.in',
  status: 'ACTIVE' as const,
  audience: 'admin' as const,
  advertiserId: null,
  driverId: null,
  organisationName: 'MoveAd Operations',
  roles: ['SUPER_ADMIN'],
  // Single Super Admin role for MVP: every permission granted, but still
  // checked by name so roles can be added later without touching every guard.
  permissions: ['*'],
  mfaEnabled: true,
  lastLoginAt: '2026-08-19T09:14:00+05:30',
};

/** Same fixture driver the mobile app reviews against. */
export const mockDriverUser = {
  id: '44444444-4444-4444-8444-444444444444',
  fullName: 'Rahul Kumar',
  email: 'rahul.kumar@example.com',
  status: 'ACTIVE' as const,
  audience: 'driver' as const,
  advertiserId: null,
  driverId: 'drv_8f21',
  organisationName: 'Rahul Kumar',
  roles: ['DRIVER'],
  permissions: [],
  mfaEnabled: false,
  lastLoginAt: '2026-08-19T09:14:00+05:30',
};

export const mockDriverProfile: DriverProfile = {
  id: 'drv_8f21',
  name: 'Rahul Kumar',
  mobile: '9876543210',
  status: 'approved',
  statusReason: null,
  canTrack: true,
  photoUrl: null,
  joinedAt: '2026-04-27T09:00:00.000Z',
  vehicle: {
    registrationNumber: 'KA01AB1234',
    category: 'CAB',
    makeModel: 'Hyundai Verna',
  },
};

export const mockDriverEarnings = {
  availableBalance: '248.60',
  pendingBalance: '82.40',
  monthVerifiedKm: 1248,
  monthEarnings: '1248.00',
  todayVerifiedKm: 82.4,
  todayEarnings: '82.40',
  history: [
    { date: '2026-08-23', verifiedKm: 82.4, earnings: '82.40' },
    { date: '2026-08-22', verifiedKm: 76.2, earnings: '76.20' },
    { date: '2026-08-21', verifiedKm: 91.1, earnings: '91.10' },
    { date: '2026-08-20', verifiedKm: 66.7, earnings: '66.70' },
    { date: '2026-08-19', verifiedKm: 74.3, earnings: '74.30' },
  ],
};

/**
 * Typed against `DriverCampaign` deliberately. This fixture had drifted into a
 * shape the screen could not render — uppercase status, a flat `ratePerKm`, no
 * `assignmentId` — and went unnoticed because the driver portal bypasses the
 * mock. Annotating it makes the compiler the thing that notices next time.
 */
export const mockDriverCampaign: DriverCampaign = {
  id: '5b1f9c2e-3d4a-4c1b-9f2e-7a6b5c4d3e2f',
  assignmentId: 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  name: 'ABC Smartphone',
  brandName: 'ABC Electronics',
  logoUrl: null,
  creativeUrl: null,
  status: 'active',
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  vehicleId: 'c3d4e5f6-7a8b-4c9d-8e1f-2a3b4c5d6e7f',
  vehicleRegistration: 'KA01AB1234',
  rateCard: {
    model: 'zoned',
    zones: [
      { zone: 'prime', label: 'Prime', ratePerKm: asMoney('3.00') },
      { zone: 'secondary', label: 'Secondary', ratePerKm: asMoney('1.20') },
      { zone: 'network', label: 'Network', ratePerKm: asMoney('0.60') },
    ],
  },
  payoutType: 'per_km',
  minMonthlyTargetKm: 1500,
  expectedMonthlyEarning: asMoney('1800.00'),
  elapsedDays: 12,
  totalDays: 30,
  daysLeft: 18,
  achievedKm: 1248,
  terms: [
    'Keep the advertisement visible and clean',
    'Do not remove or damage the wrap',
    'Drive within the campaign areas to earn the higher rate',
    'Follow all traffic rules',
  ],
  areas: [],
  installation: { status: 'APPROVED', scheduledFor: null, rejectionReason: null },
};

export const mockDriverEligibility = {
  eligible: true,
  checks: [
    { id: 'vehicle_approved', label: 'Vehicle approved', passed: true },
    { id: 'campaign_assigned', label: 'Campaign assigned', passed: true },
    { id: 'ad_installed', label: 'Advertisement installed', passed: true },
    { id: 'installation_verified', label: 'Installation verified', passed: true },
    { id: 'campaign_active', label: 'Campaign active', passed: true },
  ],
};

/* ------------------------------------------------------------------ *
 * Campaign totals
 *
 * 37,284 + 46,605 + 102,531 = 186,420 verified km
 * 37,284 × ₹5 + 46,605 × ₹2 + 102,531 × ₹1 = ₹3,82,161
 * ------------------------------------------------------------------ */

const VERIFIED_KM = { prime: 37_284, secondary: 46_605, network: 102_531 };
const TOTAL_VERIFIED_KM = VERIFIED_KM.prime + VERIFIED_KM.secondary + VERIFIED_KM.network;
const TOTAL_IMPRESSIONS = 4_820_000;

export const mockCampaigns = [
  {
    id: 'cmp_01',
    name: 'ABC Summer Sale',
    brandName: 'ABC Retail',
    status: 'ACTIVE',
    city: 'Bengaluru',
    vehicleType: 'CAB',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    budget: '500000.0000',
    spent: '382161.0000',
    remaining: '117839.0000',
    vehicleCount: 245,
    verifiedKm: TOTAL_VERIFIED_KM,
    impressions: TOTAL_IMPRESSIONS,
  },
  {
    id: 'cmp_02',
    name: 'Swiggy Monsoon Push',
    brandName: 'Swiggy',
    status: 'AWAITING_INSTALLATION',
    city: 'Bengaluru',
    vehicleType: 'AUTO',
    startDate: '2026-09-01',
    endDate: '2026-10-15',
    budget: '250000.0000',
    spent: '0.0000',
    remaining: '250000.0000',
    vehicleCount: 40,
    verifiedKm: 0,
    impressions: 0,
  },
  {
    id: 'cmp_03',
    name: 'Cred Diwali',
    brandName: 'CRED',
    status: 'PENDING_APPROVAL',
    city: 'Bengaluru',
    vehicleType: 'CAB',
    startDate: '2026-10-10',
    endDate: '2026-11-10',
    budget: '500000.0000',
    spent: '0.0000',
    remaining: '500000.0000',
    vehicleCount: 0,
    verifiedKm: 0,
    impressions: 0,
  },
];

/** Deterministic series so screenshots and tests do not change run to run. */
function shapedSeries(total: number, weights: number[]): number[] {
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => Math.round((w / weightSum) * total));
  const drift = total - raw.reduce((a, b) => a + b, 0);
  return raw.map((v, i) => (i === 0 ? v + drift : v));
}

const DAY_WEIGHTS = [
  62, 68, 74, 71, 66, 58, 54, 70, 79, 86, 92, 88, 74, 63, 81, 97, 104, 99, 88, 76, 68, 84, 91,
  96, 102, 94, 82, 71, 78, 85, 90,
];

export const mockImpressionsDaily = shapedSeries(TOTAL_IMPRESSIONS, DAY_WEIGHTS).map(
  (value, i) => ({
    label: `${String(i + 1).padStart(2, '0')} Aug`,
    value,
  }),
);

/** Two commute peaks, a midday plateau and a quiet overnight period. */
const HOUR_WEIGHTS = [
  8, 5, 3, 3, 4, 9, 22, 46, 78, 92, 88, 80, 84, 82, 76, 74, 82, 96, 104, 88, 66, 44, 28, 16,
];

export const mockImpressionsHourly = shapedSeries(TOTAL_IMPRESSIONS, HOUR_WEIGHTS).map(
  (value, hour) => ({
    label:
      hour === 0
        ? '12 AM'
        : hour < 12
          ? `${hour} AM`
          : hour === 12
            ? '12 PM'
            : `${hour - 12} PM`,
    value,
  }),
);

export const mockAdvertiserDashboard = {
  campaignId: 'cmp_01',
  km: {
    total: 190_150,
    ...VERIFIED_KM,
    rejected: 3_730,
    pending: 0,
  },
  spend: {
    prime: '186420.0000',
    secondary: '93210.0000',
    network: '102531.0000',
    total: '382161.0000',
  },
  budget: '500000.0000',
  remaining: '117839.0000',
  activeVehicles: 245,
  costPerKm: '2.0500',
  /*
   * Impressions are shown because the approved design leads with them, but the
   * MVP acceptance criteria do not yet define how one is counted. Until that
   * definition exists this is a reach estimate, not a billable quantity —
   * nothing in the pricing path may depend on it.
   */
  impressions: TOTAL_IMPRESSIONS,
  costPerThousandImpressions: '79.2865',
  comparison: {
    impressions: 0.186,
    verifiedKm: 0.163,
    spend: 0.163,
    activeVehicles: 0.087,
    costPerThousandImpressions: -0.052,
  },
  rates: {
    advertiser: { PRIME: '5.0000', SECONDARY: '2.0000', NETWORK: '1.0000' },
    driver: { PRIME: '3.0000', SECONDARY: '1.2000', NETWORK: '0.6000' },
    effectiveFrom: '2026-08-01T00:00:00+05:30',
  },
  impressionsDaily: mockImpressionsDaily,
  impressionsHourly: mockImpressionsHourly,
  impressionsByArea: [
    { label: 'Whitefield', value: 1_280_000 },
    { label: 'Marathahalli', value: 1_120_000 },
    { label: 'Koramangala', value: 920_000 },
    { label: 'Indiranagar', value: 760_000 },
    { label: 'Electronic City', value: 460_000 },
    { label: 'Others', value: 280_000 },
  ],
  impressionsByVehicleType: [
    { label: 'Cabs', value: 3_210_000 },
    { label: 'Autos', value: 1_120_000 },
    { label: 'Bikes', value: 490_000 },
  ],
  vehicleStatus: [
    { state: 'RUNNING' as const, count: 198 },
    { state: 'IDLE' as const, count: 32 },
    { state: 'OFFLINE' as const, count: 15 },
  ],
  /*
   * Driver names appear because the approved design shows them. This conflicts
   * with ADV-039, which requires advertisers to see anonymised vehicle
   * references only. Resolve the conflict before this reaches production data.
   */
  topVehicles: [
    {
      vehicleNumber: 'KA01AB1234',
      driverName: 'Ramesh Babu',
      area: 'Whitefield',
      km: 1345,
      zoneKm: { prime: 269, secondary: 336, network: 740 },
      impressions: 32_450,
      spend: '2757.0000',
      state: 'RUNNING' as const,
    },
    {
      vehicleNumber: 'KA03CD5678',
      driverName: 'Suresh Yadav',
      area: 'Marathahalli',
      km: 1120,
      zoneKm: { prime: 224, secondary: 280, network: 616 },
      impressions: 28_980,
      spend: '2296.0000',
      state: 'RUNNING' as const,
    },
    {
      vehicleNumber: 'KA02EF9012',
      driverName: 'Manoj Singh',
      area: 'Koramangala',
      km: 1045,
      zoneKm: { prime: 209, secondary: 261, network: 575 },
      impressions: 26_735,
      spend: '2142.0000',
      state: 'RUNNING' as const,
    },
    {
      vehicleNumber: 'KA04GH3456',
      driverName: 'Vijay Kumar',
      area: 'Indiranagar',
      km: 980,
      zoneKm: { prime: 196, secondary: 245, network: 539 },
      impressions: 24_890,
      spend: '2009.0000',
      state: 'IDLE' as const,
    },
    {
      vehicleNumber: 'KA05IJ7890',
      driverName: 'Arun N',
      area: 'Electronic City',
      km: 875,
      zoneKm: { prime: 175, secondary: 219, network: 481 },
      impressions: 22_140,
      spend: '1794.0000',
      state: 'RUNNING' as const,
    },
  ],
  alerts: [
    {
      id: 'alt_1',
      severity: 'info' as const,
      message: 'Vehicle KA01AB1234 entered target area',
      occurredAt: '2026-08-19T04:11:00Z',
    },
    {
      id: 'alt_2',
      severity: 'warning' as const,
      message: 'Vehicle KA03CD5678 went idle for more than 30 mins',
      occurredAt: '2026-08-19T03:45:00Z',
    },
    {
      id: 'alt_3',
      severity: 'critical' as const,
      message: 'Vehicle KA02EF9012 is offline',
      occurredAt: '2026-08-19T03:22:00Z',
    },
  ],
};

/* ------------------------------------------------------------------ *
 * Admin
 *
 * 5,230 × ₹5 + 9,110 × ₹2 + 13,420 × ₹1 = ₹57,790 revenue.
 * Driver liability is 60% of that, so the spread is ₹23,116.
 * ------------------------------------------------------------------ */

export const mockAdminDashboard = {
  supply: {
    registeredDrivers: 250,
    approvedDrivers: 180,
    activeCampaigns: 95,
    currentlyTracking: 72,
  },
  inventoryToday: {
    total: 28_420,
    prime: 5_230,
    secondary: 9_110,
    network: 13_420,
    rejected: 660,
    pending: 0,
  },
  moneyToday: {
    advertiserRevenue: '57790.0000',
    driverLiability: '34674.0000',
    grossSpread: '23116.0000',
  },
  queues: {
    documentsPending: 14,
    installationsPending: 6,
    kmFlagged: 23,
    payoutsAwaitingRelease: 1,
  },
  revenueDaily: shapedSeries(1_624_000, DAY_WEIGHTS.slice(0, 30)).map((value, i) => ({
    label: `${String(i + 1).padStart(2, '0')} Aug`,
    value,
  })),
  vehicleStatus: [
    { state: 'RUNNING' as const, count: 72 },
    { state: 'IDLE' as const, count: 46 },
    { state: 'OFFLINE' as const, count: 62 },
  ],
};

export const mockLivePositions = Array.from({ length: 24 }, (_, i) => ({
  vehicleRef: `VH-${String(1001 + i)}`,
  lat: 12.9716 + ((i % 7) - 3) * 0.018,
  lon: 77.5946 + ((i % 5) - 2) * 0.022,
  state: (['RUNNING', 'RUNNING', 'RUNNING', 'IDLE', 'OFFLINE', 'GPS_PAUSED'] as const)[i % 6],
  updatedAt: new Date(Date.now() - i * 9_000).toISOString(),
}));

export const mockVehicles = Array.from({ length: 12 }, (_, i) => ({
  id: `veh_${i + 1}`,
  vehicleRef: `VH-${String(1001 + i)}`,
  vehicleType: i % 3 === 0 ? 'AUTO' : 'CAB',
  primaryArea: ['Whitefield', 'Koramangala', 'Indiranagar', 'HSR Layout'][i % 4],
  avgKmPerDay: 96 + ((i * 7) % 40),
  zoneMix: { prime: 0.2, secondary: 0.25, network: 0.55 },
  status: 'ACTIVE',
}));

/** The onboarding queue's row, matching `DriverListItem` on the real API. */
export interface MockDriver {
  id: string;
  name: string;
  mobile: string;
  status: 'PENDING' | 'DOCUMENTS_SUBMITTED' | 'APPROVED' | 'SUSPENDED';
  photoKey: string | null;
  joinedAt: string;
  deletedReason?: string;
  city: string;
  location: {
    city: string;
    label: string;
    lat: number;
    lng: number;
  } | null;
  vehicle: {
    id: string;
    registrationNumber: string;
    category: 'AUTO' | 'CAB';
    status: string;
  } | null;
}

const AREA_PINS = [
  { label: 'MG Road, Bengaluru', lat: 12.9756, lng: 77.6069 },
  { label: 'Koramangala, Bengaluru', lat: 12.9352, lng: 77.6245 },
  { label: 'Whitefield, Bengaluru', lat: 12.9698, lng: 77.7499 },
  { label: 'Indiranagar, Bengaluru', lat: 12.9784, lng: 77.6408 },
  { label: 'HSR Layout, Bengaluru', lat: 12.9121, lng: 77.6446 },
] as const;

export const mockDrivers: MockDriver[] = Array.from({ length: 10 }, (_, i) => {
  const pin = AREA_PINS[i % AREA_PINS.length] ?? AREA_PINS[0];
  return {
    id: `drv_${i + 1}`,
    name: ['Ramesh Babu', 'Suresh Yadav', 'Manoj Singh', 'Vijay Kumar', 'Arun N'][i % 5] ?? '',
    mobile: `98${String(40000000 + i * 137)}`,
    status:
      (['PENDING', 'DOCUMENTS_SUBMITTED', 'APPROVED', 'SUSPENDED'] as const)[i % 4] ?? 'PENDING',
    photoKey: null,
    joinedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
    city: 'Bengaluru',
    location: pin ? { city: 'Bengaluru', ...pin } : null,
    vehicle: {
      id: `veh_drv_${i + 1}`,
      registrationNumber: `KA01AB${1000 + i}`,
      category: i % 3 === 0 ? 'AUTO' : 'CAB',
      status: i % 4 === 2 ? 'APPROVED' : 'PENDING',
    },
  };
});

/**
 * Newly onboarded drivers, prepended to the list so the write is visible in the
 * table straight away. In-memory only: a reload starts from the fixtures again.
 *
 * Returns the `{ driver, vehicle }` pair the real endpoint returns, because the
 * two are created in one transaction there.
 */
export function addMockDriver(input: {
  name: string;
  mobile: string;
  location?: { city?: string; label: string; lat: number; lng: number };
  vehicle?: { registrationNumber: string; category: 'AUTO' | 'CAB' } | null;
}): { driver: Omit<MockDriver, 'vehicle'>; vehicle: MockDriver['vehicle'] } {
  const id = `drv_${mockDrivers.length + 1}`;
  const vehicle = input.vehicle
    ? {
        id: `veh_${id}`,
        registrationNumber: input.vehicle.registrationNumber,
        category: input.vehicle.category,
        status: 'PENDING',
      }
    : null;

  const driver: MockDriver = {
    id,
    name: input.name,
    mobile: input.mobile,
    // AC-04.7: a new driver is always Pending and cannot receive campaigns.
    status: 'PENDING',
    photoKey: null,
    joinedAt: new Date().toISOString(),
    city: input.location?.city ?? 'Bengaluru',
    location: input.location
      ? {
          city: input.location.city ?? 'Bengaluru',
          label: input.location.label,
          lat: input.location.lat,
          lng: input.location.lng,
        }
      : null,
    vehicle,
  };
  mockDrivers.unshift(driver);

  const { vehicle: _vehicle, ...rest } = driver;
  return { driver: rest, vehicle };
}

export const hasMockRegistration = (registrationNumber: string) =>
  mockDrivers.some((d) => d.vehicle?.registrationNumber === registrationNumber);

export const hasMockMobile = (mobile: string) => mockDrivers.some((d) => d.mobile === mobile);

export function vehiclesInZones(
  input: unknown,
  revealIdentity: boolean,
): {
  items: {
    id: string;
    vehicleType: 'AUTO' | 'CAB';
    publicRef: string;
    registrationNumber: string;
    areaLabel: string;
    lat: number;
    lng: number;
    zone: 'prime' | 'secondary';
    status: string;
    availability: 'available' | 'booked' | 'pending';
    bookedUntil?: string;
    driverName?: string;
  }[];
  primeCount: number;
  secondaryCount: number;
  availableCount: number;
} {
  const body = input as {
    vehicleType?: 'AUTO' | 'CAB';
    zonePolygons?: Parameters<typeof zoneForPoint>[1];
  };
  const items = mockDrivers
    .filter((driver) => driver.status !== 'SUSPENDED' && driver.vehicle && driver.location)
    .filter((driver) => driver.vehicle?.category === (body.vehicleType ?? 'CAB'))
    .map((driver) => {
      const pin = driver.location;
      const vehicle = driver.vehicle;
      if (!pin || !vehicle) return null;
      const zone = zoneForPoint(pin, body.zonePolygons ?? {});
      if (!zone) return null;
      const availability = mockAvailability(vehicle.status);
      return {
        id: vehicle.id,
        vehicleType: vehicle.category,
        publicRef: `VH-${vehicle.id.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase()}`,
        registrationNumber: vehicle.registrationNumber,
        areaLabel: pin.label,
        lat: pin.lat,
        lng: pin.lng,
        zone,
        status: vehicle.status,
        availability,
        ...(availability === 'booked' ? { bookedUntil: mockBookedUntil(vehicle.id) } : {}),
        // The vehicle is named to everyone; the driver only to an operator.
        ...(revealIdentity ? { driverName: driver.name } : {}),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return {
    items,
    primeCount: items.filter((row) => row.zone === 'prime').length,
    secondaryCount: items.filter((row) => row.zone === 'secondary').length,
    availableCount: items.filter((row) => row.availability === 'available').length,
  };
}

/** The server's three states, derived the same way (`availabilityOf`). */
export function mockAvailability(status: string): 'available' | 'booked' | 'pending' {
  if (status === 'APPROVED' || status === 'AVAILABLE') return 'available';
  if (status === 'ASSIGNED' || status === 'INSTALLING' || status === 'ACTIVE') return 'booked';
  return 'pending';
}

/**
 * When a booked fixture vehicle comes free.
 *
 * The mock has no campaigns behind its vehicles, so the date is derived from
 * the id rather than looked up — stable across reloads, and spread over a few
 * weeks so the picker shows a range of dates rather than the same one twice.
 */
export function mockBookedUntil(vehicleId: string): string {
  const days = 9 + (sumCodes(vehicleId) % 24);
  const free = new Date(Date.UTC(2026, 8, 1));
  free.setUTCDate(free.getUTCDate() + days);
  return free.toISOString().slice(0, 10);
}

function sumCodes(value: string): number {
  let total = 0;
  for (let i = 0; i < value.length; i += 1) total += value.charCodeAt(i);
  return total;
}

/*
 * Document checklists for the review screen.
 *
 * Built lazily per driver so the ten fixture drivers do not all carry the same
 * documents: whoever is in `DOCUMENTS_SUBMITTED` has everything awaiting a
 * decision, an approved driver has everything verified, and a pending one has
 * sent nothing. That covers each state the review screen has to draw without
 * anyone having to click a driver into it.
 */
const DRIVER_KINDS = ['LICENCE'] as const;
const VEHICLE_KINDS = ['RC', 'INSURANCE', 'POLLUTION', 'PERMIT'] as const;

type MockChecklistItem = {
  kind: string;
  isMandatory: boolean;
  status: string;
  documentId: string | null;
  expiresOn: string | null;
  rejectionReason: string | null;
  contentType: string | null;
  uploadedAt: string | null;
};

const checklists = new Map<string, MockChecklistItem[]>();

function checklistFor(driverId: string, owner: 'driver' | 'vehicle'): MockChecklistItem[] {
  const key = `${driverId}:${owner}`;
  const existing = checklists.get(key);
  if (existing) return existing;

  const driver = mockDrivers.find((d) => d.id === driverId);
  const kinds = owner === 'driver' ? DRIVER_KINDS : VEHICLE_KINDS;
  const status =
    driver?.status === 'APPROVED'
      ? 'verified'
      : driver?.status === 'DOCUMENTS_SUBMITTED'
        ? 'uploaded'
        : 'missing';

  const built: MockChecklistItem[] = kinds.map((kind, index) => ({
    kind,
    isMandatory: true,
    status,
    documentId: status === 'missing' ? null : `doc_${driverId}_${kind.toLowerCase()}`,
    expiresOn:
      status === 'missing' || kind === 'RC'
        ? null
        : new Date(Date.now() + (200 + index * 30) * 86_400_000).toISOString().slice(0, 10),
    rejectionReason: null,
    contentType: status === 'missing' ? null : index % 3 === 0 ? 'application/pdf' : 'image/jpeg',
    uploadedAt: status === 'missing' ? null : new Date(Date.now() - 3_600_000).toISOString(),
  }));

  checklists.set(key, built);
  return built;
}

export function mockDriverDetail(driverId: string): {
  driver: Omit<MockDriver, 'vehicle'> & {
    suspendedReason: string | null;
    rejectionReason: string | null;
  };
  vehicles: unknown[];
  driverDocuments: MockChecklistItem[];
  vehicleDocuments: Record<string, MockChecklistItem[]>;
} | null {
  const driver = mockDrivers.find((d) => d.id === driverId);
  if (!driver) return null;

  const { vehicle, ...rest } = driver;

  return {
    driver: { ...rest, suspendedReason: null, rejectionReason: null },
    vehicles: vehicle
      ? [
          {
            ...vehicle,
            driverId,
            bodyType: null,
            makeModel: vehicle.category === 'AUTO' ? 'Bajaj RE' : 'Maruti Dzire',
            colour: null,
            manufactureYear: null,
            fuelType: null,
            imageKey: null,
            imageUrl: null,
            rejectionReason: null,
            suspendedReason: null,
          },
        ]
      : [],
    driverDocuments: checklistFor(driverId, 'driver'),
    vehicleDocuments: vehicle ? { [vehicle.id]: checklistFor(driverId, 'vehicle') } : {},
  };
}

/** Records a decision against whichever checklist holds the document. */
export function decideMockDocument(
  documentId: string,
  decision: 'verified' | 'rejected',
  reason: string | null,
): MockChecklistItem | null {
  for (const items of checklists.values()) {
    const item = items.find((candidate) => candidate.documentId === documentId);
    if (item) {
      item.status = decision;
      item.rejectionReason = reason;
      return item;
    }
  }
  return null;
}

export function setMockDriverStatus(driverId: string, status: MockDriver['status']): MockDriver | null {
  const driver = mockDrivers.find((d) => d.id === driverId);
  if (!driver) return null;
  driver.status = status;
  return driver;
}

/**
 * Archives a driver, mirroring the real endpoint: the row leaves the list, and
 * the mobile and plate it held become free again. Dropping it from the array is
 * the closest a mock gets to "invisible to every read".
 */
export function removeMockDriver(id: string, reason: string): MockDriver | null {
  const index = mockDrivers.findIndex((d) => d.id === id);
  if (index === -1) return null;

  const [removed] = mockDrivers.splice(index, 1);
  if (!removed) return null;

  return { ...removed, deletedReason: reason };
}

/**
 * Advertiser accounts, each with a prepaid wallet. `available` is the balance
 * minus budget already committed to live campaigns — the figure AC-34.6 caps
 * an admin-created campaign against.
 */
export const mockAdvertisers = [
  {
    id: 'adv_01',
    name: 'ABC Advertising',
    status: 'ACTIVE',
    wallet: { balance: '500000.0000', committed: '382161.0000', available: '117839.0000' },
  },
  {
    id: 'adv_02',
    name: 'Swiggy',
    status: 'ACTIVE',
    wallet: { balance: '1200000.0000', committed: '250000.0000', available: '950000.0000' },
  },
  {
    id: 'adv_03',
    name: 'CRED',
    status: 'ACTIVE',
    wallet: { balance: '500000.0000', committed: '500000.0000', available: '0.0000' },
  },
  {
    id: 'adv_04',
    name: 'Zepto',
    status: 'SUSPENDED',
    wallet: { balance: '0.0000', committed: '0.0000', available: '0.0000' },
  },
];

/**
 * The operations view of the same accounts, matching `Advertiser` on the real
 * API. A different shape from `mockAdvertisers` above because it answers a
 * different question: not "can they afford this campaign" but "has their
 * contact actually managed to get in yet".
 *
 * Seeded across all four access states, so the Advertisers table shows each
 * badge without anyone having to contrive one.
 */
export interface MockAdminAdvertiser {
  id: string;
  legalName: string;
  brandName: string;
  gstin: string | null;
  pan: string | null;
  billingEmail: string;
  status: 'ONBOARDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  createdAt: string;
  primaryUser: {
    id: string;
    email: string;
    fullName: string;
    status: string;
    invitationExpiresAt: string | null;
  } | null;
}

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export const mockAdminAdvertisers: MockAdminAdvertiser[] = [
  {
    id: 'adv_01',
    legalName: 'ABC Advertising Private Limited',
    brandName: 'ABC Advertising',
    gstin: '29ABCDE1234F1Z5',
    pan: 'ABCDE1234F',
    billingEmail: 'accounts@abcadvertising.example',
    status: 'ACTIVE',
    createdAt: daysAgo(64),
    primaryUser: {
      id: 'usr_adv_01',
      email: 'priya@abcadvertising.example',
      fullName: 'Priya Menon',
      status: 'ACTIVE',
      invitationExpiresAt: null,
    },
  },
  {
    id: 'adv_02',
    legalName: 'Bundl Technologies Private Limited',
    brandName: 'Swiggy',
    gstin: '29AAGCB1286Q1ZM',
    pan: 'AAGCB1286Q',
    billingEmail: 'ap@swiggy.example',
    status: 'ONBOARDING',
    createdAt: daysAgo(1),
    primaryUser: {
      id: 'usr_adv_02',
      email: 'rohan@swiggy.example',
      fullName: 'Rohan Iyer',
      // Invited yesterday and has not opened it. The row an operator chases.
      status: 'INVITED',
      invitationExpiresAt: hoursFromNow(48),
    },
  },
  {
    id: 'adv_03',
    legalName: 'Dreamplug Technologies Private Limited',
    brandName: 'CRED',
    gstin: null,
    pan: null,
    billingEmail: 'finance@cred.example',
    status: 'ONBOARDING',
    createdAt: daysAgo(9),
    primaryUser: {
      id: 'usr_adv_03',
      email: 'anita@cred.example',
      fullName: 'Anita Rao',
      status: 'INVITED',
      // Lapsed, so the row shows the state that needs a resend.
      invitationExpiresAt: hoursFromNow(-30),
    },
  },
  {
    id: 'adv_04',
    legalName: 'Kiranakart Technologies Private Limited',
    brandName: 'Zepto',
    gstin: null,
    pan: null,
    billingEmail: 'billing@zepto.example',
    status: 'SUSPENDED',
    createdAt: daysAgo(120),
    // Opened without a contact, so nobody can sign in at all.
    primaryUser: null,
  },
];

export const hasMockAdvertiserEmail = (email: string) =>
  mockAdminAdvertisers.some((a) => a.primaryUser?.email.toLowerCase() === email.toLowerCase());

/**
 * The tokens the mock will accept on the set-password page.
 *
 * Keyed by token because that is how the endpoint is reached. `demo` is seeded
 * so `/invitation/demo` is a working URL in a mock build — the accept screen is
 * otherwise unreachable without intercepting an email that is never sent.
 */
export interface MockInvitation {
  email: string;
  fullName: string;
  organisation: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  supersededAt: string | null;
}

export const mockInvitations = new Map<string, MockInvitation>([
  [
    'demo',
    {
      email: 'rohan@swiggy.example',
      fullName: 'Rohan Iyer',
      organisation: 'Swiggy',
      expiresAt: hoursFromNow(48),
      acceptedAt: null,
      supersededAt: null,
    },
  ],
  [
    'expired',
    {
      email: 'anita@cred.example',
      fullName: 'Anita Rao',
      organisation: 'CRED',
      expiresAt: hoursFromNow(-30),
      acceptedAt: null,
      supersededAt: null,
    },
  ],
]);

/** Prepended so the write is visible in the table straight away. */
export function addMockAdvertiser(input: {
  legalName: string;
  brandName: string;
  gstin?: string | null;
  pan?: string | null;
  billingEmail: string;
  user?: { email: string; fullName: string } | null;
}): { advertiser: MockAdminAdvertiser; token: string | null } {
  const id = `adv_${String(Date.now())}`;
  const token = input.user ? `tok_${String(Date.now())}` : null;

  const advertiser: MockAdminAdvertiser = {
    id,
    legalName: input.legalName,
    brandName: input.brandName,
    gstin: input.gstin ?? null,
    pan: input.pan ?? null,
    billingEmail: input.billingEmail,
    // Not ACTIVE on creation: that waits on a funded wallet.
    status: 'ONBOARDING',
    createdAt: new Date().toISOString(),
    primaryUser: input.user
      ? {
          id: `usr_${id}`,
          email: input.user.email,
          fullName: input.user.fullName,
          status: 'INVITED',
          invitationExpiresAt: hoursFromNow(72),
        }
      : null,
  };

  mockAdminAdvertisers.unshift(advertiser);

  if (token && input.user) {
    mockInvitations.set(token, {
      email: input.user.email,
      fullName: input.user.fullName,
      organisation: input.brandName,
      expiresAt: hoursFromNow(72),
      acceptedAt: null,
      supersededAt: null,
    });
  }

  return { advertiser, token };
}

/**
 * Issues a replacement and kills whatever was outstanding, the way the real
 * endpoint does — the previous link stops working, which is the point.
 */
export function resendMockInvitation(userId: string): MockAdminAdvertiser | null {
  const advertiser = mockAdminAdvertisers.find((a) => a.primaryUser?.id === userId);
  const user = advertiser?.primaryUser;
  if (!advertiser || !user) return null;

  for (const [, invitation] of mockInvitations) {
    if (invitation.email === user.email && !invitation.acceptedAt) {
      invitation.supersededAt = new Date().toISOString();
    }
  }

  const expiresAt = hoursFromNow(72);
  mockInvitations.set(`tok_${String(Date.now())}`, {
    email: user.email,
    fullName: user.fullName,
    organisation: advertiser.brandName,
    expiresAt,
    acceptedAt: null,
    supersededAt: null,
  });

  user.invitationExpiresAt = expiresAt;
  return advertiser;
}

export interface MockEmailChange {
  previousEmail: string;
  invitationResent: boolean;
  delivered: boolean;
}

/**
 * Corrects a contact, with the same consequences the real endpoint has: an
 * address change on an invited account reissues the invitation and voids the
 * old link, and on a live one it is reported as a security event.
 */
export function updateMockUser(
  userId: string,
  changes: { fullName?: string; email?: string },
): { user: NonNullable<MockAdminAdvertiser['primaryUser']>; emailChange: MockEmailChange } | null {
  const advertiser = mockAdminAdvertisers.find((a) => a.primaryUser?.id === userId);
  const user = advertiser?.primaryUser;
  if (!advertiser || !user) return null;

  const previousEmail = user.email;
  const movingAddress = changes.email !== undefined && changes.email !== previousEmail;

  if (changes.fullName !== undefined) user.fullName = changes.fullName;
  if (!movingAddress) {
    return {
      user,
      emailChange: { previousEmail, invitationResent: false, delivered: false },
    };
  }

  const invited = user.status === 'INVITED';
  user.email = changes.email ?? user.email;

  for (const [, invitation] of mockInvitations) {
    if (invitation.email === previousEmail && !invitation.acceptedAt) {
      invitation.supersededAt = new Date().toISOString();
    }
  }

  if (invited) {
    const expiresAt = hoursFromNow(72);
    mockInvitations.set(`tok_${String(Date.now())}`, {
      email: user.email,
      fullName: user.fullName,
      organisation: advertiser.brandName,
      expiresAt,
      acceptedAt: null,
      supersededAt: null,
    });
    user.invitationExpiresAt = expiresAt;
  }

  return {
    user,
    emailChange: { previousEmail, invitationResent: invited, delivered: true },
  };
}

/** Marks the invitation used and the account active, as accepting does. */
export function acceptMockInvitation(token: string): MockInvitation | null {
  const invitation = mockInvitations.get(token);
  if (!invitation) return null;

  invitation.acceptedAt = new Date().toISOString();

  const advertiser = mockAdminAdvertisers.find(
    (a) => a.primaryUser?.email === invitation.email,
  );
  if (advertiser?.primaryUser) {
    advertiser.primaryUser.status = 'ACTIVE';
    advertiser.primaryUser.invitationExpiresAt = null;
  }

  return invitation;
}

export const mockWallet = {
  balance: '500000.0000',
  committed: '382161.0000',
  available: '117839.0000',
  currency: 'INR',
};
