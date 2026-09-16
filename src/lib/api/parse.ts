/**
 * Coercion helpers shared by the clients.
 *
 * These exist because `Number('')` is 0, not NaN. Several of these APIs return
 * an empty string for "no value" — an address with no geocode, a venue with no
 * location — and a naive `Number(...)` turns that into coordinates (0, 0),
 * which is a real point in the Gulf of Guinea. Pins silently appear off the
 * coast of Africa instead of being dropped.
 */

/** A finite number, or null for undefined/null/empty/non-numeric input. */
export function toNumber(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * A [longitude, latitude] pair, or null if either is missing or out of range.
 * The range check also rejects the (0, 0) that a blank string would produce
 * if it ever got this far.
 */
export function toCoordinates(
  longitude: unknown,
  latitude: unknown,
): [number, number] | null {
  const lng = toNumber(longitude);
  const lat = toNumber(latitude);

  if (lng === null || lat === null) {
    return null;
  }
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    return null;
  }
  return [lng, lat];
}

/** A Date, or null when the input is missing or unparseable. */
export function toDate(value: string | undefined | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
