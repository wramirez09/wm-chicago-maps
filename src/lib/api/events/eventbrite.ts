/**
 * Eventbrite — organiser-owned events only.
 *
 * Docs: https://www.eventbrite.com/platform/api
 * Organization events: https://www.eventbrite.com/platform/api#/reference/event/list/list-events-by-organization
 *
 * Eventbrite removed public event search from its API in December 2019; there
 * is no endpoint that answers "what is on near me". The only events reachable
 * are those owned by an organisation the user has authorised, which requires
 * an OAuth token.
 *
 * That token is a secret, so the app never holds it: this client calls the
 * `eventbrite` Supabase Edge Function, which performs the OAuth exchange and
 * the upstream request. See supabase/functions/eventbrite/index.ts.
 */
import {invokeFunction} from '../../supabase';
import {toCoordinates, toDate} from '../parse';
import type {LocalEvent} from './ticketmaster';

export type EventbriteEventRow = {
  id: string;
  name?: {text?: string};
  description?: {text?: string};
  url?: string;
  start?: {utc?: string; local?: string; timezone?: string};
  end?: {utc?: string};
  logo?: {url?: string; original?: {url?: string}};
  venue?: {
    name?: string;
    address?: {
      localized_address_display?: string;
      latitude?: string;
      longitude?: string;
    };
  };
  status?: string;
};

type EventbriteFunctionResponse = {
  events: EventbriteEventRow[];
  pagination?: {page_number?: number; page_count?: number; has_more_items?: boolean};
};

export type EventbriteQuery = {
  /** Eventbrite organisation id the signed-in user has connected. */
  organizationId: string;
  status?: 'live' | 'draft' | 'started' | 'ended' | 'all';
  page?: number;
};

export async function fetchEventbriteOrganizationEvents(
  query: EventbriteQuery,
): Promise<LocalEvent[]> {
  const response = await invokeFunction<EventbriteFunctionResponse>('eventbrite', {
    action: 'listOrganizationEvents',
    organizationId: query.organizationId,
    status: query.status ?? 'live',
    page: query.page ?? 1,
  });

  return (response.events ?? []).map(toLocalEvent);
}

function toLocalEvent(row: EventbriteEventRow): LocalEvent {
  const [longitude, latitude] =
    toCoordinates(row.venue?.address?.longitude, row.venue?.address?.latitude) ?? [null, null];

  return {
    source: 'eventbrite',
    id: row.id,
    title: row.name?.text ?? 'Untitled event',
    startsAt: toDate(row.start?.utc),
    venueName: row.venue?.name ?? null,
    address: row.venue?.address?.localized_address_display ?? null,
    latitude,
    longitude,
    imageUrl: row.logo?.original?.url ?? row.logo?.url ?? null,
    url: row.url ?? null,
    category: null,
  };
}
