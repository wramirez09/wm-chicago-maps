/**
 * VENDORED from wramirez09/wm-chicago-maps-backend packages/shared/src/geocode.ts
 * at commit 883b4f761de8a60baeb30757ea27cc49f92b3fef. Do not edit here — change the backend and re-vendor.
 *
 * Only change from upstream: relative imports drop their ".js" suffix. The
 * backend is NodeNext ESM, where "./common.js" resolves to common.ts; Metro
 * does not do that mapping and fails to resolve the ".js" path.
 */
import { z } from 'zod';
import { PointGeometry, feature, featureCollection } from './common';

/**
 * Address / place-name search proxied to Photon, restricted to Chicago on the
 * server (the app sends no bbox). Complements the app's local index of streets,
 * stations and landmarks, which cannot resolve "3525 S Honore".
 */
export const GeocodeQuery = z.object({
  q: z.string().trim().min(3).max(120),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});
export type GeocodeQuery = z.infer<typeof GeocodeQuery>;

export const GeocodeProperties = z.object({
  /** POI name; null for a plain address. */
  name: z.string().nullable(),
  /** Full display line: "<name>, <housenumber street>, <city>" with empty parts skipped. */
  label: z.string(),
});
export type GeocodeProperties = z.infer<typeof GeocodeProperties>;

export const GeocodeFeature = feature(PointGeometry, GeocodeProperties);
export type GeocodeFeature = z.infer<typeof GeocodeFeature>;

export const GeocodeCollection = featureCollection(GeocodeFeature);
export type GeocodeCollection = z.infer<typeof GeocodeCollection>;
