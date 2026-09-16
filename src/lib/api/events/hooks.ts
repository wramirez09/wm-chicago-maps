/**
 * TanStack Query hooks for the events clients.
 *
 * Events are not live data — a listing changes over days, not seconds — so the
 * 24h `static` staleTime applies. `useLocalEvents` merges the public sources
 * into one feed; Eventbrite stays out of it because it only ever returns
 * events the signed-in organiser owns.
 */
import {useQueries, useQuery} from '@tanstack/react-query';

import {STALE_TIME} from '../../query';
import {fetchParkEventPermits} from '../neighborhoods/parkDistrict';
import {fetchBandsintownEvents, type BandsintownQuery} from './bandsintown';
import {
  fetchEventbriteOrganizationEvents,
  type EventbriteQuery,
} from './eventbrite';
import {
  fetchTicketmasterEvents,
  type LocalEvent,
  type TicketmasterQuery,
} from './ticketmaster';

export const eventKeys = {
  ticketmaster: (query: Omit<TicketmasterQuery, 'signal'>) =>
    ['events', 'ticketmaster', query] as const,
  bandsintown: (query: Omit<BandsintownQuery, 'signal'>) =>
    ['events', 'bandsintown', query] as const,
  eventbrite: (query: EventbriteQuery) => ['events', 'eventbrite', query] as const,
  parks: () => ['events', 'parks'] as const,
};

export function useTicketmasterEvents(
  query: Omit<TicketmasterQuery, 'signal'>,
  options: {enabled?: boolean} = {},
) {
  return useQuery({
    queryKey: eventKeys.ticketmaster(query),
    queryFn: ({signal}) => fetchTicketmasterEvents({...query, signal}),
    staleTime: STALE_TIME.static,
    enabled: options.enabled ?? true,
  });
}

export function useBandsintownEvents(
  query: Omit<BandsintownQuery, 'signal'> = {},
  options: {enabled?: boolean} = {},
) {
  return useQuery({
    queryKey: eventKeys.bandsintown(query),
    queryFn: ({signal}) => fetchBandsintownEvents({...query, signal}),
    staleTime: STALE_TIME.static,
    enabled: options.enabled ?? true,
  });
}

export function useEventbriteOrganizationEvents(
  query: EventbriteQuery | null,
) {
  return useQuery({
    queryKey: eventKeys.eventbrite(query ?? {organizationId: ''}),
    queryFn: () => fetchEventbriteOrganizationEvents(query!),
    staleTime: STALE_TIME.static,
    enabled: Boolean(query?.organizationId),
  });
}

/**
 * All public sources for one point, merged and sorted by start time.
 *
 * `useQueries` rather than one combined queryFn so a source that is down — or
 * simply unconfigured, which is the normal case for Bandsintown until an
 * app_id exists — does not take the whole feed with it. `errors` reports which
 * ones failed so the UI can say so.
 */
export function useLocalEvents(
  center: {latitude: number; longitude: number},
  options: {radiusMiles?: number; includeParks?: boolean; enabled?: boolean} = {},
) {
  const {radiusMiles = 10, includeParks = true, enabled = true} = options;

  const ticketmasterQuery = {
    latitude: center.latitude,
    longitude: center.longitude,
    radius: radiusMiles,
  };

  const results = useQueries({
    queries: [
      {
        queryKey: eventKeys.ticketmaster(ticketmasterQuery),
        queryFn: ({signal}: {signal: AbortSignal}) =>
          fetchTicketmasterEvents({...ticketmasterQuery, signal}),
        staleTime: STALE_TIME.static,
        enabled,
      },
      {
        queryKey: eventKeys.parks(),
        queryFn: ({signal}: {signal: AbortSignal}) =>
          fetchParkEventPermits({signal}),
        staleTime: STALE_TIME.static,
        enabled: enabled && includeParks,
      },
    ],
  });

  const events: LocalEvent[] = results
    .flatMap(result => (result.data as LocalEvent[] | undefined) ?? [])
    .sort((a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0));

  return {
    events,
    isLoading: results.some(r => r.isLoading),
    isError: results.every(r => r.isError),
    errors: results.map(r => r.error).filter((e): e is Error => Boolean(e)),
  };
}
