/**
 * TanStack Query hooks over the API. Stale times: layers, areas and geocode 24 h,
 * places and Divvy 60 s, arrivals 30 s.
 */
import {
  AreaCollection,
  AreaDetail,
  ArrivalsQuery,
  Arrivals,
  ArterialCollection,
  BusRouteCollection,
  BusStopCollection,
  DivvyStations,
  EventCollection,
  ExpresswayCollection,
  LayerIndex,
  type LayerKey,
  MetraLineCollection,
  MetraStationCollection,
  PlaceCategory,
  PlaceCollection,
  PlaceDetail,
  TransitLineCollection,
  TransitStationCollection,
} from '@wm/shared';
import {type QueryClient, useQuery, useQueryClient} from '@tanstack/react-query';
import type {z} from 'zod';

import {ApiError, apiFetch, apiRequest, type RawResponse} from './client';
import {fetchGeocode, GEOCODE_MIN_LENGTH} from './geocode';
import {PERSIST_MAX_AGE, STALE} from './queryClient';
import {cacheStorage} from './storage';

/** [west, south, east, north] */
export type Bbox = readonly [number, number, number, number];

type ArrivalsMode = z.input<typeof ArrivalsQuery>['mode'];

export const apiKeys = {
  layers: () => ['layers'] as const,
  layer: (key: LayerKey) => ['layers', key] as const,
  places: (bbox: Bbox | null, category?: z.infer<typeof PlaceCategory>) =>
    ['places', bbox, category ?? null] as const,
  place: (id: string) => ['place', id] as const,
  areas: () => ['areas'] as const,
  area: (slug: string) => ['areas', slug] as const,
  divvy: () => ['divvy'] as const,
  arrivals: (stop: string, mode: ArrivalsMode) => ['arrivals', mode ?? 'rail', stop] as const,
  events: (bbox: Bbox | null) => ['events', bbox] as const,
  geocode: (query: string) => ['geocode', query] as const,
};

/** The response schema for each layer `GET /v1/layers/:key` serves. */
const LAYER_SCHEMAS = {
  expressways: ExpresswayCollection,
  arterials: ArterialCollection,
  'transit-lines': TransitLineCollection,
  'transit-stations': TransitStationCollection,
  'bus-routes': BusRouteCollection,
  'bus-stops': BusStopCollection,
  'metra-lines': MetraLineCollection,
  'metra-stations': MetraStationCollection,
} as const satisfies Record<LayerKey, unknown>;

export type LayerData<K extends LayerKey> = z.infer<(typeof LAYER_SCHEMAS)[K]>;

const etagKey = (key: LayerKey) => `etag:layers:${key}`;

/**
 * A layer the backend knows but has never ingested: `GET /v1/layers/:key`
 * answers 404, which is not the same as a collection with no features. The
 * distinction has to survive to the UI, which says the layer is unavailable
 * rather than drawing an empty map and calling it accurate.
 */
export class MissingLayerError extends Error {
  readonly key: LayerKey;

  constructor(key: LayerKey) {
    super(`The ${key} layer has not been ingested yet.`);
    this.name = 'MissingLayerError';
    this.key = key;
  }
}

/**
 * GET /v1/layers/:key with ETag revalidation.
 *
 * Only the ETag is stored separately. On 304 the body comes from the query
 * cache — already persisted to disk — rather than a second copy of up to a
 * megabyte kept alongside it.
 */
export async function fetchLayer<K extends LayerKey>(
  key: K,
  queryClient: QueryClient,
  signal?: AbortSignal,
): Promise<LayerData<K>> {
  const path = `/v1/layers/${key}`;
  const cached = queryClient.getQueryData<LayerData<K>>(apiKeys.layer(key));
  // No cached body means nothing to fall back on, so a conditional request
  // could only produce a 304 we cannot use.
  const etag = cached ? cacheStorage.getString(etagKey(key)) : undefined;

  let response: RawResponse;
  try {
    response = await apiFetch(path, {etag, signal});
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      throw new MissingLayerError(key);
    }
    throw error;
  }

  if (response.status === 304) {
    if (cached) {
      return cached;
    }
    response = await apiFetch(path, {signal});
  }

  const data = LAYER_SCHEMAS[key].parse(response.json) as LayerData<K>;

  if (response.etag) {
    cacheStorage.set(etagKey(key), response.etag);
  } else {
    cacheStorage.remove(etagKey(key));
  }

  return data;
}

