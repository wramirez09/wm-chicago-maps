/**
 * Turning API results into the GeoJSON that MapLibre sources expect.
 *
 * The clients in src/lib/api return plain rows, because that is the useful
 * shape for lists and detail screens. Only the map needs FeatureCollections,
 * so the conversion lives here rather than in the clients.
 */

/**
 * MapLibre's native renderer only understands integer feature ids and drops
 * features with string ids, so identifiers are carried in `properties`.
 */
export function toPointCollection<T>(
  rows: T[],
  getCoordinates: (row: T) => [number, number] | null,
): GeoJSON.FeatureCollection<GeoJSON.Point, T> {
  const features: GeoJSON.Feature<GeoJSON.Point, T>[] = [];

  for (const row of rows) {
    const coordinates = getCoordinates(row);
    if (!coordinates) {
      continue;
    }
    features.push({
      type: 'Feature',
      properties: row,
      geometry: {type: 'Point', coordinates},
    });
  }

  return {type: 'FeatureCollection', features};
}

/** An empty collection, for a source whose query has not resolved yet. */
export const EMPTY_COLLECTION: GeoJSON.FeatureCollection<GeoJSON.Point, never> = {
  type: 'FeatureCollection',
  features: [],
};

/**
 * Snap a bounding box *outward* to a grid.
 *
 * Every pan emits a slightly different viewport, and a bbox is part of the
 * query key — so without snapping, nudging the map a few pixels misses the
 * cache and refetches the same data. Snapping outward (floor the minimums,
 * ceil the maximums) keeps the snapped box a superset of what is on screen, so
 * nothing visible is ever cut off.
 *
 * 0.01° is roughly 1.1 km north–south at Chicago's latitude.
 */
export function snapBBox(
  [west, south, east, north]: [number, number, number, number],
  step = 0.01,
): [number, number, number, number] {
  const floor = (v: number) => Math.floor(v / step) * step;
  const ceil = (v: number) => Math.ceil(v / step) * step;
  const round = (v: number) => Number(v.toFixed(5));

  return [round(floor(west)), round(floor(south)), round(ceil(east)), round(ceil(north))];
}

/** Round a coordinate so small pans share one weather lookup. */
export function roundCoordinate(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
