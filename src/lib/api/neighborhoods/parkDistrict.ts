/**
 * Chicago Park District — outdoor event permits and park facilities.
 *
 * Event permits: https://data.cityofchicago.org/d/pk66-w54g
 * Parks (facilities/features): https://data.cityofchicago.org/d/ejsh-fztr
 *
 * The Park District has no standalone events API; what exists on the open data
 * portal is the outdoor event *permit* register, which is the closest public
 * equivalent — it lists what has been booked in each park and when.
 *
 * Facilities are not a separate dataset: the parks polygon layer carries ~70
 * boolean feature columns (`playground`, `pool_indoo`, `dog_friend`, …), each
 * holding a count as a string.
 */
import {toIntegerString} from '../parse';
import {andWhere, socrataQuery} from '../places/socrata';
import type {LocalEvent} from '../events/ticketmaster';

export const PARK_EVENT_PERMITS_DATASET = 'pk66-w54g';
export const PARKS_DATASET = 'ejsh-fztr';

export type ParkEventPermitRow = {
  requestor_?: string;
  organization?: string;
  park_number?: string;
  park_facility_name?: string;
  reservation_start_date?: string;
  reservation_end_date?: string;
  event_type?: string;
  event_description?: string;
  permit_status?: string;
};

export type ParkEventQuery = {
  /** Defaults to today, so the feed shows what is coming rather than history. */
  from?: Date;
  to?: Date;
  parkNumber?: string;
  limit?: number;
  signal?: AbortSignal;
};

export async function fetchParkEventPermits(
  query: ParkEventQuery = {},
): Promise<LocalEvent[]> {
  const from = query.from ?? new Date();
  // Callers often hold the parks dataset's "2.0"; permits store "2".
  const parkNumber = toIntegerString(query.parkNumber);

  const rows = await socrataQuery<ParkEventPermitRow>({
    datasetId: PARK_EVENT_PERMITS_DATASET,
    where: andWhere(
      `reservation_start_date >= '${isoDate(from)}'`,
      query.to ? `reservation_start_date <= '${isoDate(query.to)}'` : undefined,
      parkNumber ? `park_number = '${parkNumber}'` : undefined,
      // Cancelled and pending permits are not events anyone can attend.
      "upper(permit_status) = 'APPROVED'",
    ),
    order: 'reservation_start_date',
    limit: query.limit ?? 200,
    signal: query.signal,
  });

  return rows.map(toLocalEvent);
}

/** The feature columns on the parks dataset that are set for a given park. */
export async function fetchParkFacilities(
  parkNumber: string,
  options: {signal?: AbortSignal} = {},
): Promise<string[]> {
  const normalized = toIntegerString(parkNumber);
  if (!normalized) {
    return [];
  }

  const rows = await socrataQuery<Record<string, string>>({
    datasetId: PARKS_DATASET,
    where: `park_no = '${normalized}'`,
    limit: 1,
    signal: options.signal,
  });

  const row = rows[0];
  if (!row) {
    return [];
  }

  const NON_FEATURE_COLUMNS = new Set([
    'the_geom', 'objectid_1', 'park_no', 'park', 'location', 'zip', 'acres',
    'ward', 'park_class', 'label', 'gisobjid', 'perimeter', 'shape_leng',
    'shape_area',
  ]);

  return Object.entries(row)
    .filter(([key, value]) => !NON_FEATURE_COLUMNS.has(key) && Number(value) > 0)
    .map(([key]) => key)
    .sort();
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toLocalEvent(row: ParkEventPermitRow): LocalEvent {
  const startsAt = row.reservation_start_date
    ? new Date(row.reservation_start_date)
    : null;

  return {
    source: 'chicago-parks',
    // The dataset has no stable row id, so one is derived from the fields that
    // together identify a booking.
    id: [row.park_number, row.reservation_start_date, row.organization]
      .filter(Boolean)
      .join('|'),
    title: row.event_description || row.event_type || 'Park event',
    startsAt: startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : null,
    venueName: row.park_facility_name ?? null,
    address: null,
    latitude: null,
    longitude: null,
    imageUrl: null,
    url: null,
    category: row.event_type ?? null,
  };
}