type Enabled = {enabled?: boolean};

export function useLayer<K extends LayerKey>(key: K, options: Enabled = {}) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: apiKeys.layer(key),
    queryFn: ({signal}) => fetchLayer(key, queryClient, signal),
    staleTime: STALE.layers,
    gcTime: PERSIST_MAX_AGE,
    enabled: options.enabled ?? true,
  });
}

export function useLayers() {
  return useQuery({
    queryKey: apiKeys.layers(),
    queryFn: ({signal}) => apiRequest('/v1/layers', LayerIndex, {signal}),
    staleTime: STALE.layers,
  });
}

export function usePlaces(
  bbox: Bbox | null,
  category?: z.infer<typeof PlaceCategory>,
  options: Enabled = {},
) {
  return useQuery({
    queryKey: apiKeys.places(bbox, category),
    queryFn: ({signal}) =>
      apiRequest('/v1/places', PlaceCollection, {
        query: {bbox: bbox!.join(','), category},
        signal,
      }),
    staleTime: STALE.places,
    enabled: (options.enabled ?? true) && bbox !== null,
    // Keep the previous viewport's places on screen while the new ones load,
    // instead of blanking the layer on every pan.
    placeholderData: previous => previous,
  });
}

export function usePlace(id: string | null) {
  return useQuery({
    queryKey: apiKeys.place(id ?? ''),
    queryFn: ({signal}) => apiRequest(`/v1/places/${encodeURIComponent(id!)}`, PlaceDetail, {signal}),
    staleTime: STALE.places,
    enabled: Boolean(id),
  });
}

/**
 * Addresses and places for a search query. The caller debounces: this runs
 * for whatever string it is given. Not persisted, and not retried — a failure
 * means the endpoint or geocoder is down, and retrying per keystroke would
 * only delay the "unavailable" message.
 */
export function useGeocode(query: string, options: Enabled = {}) {
  const q = query.trim();
  return useQuery({
    queryKey: apiKeys.geocode(q),
    queryFn: ({signal}) => fetchGeocode(q, {signal}),
    staleTime: STALE.geocode,
    retry: false,
    enabled: (options.enabled ?? true) && q.length >= GEOCODE_MIN_LENGTH,
  });
}

export function useAreas(options: Enabled = {}) {
  return useQuery({
    queryKey: apiKeys.areas(),
    queryFn: ({signal}) => apiRequest('/v1/areas', AreaCollection, {signal}),
    staleTime: STALE.areas,
    gcTime: PERSIST_MAX_AGE,
    enabled: options.enabled ?? true,
  });
}

export function useArea(slug: string | null) {
  return useQuery({
    queryKey: apiKeys.area(slug ?? ''),
    queryFn: ({signal}) => apiRequest(`/v1/areas/${encodeURIComponent(slug!)}`, AreaDetail, {signal}),
    staleTime: STALE.areas,
    gcTime: PERSIST_MAX_AGE,
    enabled: Boolean(slug),
  });
}

export function useDivvy(options: Enabled = {}) {
  return useQuery({
    queryKey: apiKeys.divvy(),
    queryFn: ({signal}) => apiRequest('/v1/transit/divvy', DivvyStations, {signal}),
    staleTime: STALE.divvy,
    refetchInterval: STALE.divvy,
    enabled: options.enabled ?? true,
  });
}

export function useArrivals(stop: string | null, mode: ArrivalsMode = 'rail', options: Enabled = {}) {
  return useQuery({
    queryKey: apiKeys.arrivals(stop ?? '', mode),
    queryFn: ({signal}) =>
      apiRequest('/v1/transit/arrivals', Arrivals, {query: {stop, mode}, signal}),
    staleTime: STALE.arrivals,
    refetchInterval: STALE.arrivals,
    enabled: (options.enabled ?? true) && Boolean(stop),
  });
}

/**
 * Events with a location inside the viewport. The backend merges its sources
 * (owners, the Park District, ticketing partners, community submissions), so
 * the app no longer talks to any of them directly.
 */
export function useEvents(bbox: Bbox | null, options: Enabled = {}) {
  return useQuery({
    queryKey: apiKeys.events(bbox),
    queryFn: ({signal}) =>
      apiRequest('/v1/events', EventCollection, {query: {bbox: bbox!.join(',')}, signal}),
    staleTime: STALE.events,
    enabled: (options.enabled ?? true) && bbox !== null,
    placeholderData: previous => previous,
  });
}
