/**
 * Query client and on-disk persistence.
 *
 * Only static datasets are persisted (layers, areas). Persisting live data
 * would restore minutes-old arrivals or dock counts on the next launch and
 * show them as current.
 */
import {createAsyncStoragePersister} from '@tanstack/query-async-storage-persister';
import {type Query, QueryClient} from '@tanstack/react-query';
import type {
  PersistedClient,
  PersistQueryClientOptions,
  Persister,
} from '@tanstack/react-query-persist-client';

import {persisterStorage} from './storage';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const STALE = {
  layers: DAY,
  areas: DAY,
  places: MINUTE,
  divvy: MINUTE,
  arrivals: 30 * 1000,
} as const;

/**
 * How long a persisted layer survives without a successful refetch. Not the
 * persister's 24 h default: with that, an offline launch the day after the
 * last good fetch would restore nothing and draw an empty map. Staleness is
 * handled by staleTime + ETag revalidation, not by expiry.
 */
export const PERSIST_MAX_AGE = 30 * DAY;

/**
 * Query-key roots written to disk. A persisted query also needs gcTime at
 * least PERSIST_MAX_AGE, or it is garbage-collected from memory and dropped
 * from the next write; the hooks for these roots set that.
 */
const PERSISTED_ROOTS = new Set(['layers', 'areas']);

/**
 * Bumped whenever the vendored @wm/shared schemas change shape, so a cache
 * written against the old contract is discarded instead of failing parse.
 * Tracks the backend commit the schemas were vendored from.
 */
const CACHE_BUSTER = 'shared@9e2c168';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The client does not retry; one attempt, then keep whatever data the
        // query already had (a failed refetch leaves `data` in place).
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}

/**
 * Skips a write when no persisted query changed since the last one.
 *
 * The persister is triggered by *every* query-cache event, not just events on
 * persisted queries, and each write JSON-stringifies the whole persisted
 * cache. With layers and areas that is ~5.5 MB, about 23 ms per stringify in
 * Node/V8 and several times that under Hermes, which has no JIT. Unwrapped,
 * the 60-second Divvy refresh and every map pan (a new places query) would
 * re-serialize megabytes of unchanged layers on the JS thread. A persisted
 * query only changes when its data is replaced, which bumps dataUpdatedAt,
 * so comparing those is enough.
 */
export function skipUnchangedWrites(inner: Persister): Persister {
  let lastSignature: string | undefined;

  return {
    persistClient: (client: PersistedClient) => {
      const signature = client.clientState.queries
        .map(query => `${query.queryHash}@${query.state.dataUpdatedAt}`)
        .sort()
        .join('|');

      if (signature === lastSignature) {
        return;
      }
      lastSignature = signature;
      return inner.persistClient(client);
    },
    restoreClient: () => inner.restoreClient(),
    removeClient: () => {
      lastSignature = undefined;
      return inner.removeClient();
    },
  };
}

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: skipUnchangedWrites(
    createAsyncStoragePersister({
      storage: persisterStorage,
      key: 'wm.query-cache',
      // Coalesces bursts, e.g. four layers resolving within a second at launch.
      throttleTime: 2000,
    }),
  ),
  maxAge: PERSIST_MAX_AGE,
  buster: CACHE_BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) =>
      query.state.status === 'success' &&
      PERSISTED_ROOTS.has(String(query.queryKey[0])),
  },
};
