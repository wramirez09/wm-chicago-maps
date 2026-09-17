/**
 * Walking directions from GET /v1/route.
 *
 * Imperative rather than a hook: a route is requested by a button press, for
 * a specific origin and destination, not kept in sync with render.
 */
import {RouteResult} from '@wm/shared';

import {ApiError, apiRequest} from './client';
import type {RouteResult as RouteResultData} from './types';

type LngLat = readonly [number, number];

export async function fetchWalkingRoute(
  from: LngLat,
  to: LngLat,
  signal?: AbortSignal,
): Promise<RouteResultData> {
  try {
    return await apiRequest('/v1/route', RouteResult, {
      query: {from: `${from[0]},${from[1]}`, to: `${to[0]},${to[1]}`, mode: 'walk'},
      signal,
    });
  } catch (error) {
    // A 5xx means the routing service is down or unconfigured, e.g. the local
    // backend answers `502 valhalla unavailable`. That text means nothing to
    // someone asking for directions; a 4xx message (a bad point) is kept.
    if (error instanceof ApiError && (error.statusCode >= 500 || error.statusCode === 0)) {
      throw new ApiError(error.statusCode, 'Directions are unavailable right now.', error.url);
    }
    throw error;
  }
}
