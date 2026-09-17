/**
 * Address and place lookup from GET /v1/geocode.
 *
 * PROVISIONAL CONTRACT. The endpoint is being built in the backend alongside
 * this; until its schema is exported from @wm/shared and re-vendored, the
 * shape the app expects is defined here:
 *
 *   GET /v1/geocode?q=<text>&limit=<n>
 *   200 → FeatureCollection<Point, {name: string | null, label: string}>
 *
 * `label` is the full display line ("Nathanael Greene Elementary School,
 * 3525 South Honore Street, Chicago"); `name` is the POI name, null for a
 * plain address. Results are restricted to Chicago by the backend. When the
 * shared package gains `GeocodeCollection`, import it from '@wm/shared' and
 * delete the local schema below.
 */
import {PointGeometry, feature, featureCollection} from '@wm/shared';
import {z} from 'zod';

import {ApiError, apiRequest} from './client';

export const GeocodeProperties = z.object({
  name: z.string().nullable(),
  label: z.string(),
});
export const GeocodeCollection = featureCollection(feature(PointGeometry, GeocodeProperties));

/** Shortest query sent to the API. Two letters match half the city. */
export const GEOCODE_MIN_LENGTH = 3;

export type GeocodeResult = {
  id: string;
  title: string;
  /** The rest of the label, or the whole label when it is all title. */
  subtitle: string;
  center: [number, number];
};

export async function fetchGeocode(
  query: string,
  options: {limit?: number; signal?: AbortSignal} = {},
): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < GEOCODE_MIN_LENGTH) {
    return [];
  }

  try {
    const collection = await apiRequest('/v1/geocode', GeocodeCollection, {
      query: {q, limit: options.limit ?? 5},
      signal: options.signal,
    });
    return collection.features.map(toResult);
  } catch (error) {
    // 404 (endpoint not deployed yet), 5xx (geocoder down) and no network all
    // mean the same thing to someone typing: addresses are unavailable, while
    // the local index keeps working. The raw text would mean nothing to them.
    if (
      error instanceof ApiError &&
      (error.statusCode === 404 || error.statusCode >= 500 || error.statusCode === 0)
    ) {
      throw new ApiError(error.statusCode, 'Address search is unavailable right now.', error.url);
    }
    throw error;
  }
}

function toResult(
  {id, geometry, properties}: z.infer<typeof GeocodeCollection>['features'][number],
  index: number,
): GeocodeResult {
  const [lng, lat] = geometry.coordinates;
  const title = properties.name ?? properties.label.split(',')[0].trim();
  const rest = properties.label.startsWith(title)
    ? properties.label.slice(title.length).replace(/^,\s*/, '')
    : properties.label;

  return {
    // Photon-backed results carry no stable id when the backend omits one;
    // position plus coordinates is unique within a response.
    id: id !== undefined ? String(id) : `geocode:${index}:${lng},${lat}`,
    title,
    subtitle: rest || properties.label,
    center: [lng, lat],
  };
}
