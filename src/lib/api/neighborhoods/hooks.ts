/**
 * TanStack Query hooks for the neighborhoods clients.
 *
 * Boundaries are effectively frozen, so these all use the 24h `static`
 * staleTime. The park permit feed is the one exception —
 * a booking can be added at any time — but a day is still fine for a list that
 * is filtered to future dates.
 */
import {useQuery} from '@tanstack/react-query';

import {STALE_TIME} from '../../query';
import {
  fetchLandmarks,
  fetchParkBoundaries,
  fetchWardBoundaries,
  fetchZipBoundaries,
} from './boundaries';
import {fetchParkEventPermits, fetchParkFacilities, type ParkEventQuery} from './parkDistrict';

export const neighborhoodKeys = {
  wards: () => ['neighborhoods', 'wards'] as const,
  parks: () => ['neighborhoods', 'parks'] as const,
  zips: () => ['neighborhoods', 'zips'] as const,
  landmarks: () => ['neighborhoods', 'landmarks'] as const,
  parkEvents: (query: Omit<ParkEventQuery, 'signal'>) =>
    ['neighborhoods', 'parkEvents', query] as const,
  parkFacilities: (parkNumber: string) =>
    ['neighborhoods', 'parkFacilities', parkNumber] as const,
};

export function useWardBoundaries(options: {enabled?: boolean} = {}) {
  return useQuery({
    queryKey: neighborhoodKeys.wards(),
    queryFn: ({signal}) => fetchWardBoundaries({signal}),
    staleTime: STALE_TIME.static,
    enabled: options.enabled ?? true,
  });
}

export function useParkBoundaries(options: {enabled?: boolean} = {}) {
  return useQuery({
    queryKey: neighborhoodKeys.parks(),
    queryFn: ({signal}) => fetchParkBoundaries({signal}),
    staleTime: STALE_TIME.static,
    enabled: options.enabled ?? true,
  });
}

export function useZipBoundaries(options: {enabled?: boolean} = {}) {
  return useQuery({
    queryKey: neighborhoodKeys.zips(),
    queryFn: ({signal}) => fetchZipBoundaries({signal}),
    staleTime: STALE_TIME.static,
    enabled: options.enabled ?? true,
  });
}

export function useLandmarks() {
  return useQuery({
    queryKey: neighborhoodKeys.landmarks(),
    queryFn: ({signal}) => fetchLandmarks({signal}),
    staleTime: STALE_TIME.static,
  });
}

export function useParkEvents(query: Omit<ParkEventQuery, 'signal'> = {}) {
  return useQuery({
    queryKey: neighborhoodKeys.parkEvents(query),
    queryFn: ({signal}) => fetchParkEventPermits({...query, signal}),
    staleTime: STALE_TIME.static,
  });
}

export function useParkFacilities(parkNumber: string | null) {
  return useQuery({
    queryKey: neighborhoodKeys.parkFacilities(parkNumber ?? ''),
    queryFn: ({signal}) => fetchParkFacilities(parkNumber!, {signal}),
    staleTime: STALE_TIME.static,
    enabled: Boolean(parkNumber),
  });
}
