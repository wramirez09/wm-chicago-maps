/**
 * Metra GTFS-Realtime.
 *
 * Docs: https://metra.com/metra-gtfs-api  ·  https://metra.com/developers
 * Key request: https://metra.com/gtfs-realtime-api-key-request-license-agreement
 *
 * Host note: the old `gtfsapi.metrarail.com` was retired on 1 November 2025
 * and no longer resolves (NXDOMAIN). The current host is
 * `gtfspublic.metrarr.com`, verified: /gtfs/positions, /gtfs/tripUpdates and
 * /gtfs/alerts all answer 401 without a key, and /gtfs/raw/schedule.zip is
 * public.
 *
 * These endpoints return protobuf, not JSON, so they deliberately bypass
 * `fetchJson` and decode with gtfs-realtime-bindings.
 */
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

import {env, requireEnv} from '../env';
import {ApiError} from '../http';

const BASE_URL = 'https://gtfspublic.metrarr.com';

/** The static schedule is public; only the realtime feeds need a key. */
export const METRA_SCHEDULE_URL = `${BASE_URL}/gtfs/raw/schedule.zip`;

export type MetraFeed = 'positions' | 'tripUpdates' | 'alerts';

export type MetraVehiclePosition = {
  vehicleId: string;
  tripId: string | null;
  routeId: string | null;
  latitude: number;
  longitude: number;
  bearing: number | null;
  reportedAt: Date | null;
};

export type MetraTripUpdate = {
  tripId: string | null;
  routeId: string | null;
  stopTimeUpdates: {
    stopId: string | null;
    stopSequence: number | null;
    arrivalAt: Date | null;
    departureAt: Date | null;
    /** Seconds behind schedule; negative means early. */
    arrivalDelaySeconds: number | null;
  }[];
};

/**
 * Metra uses HTTP Basic auth: the API key is the username and the secret is
 * the password.
 */
function authHeader(): string {
  const user = requireEnv('METRA_KEY');
  const secret = env('METRA_SECRET') ?? '';
  return `Basic ${base64(`${user}:${secret}`)}`;
}

async function fetchFeedMessage(
  feed: MetraFeed,
  signal?: AbortSignal,
): Promise<GtfsRealtimeBindings.transit_realtime.FeedMessage> {
  const url = `${BASE_URL}/gtfs/${feed}`;
  const response = await fetch(url, {
    headers: {Authorization: authHeader(), Accept: 'application/x-protobuf'},
    signal,
  });

  if (!response.ok) {
    throw new ApiError(`HTTP ${response.status} for ${url}`, {
      status: response.status,
      url,
    });
  }

  const buffer = await response.arrayBuffer();

  try {
    return GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer),
    );
  } catch (error) {
    throw new ApiError(
      `Could not decode Metra ${feed} protobuf: ${
        error instanceof Error ? error.message : String(error)
      }`,
      {status: 502, url},
    );
  }
}

export async function fetchMetraVehiclePositions(
  options: {signal?: AbortSignal} = {},
): Promise<MetraVehiclePosition[]> {
  const message = await fetchFeedMessage('positions', options.signal);

  return message.entity
    .filter(entity => entity.vehicle?.position)
    .map(entity => {
      const vehicle = entity.vehicle!;
      const position = vehicle.position!;
      return {
        vehicleId: vehicle.vehicle?.id ?? entity.id,
        tripId: vehicle.trip?.tripId ?? null,
        routeId: vehicle.trip?.routeId ?? null,
        latitude: position.latitude,
        longitude: position.longitude,
        bearing: position.bearing ?? null,
        reportedAt: toDate(vehicle.timestamp),
      };
    });
}

export async function fetchMetraTripUpdates(
  options: {signal?: AbortSignal} = {},
): Promise<MetraTripUpdate[]> {
  const message = await fetchFeedMessage('tripUpdates', options.signal);

  return message.entity
    .filter(entity => entity.tripUpdate)
    .map(entity => {
      const update = entity.tripUpdate!;
      return {
        tripId: update.trip?.tripId ?? null,
        routeId: update.trip?.routeId ?? null,
        stopTimeUpdates: (update.stopTimeUpdate ?? []).map(stop => ({
          stopId: stop.stopId ?? null,
          stopSequence: stop.stopSequence ?? null,
          arrivalAt: toDate(stop.arrival?.time),
          departureAt: toDate(stop.departure?.time),
          arrivalDelaySeconds: stop.arrival?.delay ?? null,
        })),
      };
    });
}

/**
 * GTFS-RT times are POSIX seconds, and the bindings hand them back as `Long`
 * objects rather than numbers when the value exceeds 32 bits.
 */
function toDate(value: number | Long | null | undefined): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  const seconds = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(seconds) ? new Date(seconds * 1000) : null;
}

/**
 * React Native has no `Buffer`, and `globalThis.btoa` is not guaranteed on
 * every engine/version, so this falls back to encoding by hand. Base64 is
 * defined in terms of bit shifts, hence the scoped no-bitwise exemption.
 */
/* eslint-disable no-bitwise */
function base64(value: string): string {
  const globalBtoa = (globalThis as {btoa?: (input: string) => string}).btoa;
  if (globalBtoa) {
    return globalBtoa(value);
  }

  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let i = 0; i < value.length; i += 3) {
    const a = value.charCodeAt(i);
    const b = value.charCodeAt(i + 1);
    const c = value.charCodeAt(i + 2);
    const triplet = (a << 16) | ((Number.isNaN(b) ? 0 : b) << 8) | (Number.isNaN(c) ? 0 : c);

    output += chars[(triplet >> 18) & 63];
    output += chars[(triplet >> 12) & 63];
    output += Number.isNaN(b) ? '=' : chars[(triplet >> 6) & 63];
    output += Number.isNaN(c) ? '=' : chars[triplet & 63];
  }

  return output;
}
/* eslint-enable no-bitwise */
