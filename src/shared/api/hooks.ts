import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/useAuth';
import type { Portal } from '@/shared/auth/portals';
import { api } from './client';
import { freshness } from './queryClient';
import { queryKeys, type DateRange } from './queryKeys';
import type {
  AdminCampaign,
  AdminDriverDetail,
  Assignment,
  AssignmentSummary,
  Campaign,
  DriverCampaign,
  DriverProfile,
  EligibilityCheck,
  InstallationPhoto,
  KmSummary,
  LivePosition,
  LiveVehicleState,
  Money,
  Paginated,
  RateCard,
  SpendBreakdown,
  VehicleAvailability,
  ZoneBreakdown,
} from '@/shared/types/domain';
import type { AlertSeverity } from '@/shared/ui/AlertList';

/** A labelled value used by the trend, bar and donut charts. */
export interface SeriesPoint {
  label: string;
  value: number;
}

/*
 * Query hooks. Each picks the freshness profile that matches how quickly its
 * data actually changes — see `freshness` in queryClient.ts.
 *
 * Once `npm run api:sync` has generated src/shared/api/schema.d.ts from the
 * backend's openapi.json, replace these hand-written response types with the
 * generated ones so the contract cannot drift.
 */

export function useCampaigns(filters?: { status?: string }) {
  return useQuery({
    queryKey: queryKeys.campaigns.list(filters),
    queryFn: () => api.get<Paginated<Campaign>>('/v1/campaigns', { query: filters ?? {} }),
    ...freshness.reference,
  });
}

export function useAdminCampaigns(filters?: { status?: string }) {
  return useQuery({
    queryKey: queryKeys.campaigns.admin(filters),
    queryFn: () =>
      api.get<Paginated<AdminCampaign>>('/v1/admin/campaigns', { query: filters ?? {} }),
    ...freshness.reference,
  });
}

export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.campaigns.detail(id ?? ''),
    queryFn: () => api.get<Campaign>(`/v1/campaigns/${id}`),
    enabled: Boolean(id),
    ...freshness.reference,
  });
}

export interface TopVehicleRow {
  vehicleNumber: string;
  driverName: string;
  area: string;
  km: number;
  zoneKm: ZoneBreakdown;
  impressions: number;
  spend: Money;
  state: LiveVehicleState;
}

export interface AdvertiserDashboard {
  campaignId: string;
  km: KmSummary;
  spend: SpendBreakdown;
  budget: Money;
  remaining: Money;
  activeVehicles: number;
  costPerKm: Money;
  /**
   * Reach estimate, not a billable quantity. The MVP acceptance criteria do
   * not define how an impression is counted, so nothing in the pricing path
   * may depend on this field until they do.
   */
  impressions: number;
  costPerThousandImpressions: Money;
  comparison: {
    impressions: number;
    verifiedKm: number;
    spend: number;
    activeVehicles: number;
    costPerThousandImpressions: number;
  };
  rates: RateCard;
  impressionsDaily: SeriesPoint[];
  impressionsHourly: SeriesPoint[];
  impressionsByArea: SeriesPoint[];
  impressionsByVehicleType: SeriesPoint[];
  vehicleStatus: { state: LiveVehicleState; count: number }[];
  topVehicles: TopVehicleRow[];
  alerts: { id: string; severity: AlertSeverity; message: string; occurredAt: string }[];
}

export function useAdvertiserDashboard(campaignId: string | null, range: DateRange) {
  return useQuery({
    queryKey: queryKeys.dashboard.advertiser(campaignId, range),
    queryFn: () =>
      api.get<AdvertiserDashboard>('/v1/dashboard/advertiser', {
        query: { campaignId: campaignId ?? undefined, from: range.from, to: range.to },
      }),
    ...freshness.aggregate,
  });
}

export interface AdminDashboard {
  supply: {
    registeredDrivers: number;
    approvedDrivers: number;
    activeCampaigns: number;
    currentlyTracking: number;
  };
  inventoryToday: KmSummary;
  moneyToday: {
    advertiserRevenue: Money;
    driverLiability: Money;
    grossSpread: Money;
  };
  queues: {
    documentsPending: number;
    installationsPending: number;
    kmFlagged: number;
    payoutsAwaitingRelease: number;
  };
  revenueDaily: SeriesPoint[];
  vehicleStatus: { state: LiveVehicleState; count: number }[];
}

