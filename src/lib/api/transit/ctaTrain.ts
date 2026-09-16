/**
 * CTA Train Tracker — 'L' arrival predictions.
 *
 * Docs: https://www.transitchicago.com/developers/ttdocs/
 * Arrivals API: https://www.transitchicago.com/developers/ttdocs/#arrivals
 *
 * Two things this API does that the rest of the app does not expect:
 *
 * 1. Errors come back as HTTP 200 with `ctatt.errCd` set, so checking the
 *    status code alone reports "success" for an invalid key. `assertOk` below
 *    is what actually decides whether the call worked.
 * 2. Every field is a string, including booleans ('1'/'0') and coordinates.
 */
import {requireEnv} from '../env';
import {ApiError, fetchJson} from '../http';

const BASE_URL = 'https://lapi.transitchicago.com/api/1.0';

/** '1'/'0' string booleans, as returned by the API. */
type Flag = '1' | '0';

export type CtaTrainEtaRow = {
  staId: string;
  stpId: string;
  staNm: string;
  stpDe: string;
  /** Run number — identifies the physical train. */
  rn: string;
  /** Route code: Red, Blue, Brn, G, Org, P, Pink, Y. */
  rt: string;
  destSt: string;
  destNm: string;
  trDr: string;
  /** Prediction generated at (local time, ISO 8601 without a zone). */
  prdt: string;
  /** Predicted arrival time (local time, ISO 8601 without a zone). */
  arrT: string;
  /** Approaching: train is within ~1 block. */
  isApp: Flag;
  /** Scheduled, i.e. not a live prediction. */
  isSch: Flag;
  /** Delayed / holding. */
  isDly: Flag;
  isFlt: Flag;
  lat?: string;
  lon?: string;
  heading?: string;
};

export type CtaTrainResponse = {
  ctatt: {
    tmst?: string;
    errCd?: string;
    errNm?: string | null;
    eta?: CtaTrainEtaRow[];
  };
};

/** The row, parsed into the types the UI actually wants. */
export type TrainArrival = {
  stationId: string;
  stopId: string;
  stationName: string;
  stopDescription: string;
  runNumber: string;
  route: string;
  destination: string;
  /** Predicted arrival. */
  arrivalAt: Date;
  /** Whole minutes until arrival, floored at 0. */
  minutesAway: number;
  isApproaching: boolean;
  isScheduled: boolean;
  isDelayed: boolean;
  latitude: number | null;
  longitude: number | null;
};

export type TrainArrivalsQuery = {
  /** Parent station id (all platforms). Mutually exclusive with `stopId`. */
  mapId?: string | number;
  /** Single platform/direction. */
  stopId?: string | number;
  /** Filter to one route code, e.g. 'Red'. */
  route?: string;
  /** Max predictions returned. */
  max?: number;
  signal?: AbortSignal;
};

export async function fetchTrainArrivals(
  query: TrainArrivalsQuery,
): Promise<TrainArrival[]> {
  if (!query.mapId && !query.stopId) {
    throw new Error('fetchTrainArrivals needs either mapId or stopId');
  }

  const response = await fetchJson<CtaTrainResponse>(`${BASE_URL}/ttarrivals.aspx`, {
    query: {
      key: requireEnv('CTA_TRAIN_KEY'),
      mapid: query.mapId,
      stpid: query.stopId,
      rt: query.route,
      max: query.max,
      outputType: 'JSON',
    },
    signal: query.signal,
  });

  assertOk(response);
  return (response.ctatt.eta ?? []).map(toArrival);
}

/**
 * `errCd` is '0' on success. Anything else is a real failure delivered with a
 * 200, so it is converted into the same ApiError the rest of the app handles.
 */
function assertOk(response: CtaTrainResponse): void {
  const code = response.ctatt?.errCd;
  if (code && code !== '0') {
    throw new ApiError(`CTA Train Tracker error ${code}: ${response.ctatt.errNm ?? 'unknown'}`, {
      status: 502,
      url: `${BASE_URL}/ttarrivals.aspx`,
    });
  }
}

function toArrival(row: CtaTrainEtaRow): TrainArrival {
  const arrivalAt = parseCtaTime(row.arrT);
  const minutesAway = Math.max(
    0,
    Math.floor((arrivalAt.getTime() - Date.now()) / 60_000),
  );

  return {
    stationId: row.staId,
    stopId: row.stpId,
    stationName: row.staNm,
    stopDescription: row.stpDe,
    runNumber: row.rn,
    route: row.rt,
    destination: row.destNm,
    arrivalAt,
    minutesAway,
    isApproaching: row.isApp === '1',
    isScheduled: row.isSch === '1',
    isDelayed: row.isDly === '1',
    latitude: numberOrNull(row.lat),
    longitude: numberOrNull(row.lon),
  };
}

/**
 * CTA returns local Chicago time with no zone marker ("2026-09-16T12:35:25").
 * `new Date(...)` on that string is parsed as *device-local* time, which is
 * correct for a user in Chicago and wrong by the offset for anyone else — an
 * accepted simplification for a Chicago-only app, but the reason this is not
 * inlined.
 */
export function parseCtaTime(value: string): Date {
  return new Date(value);
}

function numberOrNull(value: string | undefined): number | null {
  if (value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
