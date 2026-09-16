/**
 * Ticketmaster Discovery API v2 — events near a point.
 *
 * Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 *
 * The consumer key is a publishable identifier and ships on-device. Errors
 * arrive as HTTP 401 with a `fault` body, which fetchJson surfaces as an
 * ApiError — no envelope checking needed here, unlike the CTA clients.
 */
import {requireEnv} from '../env';
import {fetchJson} from '../http';
import {toCoordinates, toDate} from '../parse';

const BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

export type TicketmasterEventRow = {
  id: string;
  name: string;
  url?: string;
  info?: string;
  dates?: {
    start?: {dateTime?: string; localDate?: string; localTime?: string};
    timezone?: string;
    status?: {code?: string};
  };
  images?: {url: string; width?: number; height?: number; ratio?: string}[];
  classifications?: {
    segment?: {name?: string};
    genre?: {name?: string};
  }[];
  _embedded?: {
    venues?: {
      name?: string;
      address?: {line1?: string};
      city?: {name?: string};
      state?: {stateCode?: string};
      postalCode?: string;
      location?: {latitude?: string; longitude?: string};
    }[];
  };
};

type TicketmasterSearchResponse = {
  _embedded?: {events?: TicketmasterEventRow[]};
  page?: {size: number; totalElements: number; totalPages: number; number: number};
};

/** The normalised shape every events source in this app converges on. */
export type LocalEvent = {
  source: 'ticketmaster' | 'bandsintown' | 'eventbrite' | 'chicago-parks';
  id: string;
  title: string;
  startsAt: Date | null;
  venueName: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  url: string | null;
  category: string | null;
};

export type TicketmasterQuery = {
  latitude: number;
  longitude: number;
  /** Radius in the given unit; Ticketmaster caps this at 19,999. */
  radius?: number;
  unit?: 'miles' | 'km';
  startDateTime?: Date;
  endDateTime?: Date;
  size?: number;
  page?: number;
  keyword?: string;
  signal?: AbortSignal;
};

export async function fetchTicketmasterEvents(
  query: TicketmasterQuery,
): Promise<LocalEvent[]> {
  const response = await fetchJson<TicketmasterSearchResponse>(
    `${BASE_URL}/events.json`,
    {
      query: {
        apikey: requireEnv('TICKETMASTER_KEY'),
        latlong: `${query.latitude},${query.longitude}`,
        radius: query.radius ?? 10,
        unit: query.unit ?? 'miles',
        startDateTime: toTicketmasterDate(query.startDateTime),
        endDateTime: toTicketmasterDate(query.endDateTime),
        size: query.size ?? 50,
        page: query.page,
        keyword: query.keyword,
        sort: 'date,asc',
      },
      signal: query.signal,
    },
  );

  return (response._embedded?.events ?? []).map(toLocalEvent);
}

/**
 * Ticketmaster wants ISO 8601 in UTC with no milliseconds
 * ("2026-09-16T12:00:00Z"); it rejects the fractional seconds that
 * `toISOString()` includes.
 */
function toTicketmasterDate(date: Date | undefined): string | undefined {
  return date ? `${date.toISOString().split('.')[0]}Z` : undefined;
}

function toLocalEvent(row: TicketmasterEventRow): LocalEvent {
  const venue = row._embedded?.venues?.[0];
  const [longitude, latitude] =
    toCoordinates(venue?.location?.longitude, venue?.location?.latitude) ?? [null, null];

  return {
    source: 'ticketmaster',
    id: row.id,
    title: row.name,
    startsAt: parseStart(row),
    venueName: venue?.name ?? null,
    address: [venue?.address?.line1, venue?.city?.name, venue?.state?.stateCode]
      .filter(Boolean)
      .join(', ') || null,
    latitude,
    longitude,
    imageUrl: largestImage(row),
    url: row.url ?? null,
    category:
      row.classifications?.[0]?.genre?.name ??
      row.classifications?.[0]?.segment?.name ??
      null,
  };
}

function parseStart(row: TicketmasterEventRow): Date | null {
  const start = row.dates?.start;
  if (!start) {
    return null;
  }

  // `dateTime` is a proper UTC instant. Some events are date-only (TBA time),
  // in which case only localDate is present.
  const raw = start.dateTime ?? (start.localDate ? `${start.localDate}T00:00:00` : null);
  if (!raw) {
    return null;
  }

  return toDate(raw);
}

function largestImage(row: TicketmasterEventRow): string | null {
  const images = row.images ?? [];
  if (images.length === 0) {
    return null;
  }
  return images.reduce((best, image) =>
    (image.width ?? 0) > (best.width ?? 0) ? image : best,
  ).url;
}