export function useAdminDashboard(range: DateRange) {
  return useQuery({
    queryKey: queryKeys.dashboard.admin(range),
    queryFn: () =>
      api.get<AdminDashboard>('/v1/dashboard/admin', {
        query: { from: range.from, to: range.to },
      }),
    ...freshness.aggregate,
  });
}

/**
 * Live positions are served from Redis, never from the GPS points table.
 * Polling stops when the tab is backgrounded — see `freshness.live`.
 */
export function useLivePositions(campaignId: string | null) {
  return useQuery({
    queryKey: queryKeys.vehicles.livePositions(campaignId),
    queryFn: () =>
      api.get<{ items: LivePosition[]; updatedAt: string }>('/v1/vehicles/live-positions', {
        query: { campaignId: campaignId ?? undefined },
      }),
    ...freshness.live,
  });
}

export interface VehicleListing {
  id: string;
  vehicleRef: string;
  vehicleType: 'AUTO' | 'CAB';
  primaryArea: string;
  avgKmPerDay: number;
  zoneMix: { prime: number; secondary: number; network: number };
  status: string;
}

export interface AvailableFleetVehicle {
  id: string;
  vehicleType: 'CAB' | 'AUTO';
  /** A stable, opaque reference. Kept for support conversations and logs. */
  publicRef: string;
  /** The plate, shown to every audience — see AC-22.4. */
  registrationNumber: string;
  areaLabel: string;
  city: string;
  lat: number;
  lng: number;
  status: string;
  availability: VehicleAvailability;
  /** Only on a booked vehicle: when the campaign holding it ends (AC-22.4c). */
  bookedUntil?: string;
}

export function useAvailableFleet(vehicleType?: 'CAB' | 'AUTO') {
  return useQuery({
    queryKey: queryKeys.vehicles.available(vehicleType),
    queryFn: () =>
      api.get<{ items: AvailableFleetVehicle[]; cabCount: number; autoCount: number }>(
        '/v1/vehicles/available',
        { query: vehicleType ? { vehicleType } : {} },
      ),
    ...freshness.reference,
  });
}

export function useVehicles(filters?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.vehicles.list(filters),
    queryFn: () => api.get<Paginated<VehicleListing>>('/v1/vehicles', { query: filters ?? {} }),
    ...freshness.reference,
  });
}

export interface AdvertiserAccount {
  id: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED';
  wallet: { balance: Money; committed: Money; available: Money };
}

export function useAdvertisers() {
  return useQuery({
    queryKey: queryKeys.advertisers.list(),
    queryFn: () => api.get<Paginated<AdvertiserAccount>>('/v1/advertisers'),
    ...freshness.reference,
  });
}

/** INVITED until they follow the emailed link and choose a password. */
export interface AdvertiserContact {
  id: string;
  email: string;
  fullName: string;
  status: string;
  /** When the outstanding invitation lapses. Null once they have accepted. */
  invitationExpiresAt: string | null;
}

export interface AdvertiserListing {
  id: string;
  legalName: string;
  brandName: string;
  gstin: string | null;
  pan: string | null;
  billingEmail: string;
  status: 'ONBOARDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  createdAt: string;
  /** Null when the account was opened without a contact. Nobody can sign in. */
  primaryUser: AdvertiserContact | null;
}

/**
 * The admin portal's own list, which is a different thing from `useAdvertisers`
 * above: that one feeds a campaign's advertiser picker and carries a wallet,
 * this one is the operations view and carries the contact and their invitation.
 */
export function useAdminAdvertisers() {
  return useQuery({
    queryKey: queryKeys.advertisers.admin(),
    queryFn: () => api.get<AdvertiserListing[]>('/v1/admin/advertisers'),
    ...freshness.reference,
  });
}

export type DriverStatus = 'PENDING' | 'DOCUMENTS_SUBMITTED' | 'APPROVED' | 'SUSPENDED';

export interface DriverListing {
  id: string;
  name: string;
  mobile: string;
  status: DriverStatus;
  photoKey: string | null;
  joinedAt: string;
  city?: string;
  location?: {
    city: string;
    label: string;
    lat: number;
    lng: number;
  } | null;
  /** Null until a vehicle has been added — the driver still needs reviewing. */
  vehicle: {
    id: string;
    registrationNumber: string;
    category: 'AUTO' | 'CAB';
    status: string;
  } | null;
}

export function useDrivers(filters?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.drivers.list(filters),
    queryFn: () =>
      api.get<Paginated<DriverListing>>('/v1/admin/drivers', { query: filters ?? {} }),
    ...freshness.reference,
  });
}

