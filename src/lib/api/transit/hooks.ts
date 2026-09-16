/**
 * TanStack Query hooks for the transit clients.
 *
 * staleTime is chosen per feed: arrivals go stale in 30s, GBFS in 60s, and
 * anything schedule-shaped in a day. `refetchInterval` is set on the live
 * feeds so a screen left open keeps updating without its own timer.
 */
import {useQuery} from '@tanstack/react-query';

import {STALE_TIME} from '../../query';
import {fetchBusPredictions, fetchBusVehicles} from './ctaBus';
import {fetchTrainArrivals, type TrainArrivalsQuery} from './ctaTrain';
import {fetchDivvyStations, fetchStationStatus} from './divvyGbfs';
import {fetchMetraTripUpdates, fetchMetraVehiclePositions} from './metra';
import {fetchIsochrone, fetchRoute, type IsochroneOptions, type LngLat, type TravelMode} from './valhalla';

export const transitKeys = {
  trainArrivals: (query: Omit<TrainArrivalsQuery, 'signal'>) =>
    ['transit', 'cta', 'train', query] as const,
  busPredictions: (stopIds: (string | number)[], route?: string) =>
    ['transit', 'cta', 'bus', 'predictions', stopIds, route] as const,
  busVehicles: (routes: string[]) =>
    ['transit', 'cta', 'bus', 'vehicles', routes] as const,
  divvyStations: () => ['transit', 'divvy', 'stations'] as const,
  divvyStatus: () => ['transit', 'divvy', 'status'] as const,
  metraPositions: () => ['transit', 'metra', 'positions'] as const,
  metraTripUpdates: () => ['transit', 'metra', 'tripUpdates'] as const,
  route: (from: LngLat, to: LngLat, mode: TravelMode) =>
    ['transit', 'route', from, to, mode] as const,
  isochrone: (center: LngLat, mode: TravelMode, minutes: number[]) =>
    ['transit', 'isochrone', center, mode, minutes] as const,
};

export function useTrainArrivals(
  query: Omit<TrainArrivalsQuery, 'signal'>,
  options: {enabled?: boolean} = {},
) {
  return useQuery({
    queryKey: transitKeys.trainArrivals(query),
    queryFn: ({signal}) => fetchTrainArrivals({...query, signal}),
    staleTime: STALE_TIME.arrivals,
    refetchInterval: STALE_TIME.arrivals,
    enabled: (options.enabled ?? true) && Boolean(query.mapId || query.stopId),
  });
}

export function useBusPredictions(
  stopIds: (string | number)[],
  options: {route?: string; enabled?: boolean} = {},
) {
  return useQuery({
    queryKey: transitKeys.busPredictions(stopIds, options.route),
    queryFn: ({signal}) => fetchBusPredictions(stopIds, {route: options.route, signal}),
    staleTime: STALE_TIME.arrivals,
    refetchInterval: STALE_TIME.arrivals,
    enabled: (options.enabled ?? true) && stopIds.length > 0,
  });
}

export function useBusVehicles(routes: string[], options: {enabled?: boolean} = {}) {
  return useQuery({
    queryKey: transitKeys.busVehicles(routes),
    queryFn: ({signal}) => fetchBusVehicles(routes, {signal}),
    staleTime: STALE_TIME.arrivals,
    refetchInterval: STALE_TIME.arrivals,
    enabled: (options.enabled ?? true) && routes.length > 0,
  });
}

/**
 * Station information barely changes, so the joined view is cached for a day.
 * For live dock counts use `useDivvyStatus`, which refetches on the GBFS ttl.
 */
export function useDivvyStations(options: {enabled?: boolean} = {}) {
  return useQuery({
    queryKey: transitKeys.divvyStations(),
    queryFn: ({signal}) => fetchDivvyStations({signal}),
    staleTime: STALE_TIME.gbfs,
    refetchInterval: STALE_TIME.gbfs,
    enabled: options.enabled ?? true,
  });
}

export function useDivvyStatus(options: {enabled?: boolean} = {}) {
  return useQuery({
    queryKey: transitKeys.divvyStatus(),
    queryFn: ({signal}) => fetchStationStatus({signal}),
    staleTime: STALE_TIME.gbfs,
    refetchInterval: STALE_TIME.gbfs,
    enabled: options.enabled ?? true,
  });
}

export function useMetraVehiclePositions(options: {enabled?: boolean} = {}) {
  return useQuery({
    queryKey: transitKeys.metraPositions(),
    queryFn: ({signal}) => fetchMetraVehiclePositions({signal}),
    staleTime: STALE_TIME.arrivals,
    refetchInterval: STALE_TIME.arrivals,
    enabled: options.enabled ?? true,
  });
}

export function useMetraTripUpdates(options: {enabled?: boolean} = {}) {
  return useQuery({
    queryKey: transitKeys.metraTripUpdates(),
    queryFn: ({signal}) => fetchMetraTripUpdates({signal}),
    staleTime: STALE_TIME.arrivals,
    refetchInterval: STALE_TIME.arrivals,
    enabled: options.enabled ?? true,
  });
}

export function useRoute(
  from: LngLat | null,
  to: LngLat | null,
  mode: TravelMode = 'pedestrian',
) {
  return useQuery({
    queryKey: transitKeys.route(from ?? [0, 0], to ?? [0, 0], mode),
    queryFn: ({signal}) => fetchRoute(from!, to!, {mode, signal}),
    // A route between two fixed points does not change minute to minute.
    staleTime: STALE_TIME.weather,
    enabled: Boolean(from && to),
  });
}

export function useIsochrone(
  center: LngLat | null,
  options: Omit<IsochroneOptions, 'signal'> = {},
) {
  const mode = options.mode ?? 'pedestrian';
  const minutes = options.minutes ?? [5, 10, 15];

  return useQuery({
    queryKey: transitKeys.isochrone(center ?? [0, 0], mode, minutes),
    queryFn: ({signal}) => fetchIsochrone(center!, {...options, mode, minutes, signal}),
    staleTime: STALE_TIME.static,
    enabled: Boolean(center),
  });
}
