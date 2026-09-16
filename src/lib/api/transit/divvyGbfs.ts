/**
 * Divvy bike share via GBFS (General Bikeshare Feed Specification). No key.
 *
 * Spec: https://gbfs.org/specification/reference/
 * Divvy discovery doc: https://gbfs.divvybikes.com/gbfs/gbfs.json
 *
 * The feed URLs are resolved from the discovery document rather than
 * hardcoded: Divvy's own domain currently redirects to Lyft-hosted feeds
 * (gbfs.lyft.com/gbfs/1.1/chi/en/...), and that indirection has moved before.
 * Reading the discovery doc is what GBFS is for.
 */
import {fetchJson} from '../http';

const DISCOVERY_URL = 'https://gbfs.divvybikes.com/gbfs/gbfs.json';

type GbfsFeed = {name: string; url: string};

type GbfsDiscovery = {
  data: Record<string, {feeds: GbfsFeed[]}> | {feeds: GbfsFeed[]};
  ttl?: number;
  last_updated?: number;
};

type GbfsEnvelope<T> = {
  data: T;
  ttl?: number;
  last_updated?: number;
  version?: string;
};

export type GbfsStationInformation = {
  station_id: string;
  name: string;
  short_name?: string;
  lat: number;
  lon: number;
  capacity?: number;
  address?: string;
  region_id?: string;
  rental_uris?: {android?: string; ios?: string; web?: string};
};

export type GbfsStationStatus = {
  station_id: string;
  num_bikes_available: number;
  num_docks_available: number;
  num_ebikes_available?: number;
  is_installed: number | boolean;
  is_renting: number | boolean;
  is_returning: number | boolean;
  last_reported?: number;
};

/** Information and status joined — what a map pin actually needs. */
export type DivvyStation = GbfsStationInformation & {
  bikesAvailable: number;
  ebikesAvailable: number;
  docksAvailable: number;
  isRenting: boolean;
  isReturning: boolean;
};

/**
 * The in-flight promise is cached, not just the resolved value.
 *
 * `fetchDivvyStations` requests both feeds with Promise.all, so two callers
 * reach this before either has finished. Caching only the result lets both
 * fetch the discovery document — a stampede that doubles the request count and
 * races on the write. Memoising the promise means the second caller awaits the
 * first one's fetch.
 */
let feedCache: Promise<Map<string, string>> | null = null;

/**
 * The discovery document is itself cached for the process lifetime: it changes
 * far less often than the station feeds, and re-fetching it on every poll
 * would double the request count for no benefit.
 */
async function loadFeeds(signal?: AbortSignal): Promise<Map<string, string>> {
  const discovery = await fetchJson<GbfsDiscovery>(DISCOVERY_URL, {signal});
  const feeds = new Map<string, string>();

  // The spec's `data` is keyed by language ({ en: { feeds } }), but some
  // producers put `feeds` at the top level. Both shapes appear in the wild.
  const groups =
    'feeds' in discovery.data
      ? [discovery.data as {feeds: GbfsFeed[]}]
      : Object.values(discovery.data as Record<string, {feeds: GbfsFeed[]}>);

  for (const group of groups) {
    for (const feed of group.feeds ?? []) {
      if (!feeds.has(feed.name)) {
        feeds.set(feed.name, feed.url);
      }
    }
  }

  return feeds;
}

async function feedUrl(name: string, signal?: AbortSignal): Promise<string> {
  if (!feedCache) {
    // A failed lookup must not poison the cache, or every later call rejects
    // with the same stale error.
    feedCache = loadFeeds(signal).catch(error => {
      feedCache = null;
      throw error;
    });
  }

  const feeds = await feedCache;
  const url = feeds.get(name);

  if (!url) {
    throw new Error(`Divvy GBFS has no "${name}" feed in its discovery document`);
  }
  return url;
}

/** Exposed for tests, and for recovering from a feed migration at runtime. */
export function resetGbfsFeedCache(): void {
  feedCache = null;
}

export async function fetchStationInformation(
  options: {signal?: AbortSignal} = {},
): Promise<GbfsStationInformation[]> {
  const url = await feedUrl('station_information', options.signal);
  const response = await fetchJson<
    GbfsEnvelope<{stations: GbfsStationInformation[]}>
  >(url, {signal: options.signal, timeoutMs: 15_000});
  return response.data.stations;
}

export async function fetchStationStatus(
  options: {signal?: AbortSignal} = {},
): Promise<GbfsStationStatus[]> {
  const url = await feedUrl('station_status', options.signal);
  const response = await fetchJson<
    GbfsEnvelope<{stations: GbfsStationStatus[]}>
  >(url, {signal: options.signal, timeoutMs: 15_000});
  return response.data.stations;
}

/**
 * Both feeds, joined on station_id. Station *information* is static enough to
 * cache for a day; only *status* needs the 60s refresh, so callers polling
 * live availability should prefer refetching `fetchStationStatus` alone.
 */
export async function fetchDivvyStations(
  options: {signal?: AbortSignal} = {},
): Promise<DivvyStation[]> {
  const [information, status] = await Promise.all([
    fetchStationInformation(options),
    fetchStationStatus(options),
  ]);

  const statusById = new Map(status.map(s => [s.station_id, s]));

  return information.map(station => {
    const live = statusById.get(station.station_id);
    return {
      ...station,
      bikesAvailable: live?.num_bikes_available ?? 0,
      ebikesAvailable: live?.num_ebikes_available ?? 0,
      docksAvailable: live?.num_docks_available ?? 0,
      // GBFS 1.x uses 1/0, 2.x uses true/false.
      isRenting: Boolean(live?.is_renting),
      isReturning: Boolean(live?.is_returning),
    };
  });
}
