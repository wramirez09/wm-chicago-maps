/**
 * CTA Bus Tracker API v2 (BusTime).
 *
 * Docs: https://www.transitchicago.com/developers/bustracker/
 * Developer guide (PDF): https://www.transitchicago.com/assets/1/6/cta_Bus_Tracker_API_Developer_Guide_and_Documentation_20160929.pdf
 *
 * Like Train Tracker, errors arrive as HTTP 200 — here inside
 * `bustime-response.error[]`. Timestamps use BusTime's own
 * "YYYYMMDD HH:mm(:ss)" format, not ISO 8601.
 */
import {requireEnv} from '../env';
import {ApiError, fetchJson} from '../http';

const BASE_URL = 'https://www.ctabustracker.com/bustime/api/v2';

type BusTimeEnvelope<K extends string, T> = {
  'bustime-response': Partial<Record<K, T[]>> & {
    error?: {msg?: string; rt?: string; stpid?: string}[];
  };
};

export type CtaBusPredictionRow = {
  tmstmp: string;
  /** 'A' = arrival, 'D' = departure. */
  typ: 'A' | 'D';
  stpnm: string;
  stpid: string;
  vid: string;
  dstp: number;
  rt: string;
  rtdd: string;
  rtdir: string;
  des: string;
  prdtm: string;
  /** Minutes away as a string, or 'DUE'. */
  prdctdn: string;
  /** Delay flag. */
  dly?: boolean;
  zone?: string;
  tablockid?: string;
  tatripid?: string;
};

export type CtaBusVehicleRow = {
  vid: string;
  tmstmp: string;
  lat: string;
  lon: string;
  hdg: string;
  pid: number;
  rt: string;
  des: string;
  pdist: number;
  dly?: boolean;
  tatripid?: string;
  tablockid?: string;
  zone?: string;
};

export type BusPrediction = {
  stopId: string;
  stopName: string;
  vehicleId: string;
  route: string;
  routeDirection: string;
  destination: string;
  predictedAt: Date;
  /** null when BusTime says 'DUE'. */
  minutesAway: number | null;
  isDue: boolean;
  isDelayed: boolean;
  type: 'arrival' | 'departure';
};

export type BusVehicle = {
  vehicleId: string;
  route: string;
  destination: string;
  latitude: number;
  longitude: number;
  heading: number;
  reportedAt: Date;
  isDelayed: boolean;
};

/** Predictions for one or more stops. BusTime caps a request at 10 stops. */
export async function fetchBusPredictions(
  stopIds: (string | number)[],
  options: {route?: string; max?: number; signal?: AbortSignal} = {},
): Promise<BusPrediction[]> {
  if (stopIds.length === 0) {
    return [];
  }

  const response = await fetchJson<
    BusTimeEnvelope<'prd', CtaBusPredictionRow>
  >(`${BASE_URL}/getpredictions`, {
    query: {
      key: requireEnv('CTA_BUS_KEY'),
      stpid: stopIds.slice(0, 10).join(','),
      rt: options.route,
      top: options.max,
      format: 'json',
    },
    signal: options.signal,
  });

  const body = assertOk(response, 'getpredictions');
  return (body.prd ?? []).map(toPrediction);
}

/** Live vehicles on one or more routes. BusTime caps a request at 10 routes. */
export async function fetchBusVehicles(
  routes: string[],
  options: {signal?: AbortSignal} = {},
): Promise<BusVehicle[]> {
  if (routes.length === 0) {
    return [];
  }

  const response = await fetchJson<
    BusTimeEnvelope<'vehicle', CtaBusVehicleRow>
  >(`${BASE_URL}/getvehicles`, {
    query: {
      key: requireEnv('CTA_BUS_KEY'),
      rt: routes.slice(0, 10).join(','),
      format: 'json',
    },
    signal: options.signal,
  });

  const body = assertOk(response, 'getvehicles');
  return (body.vehicle ?? []).map(toVehicle);
}

function assertOk<K extends string, T>(
  response: BusTimeEnvelope<K, T>,
  endpoint: string,
) {
  const body = response['bustime-response'];

  if (!body) {
    throw new ApiError(`CTA Bus Tracker returned no bustime-response`, {
      status: 502,
      url: `${BASE_URL}/${endpoint}`,
    });
  }

  // BusTime reports "no predictions for this stop" as an error too, which is a
  // normal empty state rather than a failure — so only a request-level problem
  // (bad key, bad parameters) is raised.
  const errors = body.error ?? [];
  const fatal = errors.filter(e => !isEmptyResult(e.msg));

  if (fatal.length > 0) {
    throw new ApiError(
      `CTA Bus Tracker error: ${fatal.map(e => e.msg ?? 'unknown').join('; ')}`,
      {status: 502, url: `${BASE_URL}/${endpoint}`},
    );
  }

  return body;
}

function isEmptyResult(message: string | undefined): boolean {
  const text = (message ?? '').toLowerCase();
  return (
    text.includes('no arrival times') ||
    text.includes('no service scheduled') ||
    text.includes('no data found')
  );
}

function toPrediction(row: CtaBusPredictionRow): BusPrediction {
  const isDue = row.prdctdn.toUpperCase() === 'DUE';
  const minutes = Number(row.prdctdn);

  return {
    stopId: row.stpid,
    stopName: row.stpnm,
    vehicleId: row.vid,
    route: row.rt,
    routeDirection: row.rtdir,
    destination: row.des,
    predictedAt: parseBusTime(row.prdtm),
    minutesAway: isDue || !Number.isFinite(minutes) ? null : minutes,
    isDue,
    isDelayed: row.dly === true,
    type: row.typ === 'D' ? 'departure' : 'arrival',
  };
}

function toVehicle(row: CtaBusVehicleRow): BusVehicle {
  return {
    vehicleId: row.vid,
    route: row.rt,
    destination: row.des,
    latitude: Number(row.lat),
    longitude: Number(row.lon),
    heading: Number(row.hdg),
    reportedAt: parseBusTime(row.tmstmp),
    isDelayed: row.dly === true,
  };
}

/**
 * BusTime timestamps are "20260916 12:35" or "20260916 12:35:07" — not
 * parseable by `new Date()`, which returns Invalid Date for them. Converted to
 * local time, consistent with the Train Tracker client.
 */
export function parseBusTime(value: string): Date {
  const match = /^(\d{4})(\d{2})(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value.trim(),
  );

  if (!match) {
    return new Date(NaN);
  }

  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? '0'),
  );
}
