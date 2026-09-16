/**
 * TanStack Query hooks for the places clients.
 *
 * Everything here is reference data that changes daily at most, so it all uses
 * the 24h `static` staleTime. Bbox-filtered queries include the bbox in the
 * key, so panning the map produces separate cache entries rather than
 * invalidating the previous one.
 */
import {useQuery} from '@tanstack/react-query';

import {STALE_TIME} from '../../query';
import {
  fetchActiveBusinessLicenses,
  type BusinessLicenseFilter,
} from './businessLicenses';
import {fetchBusinessOwners} from './businessOwners';
import {fetchCommunityAreaNames, fetchCommunityAreas} from './communityAreas';
import {
  fetchParcelByPin,
  fetchParcelsByAddress,
  fetchParcelClass,
} from './cookCountyAssessor';
import {geocode, reverseGeocode} from './photon';

export const placesKeys = {
  licenses: (filter: Omit<BusinessLicenseFilter, 'signal'>) =>
    ['places', 'licenses', filter] as const,
  owners: (accountNumber: string) => ['places', 'owners', accountNumber] as const,
  communityAreas: () => ['places', 'communityAreas'] as const,
  communityAreaNames: () => ['places', 'communityAreaNames'] as const,
  parcelByPin: (pin: string) => ['places', 'parcel', 'pin', pin] as const,
  parcelsByAddress: (address: string) => ['places', 'parcel', 'address', address] as const,
  parcelClass: (pin: string) => ['places', 'parcel', 'class', pin] as const,
  geocode: (query: string) => ['places', 'geocode', query] as const,
  reverseGeocode: (lng: number, lat: number) =>
    ['places', 'reverseGeocode', lng, lat] as const,
};

export function useBusinessLicenses(
  filter: Omit<BusinessLicenseFilter, 'signal'> = {},
  options: {enabled?: boolean} = {},
) {
  return useQuery({
    queryKey: placesKeys.licenses(filter),
    queryFn: ({signal}) => fetchActiveBusinessLicenses({...filter, signal}),
    staleTime: STALE_TIME.static,
    enabled: options.enabled ?? true,
  });
}

export function useBusinessOwners(accountNumber: string | null) {
  return useQuery({
    queryKey: placesKeys.owners(accountNumber ?? ''),
    queryFn: ({signal}) => fetchBusinessOwners(accountNumber!, {signal}),
    staleTime: STALE_TIME.static,
    enabled: Boolean(accountNumber),
  });
}

export function useCommunityAreas(options: {enabled?: boolean} = {}) {
  return useQuery({
    queryKey: placesKeys.communityAreas(),
    queryFn: ({signal}) => fetchCommunityAreas({signal}),
    staleTime: STALE_TIME.static,
    enabled: options.enabled ?? true,
  });
}

export function useCommunityAreaNames() {
  return useQuery({
    queryKey: placesKeys.communityAreaNames(),
    queryFn: ({signal}) => fetchCommunityAreaNames({signal}),
    staleTime: STALE_TIME.static,
  });
}

export function useParcelByPin(pin: string | null) {
  return useQuery({
    queryKey: placesKeys.parcelByPin(pin ?? ''),
    queryFn: ({signal}) => fetchParcelByPin(pin!, {signal}),
    staleTime: STALE_TIME.static,
    enabled: Boolean(pin),
  });
}

export function useParcelsByAddress(address: string | null) {
  return useQuery({
    queryKey: placesKeys.parcelsByAddress(address ?? ''),
    queryFn: ({signal}) => fetchParcelsByAddress(address!, {signal}),
    staleTime: STALE_TIME.static,
    enabled: Boolean(address && address.trim().length > 3),
  });
}

export function useParcelClass(pin: string | null) {
  return useQuery({
    queryKey: placesKeys.parcelClass(pin ?? ''),
    queryFn: ({signal}) => fetchParcelClass(pin!, {signal}),
    staleTime: STALE_TIME.static,
    enabled: Boolean(pin),
  });
}

/** Typeahead geocoding. Debounce `query` in the component, not here. */
export function useGeocode(query: string, options: {enabled?: boolean} = {}) {
  return useQuery({
    queryKey: placesKeys.geocode(query),
    queryFn: ({signal}) => geocode(query, {signal}),
    staleTime: STALE_TIME.static,
    enabled: (options.enabled ?? true) && query.trim().length >= 2,
  });
}

export function useReverseGeocode(coordinates: [number, number] | null) {
  const [lng, lat] = coordinates ?? [0, 0];
  return useQuery({
    queryKey: placesKeys.reverseGeocode(lng, lat),
    queryFn: ({signal}) => reverseGeocode(lng, lat, {signal}),
    staleTime: STALE_TIME.static,
    enabled: Boolean(coordinates),
  });
}