/**
 * One driver with both document checklists, for the review screen.
 *
 * Deliberately not `freshness.reference`: an operator works through this page
 * verifying one document at a time, and each decision changes what the page
 * shows. Refetching on focus costs one request and avoids deciding twice on a
 * document a colleague has already handled.
 */
export function useDriverDetail(driverId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.drivers.detail(driverId ?? ''),
    queryFn: () => api.get<AdminDriverDetail>(`/v1/admin/drivers/${driverId ?? ''}`),
    enabled: Boolean(driverId),
  });
}

export interface AppNotification {
  id: string;
  kind: 'TRACKING' | 'EARNING' | 'CAMPAIGN' | 'PAYOUT' | 'VERIFICATION' | 'SYSTEM';
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

function notificationsBase(portal: Portal | undefined): string {
  return portal === 'admin' ? '/v1/admin/notifications' : '/v1/notifications';
}

export function useNotifications(enabled = true) {
  const { user } = useAuth();
  const portal = user?.portal;
  const canFetch = enabled && (portal === 'admin' || portal === 'advertiser');

  return useQuery({
    queryKey: queryKeys.notifications.inbox(portal),
    queryFn: () =>
      api.get<{ items: AppNotification[]; unreadCount: number }>(notificationsBase(portal)),
    enabled: canFetch,
    staleTime: 15_000,
    refetchInterval: canFetch ? 30_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useDriverProfile() {
  return useQuery({
    queryKey: queryKeys.driver.me(),
    queryFn: () => api.get<DriverProfile>('/v1/driver/me'),
    ...freshness.reference,
  });
}

export function useDriverEarnings() {
  return useQuery({
    queryKey: queryKeys.driver.earnings(),
    queryFn: () =>
      api.get<{
        availableBalance: Money;
        pendingBalance: Money;
        monthVerifiedKm: number;
        monthEarnings: Money;
        todayVerifiedKm: number;
        todayEarnings: Money;
        history: { date: string; verifiedKm: number; earnings: Money }[];
      }>('/v1/driver/earnings'),
    ...freshness.aggregate,
  });
}

/**
 * The driver's campaign, visible from assignment onward rather than only once
 * live: AC-22.5 has the driver accept before installation begins, which they
 * cannot do without seeing it. `status` says which stage it is at.
 */
export function useDriverCampaign() {
  return useQuery({
    queryKey: queryKeys.driver.campaign(),
    queryFn: () => api.get<DriverCampaign | null>('/v1/driver/campaign'),
    ...freshness.reference,
  });
}

export function useDriverEligibility() {
  return useQuery({
    queryKey: queryKeys.driver.eligibility(),
    queryFn: () =>
      api.get<{ eligible: boolean; checks: EligibilityCheck[] }>('/v1/driver/eligibility'),
    ...freshness.reference,
  });
}

/** AC-22.5. Accepting is what lets operations book the installation. */
export function useAcceptAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assignmentId: string) =>
      api.post(`/v1/driver/assignments/${assignmentId}/accept`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.driver.all() }),
  });
}

/** AC-22.8: the vehicles on a campaign and how far each installation has got. */
export function useCampaignAssignments(campaignId: string | null) {
  return useQuery({
    queryKey: queryKeys.campaigns.assignments(campaignId ?? ''),
    queryFn: () =>
      api.get<{ items: Assignment[]; summary: AssignmentSummary }>(
        `/v1/admin/campaigns/${campaignId ?? ''}/vehicles`,
      ),
    enabled: Boolean(campaignId),
    ...freshness.reference,
  });
}

export function useInstallationQueue() {
  return useQuery({
    queryKey: queryKeys.installations.queue(),
    queryFn: () => api.get<{ items: Assignment[] }>('/v1/admin/installations'),
    ...freshness.aggregate,
  });
}

export function useInstallationPhotos(assignmentId: string | null) {
  return useQuery({
    queryKey: queryKeys.installations.photos(assignmentId ?? ''),
    queryFn: () =>
      api.get<{ items: InstallationPhoto[] }>(`/v1/admin/assignments/${assignmentId ?? ''}/photos`),
    enabled: Boolean(assignmentId),
    ...freshness.reference,
  });
}

export function useWallet() {
  return useQuery({
    queryKey: queryKeys.billing.wallet(),
    queryFn: () =>
      api.get<{ balance: Money; committed: Money; available: Money }>('/v1/billing/wallet'),
    ...freshness.aggregate,
  });
}
