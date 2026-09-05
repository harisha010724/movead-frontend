import type { Portal } from '@/shared/auth/portals';

/**
 * Centralised query keys.
 *
 * Keeping them in one place means an invalidation after a mutation cannot miss
 * a cache entry because someone wrote the key slightly differently elsewhere.
 */

export interface DateRange {
  from: string;
  to: string;
}

export const queryKeys = {
  auth: {
    me: (portal: Portal) => ['auth', 'me', portal] as const,
  },

  campaigns: {
    all: () => ['campaigns'] as const,
    list: (filters?: Record<string, unknown>) => ['campaigns', 'list', filters ?? {}] as const,
    detail: (id: string) => ['campaigns', 'detail', id] as const,
    admin: (filters?: Record<string, unknown>) =>
      ['campaigns', 'admin', filters ?? {}] as const,
    zones: (id: string) => ['campaigns', id, 'zones'] as const,
    assignments: (id: string) => ['campaigns', id, 'assignments'] as const,
  },

  installations: {
    queue: () => ['installations', 'queue'] as const,
    photos: (assignmentId: string) => ['installations', assignmentId, 'photos'] as const,
  },

  dashboard: {
    advertiser: (campaignId: string | null, range: DateRange) =>
      ['dashboard', 'advertiser', campaignId, range] as const,
    admin: (range: DateRange) => ['dashboard', 'admin', range] as const,
  },

  vehicles: {
    all: () => ['vehicles'] as const,
    list: (filters?: Record<string, unknown>) => ['vehicles', 'list', filters ?? {}] as const,
    detail: (id: string) => ['vehicles', 'detail', id] as const,
    livePositions: (campaignId: string | null) =>
      ['vehicles', 'live-positions', campaignId] as const,
    inZones: (vehicleType: string, polygons: unknown) =>
      ['vehicles', 'in-zones', vehicleType, polygons] as const,
    available: (vehicleType?: string) =>
      ['vehicles', 'available', vehicleType ?? 'all'] as const,
  },

  advertisers: {
    all: () => ['advertisers'] as const,
    list: () => ['advertisers', 'list'] as const,
    /** The operations list, which is a different endpoint and shape. */
    admin: () => ['advertisers', 'admin'] as const,
  },

  drivers: {
    all: () => ['drivers'] as const,
    list: (filters?: Record<string, unknown>) => ['drivers', 'list', filters ?? {}] as const,
    detail: (id: string) => ['drivers', 'detail', id] as const,
  },

  verification: {
    documents: (filters?: Record<string, unknown>) =>
      ['verification', 'documents', filters ?? {}] as const,
    km: (filters?: Record<string, unknown>) => ['verification', 'km', filters ?? {}] as const,
    installations: () => ['verification', 'installations'] as const,
  },

  gpsAudit: {
    trips: (vehicleId: string, date: string) => ['gps-audit', vehicleId, date] as const,
    trip: (tripId: string) => ['gps-audit', 'trip', tripId] as const,
  },

  billing: {
    wallet: () => ['billing', 'wallet'] as const,
    ledger: (filters?: Record<string, unknown>) =>
      ['billing', 'ledger', filters ?? {}] as const,
  },

  driver: {
    me: () => ['driver', 'me'] as const,
    earnings: () => ['driver', 'earnings'] as const,
    campaign: () => ['driver', 'campaign'] as const,
    eligibility: () => ['driver', 'eligibility'] as const,
    all: () => ['driver'] as const,
  },

  notifications: {
    inbox: (portal?: string) => ['notifications', 'inbox', portal] as const,
  },

  payouts: {
    runs: () => ['payouts', 'runs'] as const,
    run: (id: string) => ['payouts', 'run', id] as const,
  },
} as const;
