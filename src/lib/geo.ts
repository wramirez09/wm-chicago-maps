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
 * Whether a point lies inside [west, south, east, north].
 *
 * Used to refuse following a user who is outside Chicago: native location
 * tracking moves the camera to the user and does not respect the Camera's
 * maxBounds, so following someone in San Francisco drags a Chicago map there.
 */
export function isInsideBounds(
  [longitude, latitude]: [number, number],
  [west, south, east, north]: readonly [number, number, number, number],
): boolean {
  return longitude >= west && longitude <= east && latitude >= south && latitude <= north;
}

type BoundsTuple = readonly [number, number, number, number];

/**
 * Whether the viewport moved enough to be worth refetching viewport data.
 *
 * "Enough" is more than `threshold` (10% by default) of the previous box, on
 * any axis: the centre shifting sideways or up/down, or the box growing or
 * shrinking (a zoom). Small pans and nudges reuse what is already loaded.
 */
export function bboxMovedSignificantly(
  previous: BoundsTuple,
  next: BoundsTuple,
  threshold = 0.1,
): boolean {
  const [pw, ps, pe, pn] = previous;
  const [nw, ns, ne, nn] = next;

  const width = pe - pw;
  const height = pn - ps;
  if (!(width > 0) || !(height > 0)) {
    return true;
  }

  const centerShiftX = Math.abs((nw + ne) / 2 - (pw + pe) / 2) / width;
  const centerShiftY = Math.abs((ns + nn) / 2 - (ps + pn) / 2) / height;
  const widthChange = Math.abs(ne - nw - width) / width;
  const heightChange = Math.abs(nn - ns - height) / height;

  // Epsilon, because degree arithmetic is float arithmetic: an exact 10% pan
  // computes as 0.10000000000000142 and would otherwise count as significant.
  return Math.max(centerShiftX, centerShiftY, widthChange, heightChange) > threshold + 1e-9;
}

/** Round each edge, so tiny float noise does not create a new query key. */
export function roundBbox(
  [west, south, east, north]: BoundsTuple,
  decimals = 5,
): [number, number, number, number] {
  const factor = 10 ** decimals;
  const round = (v: number) => Math.round(v * factor) / factor;
  return [round(west), round(south), round(east), round(north)];
}
