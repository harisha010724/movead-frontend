import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './errors';

/**
 * Three freshness profiles, because this product's data has three genuinely
 * different staleness tolerances. Spread the right one into each query.
 */
export const freshness = {
  /** Zones, rate cards, vehicle lists — changes rarely, expensive to refetch. */
  reference: {
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  },

  /** Dashboard aggregates — expensive server-side, slight staleness is fine. */
  aggregate: {
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  },

  /**
   * Live vehicle positions, served from Redis rather than the GPS table.
   *
   * `refetchIntervalInBackground: false` is a cost control, not a nicety: an
   * advertiser leaving the live map open overnight would otherwise generate
   * tens of thousands of requests and, worse, Google Maps loads.
   */
  live: {
    staleTime: 0,
    gcTime: 60_000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  },
} as const;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        ...freshness.aggregate,
        retry: (failureCount, error) => {
          // Never retry a 4xx — it will fail identically and delays the error state.
          if (error instanceof ApiError && !error.isRetryable) return false;
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      },
      mutations: {
        // Mutations move money. Retrying automatically is how you double-charge.
        retry: false,
      },
    },
  });
}
