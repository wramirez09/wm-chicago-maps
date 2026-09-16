/**
 * Shared TanStack Query configuration.
 *
 * Docs: https://tanstack.com/query/latest/docs/framework/react/overview
 *
 * `staleTime` per data class, applied by the hooks in each group's hooks.ts.
 * The numbers reflect how fast the upstream actually changes: a boundary
 * polygon is effectively frozen, a train arrival is stale in half a minute.
 */
import {QueryClient} from '@tanstack/react-query';

export const STALE_TIME = {
  /** Boundaries, GTFS stops, landmark lists. */
  static: 24 * 60 * 60 * 1000,
  /** Train/bus arrival predictions. */
  arrivals: 30 * 1000,
  /** GBFS station status. */
  gbfs: 60 * 1000,
  /** Current weather. */
  weather: 10 * 60 * 1000,
} as const;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME.arrivals,
        // fetchJson already retries once on 5xx/network; a second layer of
        // retries here would multiply into four requests per failure.
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}
