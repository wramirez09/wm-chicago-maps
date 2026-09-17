/**
 * Valhalla routing — self-hosted.
 *
 * Route API: https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/
 * Isochrone API: https://valhalla.github.io/valhalla/api/isochrone/api-reference/
 *
 * Valhalla takes its request as a JSON object in a `json` query parameter on
 * GET, or as a POST body. POST is used here: Chicago-wide isochrone requests
 * exceed what is comfortable in a URL.
 */
import {requireEnv} from '../env';
import {ApiError, fetchJson} from '../http';

/** Valhalla's costing models, limited to the ones this app offers. */
export type TravelMode = 'pedestrian' | 'bicycle' | 'multimodal' | 'auto';

export type LngLat = [number, number];

type ValhallaLocation = {lat: number; lon: number};

export type RouteLeg = {
  /** Encoded polyline, precision 6 — note Valhalla's default is *not* 1e5. */
  shape: string;
  distanceKm: number;
  durationSeconds: number;
  maneuvers: {
    instruction: string;
    distanceKm: number;
    durationSeconds: number;
  }[];
};

export type RouteResult = {
  mode: TravelMode;
  distanceKm: number;
  durationSeconds: number;
  legs: RouteLeg[];
};

type ValhallaRouteResponse = {
  trip?: {
    legs?: {
      shape?: string;
      summary?: {length?: number; time?: number};
      maneuvers?: {
        instruction?: string;
        length?: number;
        time?: number;
      }[];
    }[];
    summary?: {length?: number; time?: number};
    status?: number;
    status_message?: string;
  };
  error?: string;
  error_code?: number;
};

/**
 * A routing failure with a message fit to show the user.
 *
 * Valhalla reports problems as HTTP 400 with a JSON body such as
 *   {"error_code":154,"error":"Path distance exceeds the max distance limit: 100000 meters"}
 * fetchJson turns that into an ApiError whose message is only "HTTP 400 for
 * <url>", which is what reached the screen. The body carries the real reason.
 */
export class ValhallaError extends Error {
  readonly code: number | undefined;

  constructor(message: string, code?: number) {
    super(message);
    this.name = 'ValhallaError';
    this.code = code;
  }
}

/** Error codes worth rewording. Anything else shows Valhalla's own text. */
const FRIENDLY_MESSAGES: Record<number, string> = {
  // Verified against the public FOSSGIS instance, which caps walking routes
  // at 100 km. The limit is server configuration, so it is not quoted here.
  154: 'That is too far to walk from here.',
};

async function withValhallaErrors<T>(request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (error) {
    if (!(error instanceof ApiError) || !error.body) {
      throw error;
    }

    let parsed: {error_code?: number; error?: string};
    try {
      parsed = JSON.parse(error.body);
    } catch {
      throw error;
    }

    const code = parsed.error_code;
    const message = (code !== undefined && FRIENDLY_MESSAGES[code]) || parsed.error;
    throw message ? new ValhallaError(message, code) : error;
  }
}

function baseUrl(): string {
  return requireEnv('VALHALLA_URL').replace(/\/+$/, '');
}

function toLocation([lon, lat]: LngLat): ValhallaLocation {
  return {lat, lon};
}

export async function fetchRoute(
  from: LngLat,
  to: LngLat,
  options: {mode?: TravelMode; signal?: AbortSignal} = {},
): Promise<RouteResult> {
  const mode = options.mode ?? 'pedestrian';

  const response = await withValhallaErrors(
    fetchJson<ValhallaRouteResponse>(`${baseUrl()}/route`, {
    method: 'POST',
    body: {
      locations: [toLocation(from), toLocation(to)],
      costing: mode,
      units: 'kilometers',
      directions_options: {units: 'kilometers'},
    },
      // Routing is not idempotent-cheap on a small self-hosted box; one attempt.
      retry: false,
      timeoutMs: 20_000,
      signal: options.signal,
    }),
  );

  if (response.error) {
    throw new Error(`Valhalla route failed: ${response.error}`);
  }

  const legs = response.trip?.legs ?? [];

  return {
    mode,
    distanceKm: response.trip?.summary?.length ?? 0,
    durationSeconds: response.trip?.summary?.time ?? 0,
    legs: legs.map(leg => ({
      shape: leg.shape ?? '',
      distanceKm: leg.summary?.length ?? 0,
      durationSeconds: leg.summary?.time ?? 0,
      maneuvers: (leg.maneuvers ?? []).map(m => ({
        instruction: m.instruction ?? '',
        distanceKm: m.length ?? 0,
        durationSeconds: m.time ?? 0,
      })),
    })),
  };
}

export type IsochroneOptions = {
  mode?: TravelMode;
  /** Contour bands in minutes, e.g. [5, 10, 15]. */
  minutes?: number[];
  /** Polygons instead of lines — what you want for a fill layer. */
  polygons?: boolean;
  signal?: AbortSignal;
};

export type IsochroneProperties = {
  contour?: number;
  color?: string;
  opacity?: number;
  metric?: string;
};

/**
 * Travel-time bands around a point, as GeoJSON ready to hand to MapLibre.
 * Contours come back largest-first, which is the order you want for drawing:
 * later (smaller) bands paint on top.
 */
export async function fetchIsochrone(
  center: LngLat,
  options: IsochroneOptions = {},
): Promise<GeoJSON.FeatureCollection<GeoJSON.Geometry, IsochroneProperties>> {
  const {mode = 'pedestrian', minutes = [5, 10, 15], polygons = true, signal} = options;

  return withValhallaErrors(
    fetchJson<GeoJSON.FeatureCollection<GeoJSON.Geometry, IsochroneProperties>>(
      `${baseUrl()}/isochrone`,
      {
        method: 'POST',
        body: {
          locations: [toLocation(center)],
          costing: mode,
          contours: minutes.map(time => ({time})),
          polygons,
        },
        retry: false,
        timeoutMs: 30_000,
        signal,
      },
    ),
  );
}
