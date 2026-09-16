/**
 * Bandsintown — concerts by location.
 *
 * Docs: https://help.artists.bandsintown.com/en/articles/9186477-api-documentation
 * OpenAPI: https://app.swaggerhub.com/apis/Bandsintown/PublicAPI/3.0.0
 *
 * ⚠️ PARTIALLY UNVERIFIED. The request shape below follows the published docs
 * (`GET https://rest.bandsintown.com/events?app_id=…&location=…`), but it
 * could not be exercised without a real app_id: the endpoint sits behind AWS
 * API Gateway, which answers every unauthenticated request with
 * `403 {"message":"Missing Authentication Token"}` whether or not the route
 * exists. The *response* field names are therefore taken from the docs, not
 * observed. Check them against a live response before relying on this, and
 * note that location search may require an Amplified/partner app_id rather
 * than a public one.
 */
import {requireEnv} from '../env';
import {fetchJson} from '../http';
import {toCoordinates, toDate} from '../parse';
import type {LocalEvent} from './ticketmaster';

const BASE_URL = 'https://rest.bandsintown.com';

export type BandsintownEventRow = {
  id: string;
  artist_id?: string;
  url?: string;
  title?: string;
  datetime?: string;
  description?: string;
  artist?: {name?: string; image_url?: string; thumb_url?: string};
  venue?: {
    name?: string;
    latitude?: string | number;
    longitude?: string | number;
    city?: string;
    region?: string;
    country?: string;
    street_address?: string;
  };
  lineup?: string[];
};

export type BandsintownQuery = {
  /** "Chicago,IL" — the docs take a city string, not a lat/long pair. */
  location?: string;
  /** Miles. */
  radius?: number;
  /** ISO date range as "YYYY-MM-DD,YYYY-MM-DD", or a keyword like 'upcoming'. */
  date?: string;
  signal?: AbortSignal;
};

export async function fetchBandsintownEvents(
  query: BandsintownQuery = {},
): Promise<LocalEvent[]> {
  const rows = await fetchJson<BandsintownEventRow[]>(`${BASE_URL}/events`, {
    query: {
      app_id: requireEnv('BANDSINTOWN_APP_ID'),
      location: query.location ?? 'Chicago,IL',
      radius: query.radius,
      date: query.date,
    },
    signal: query.signal,
  });

  // Defensive: the docs show an array, but an error payload is an object.
  return Array.isArray(rows) ? rows.map(toLocalEvent) : [];
}

function toLocalEvent(row: BandsintownEventRow): LocalEvent {
  const [longitude, latitude] =
    toCoordinates(row.venue?.longitude, row.venue?.latitude) ?? [null, null];

  return {
    source: 'bandsintown',
    id: String(row.id),
    title: row.title || row.artist?.name || row.lineup?.[0] || 'Untitled event',
    startsAt: toDate(row.datetime),
    venueName: row.venue?.name ?? null,
    address:
      [row.venue?.street_address, row.venue?.city, row.venue?.region]
        .filter(Boolean)
        .join(', ') || null,
    latitude,
    longitude,
    imageUrl: row.artist?.image_url ?? row.artist?.thumb_url ?? null,
    url: row.url ?? null,
    category: 'Music',
  };
}
