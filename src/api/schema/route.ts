/**
 * VENDORED from wramirez09/wm-chicago-maps-backend packages/shared/src/route.ts
 * at commit 9e2c168ba920e9c02c806781f9c7c2fb776b4066. Do not edit here — change the backend and re-vendor.
 *
 * Only change from upstream: relative imports drop their ".js" suffix. The
 * backend is NodeNext ESM, where "./common.js" resolves to common.ts; Metro
 * does not do that mapping and fails to resolve the ".js" path.
 */
import { z } from 'zod';
import { LineStringGeometry } from './common';

const lngLatString = z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, 'expected lng,lat');
export const RouteQuery = z.object({
  from: lngLatString,
  to: lngLatString,
  mode: z.enum(['walk', 'bike', 'transit']).default('walk'),
});
export const RouteLeg = z.object({
  mode: z.string(),
  distanceMeters: z.number(),
  durationSeconds: z.number(),
  instructions: z.array(z.string()),
});
export const RouteResult = z.object({
  mode: z.string(),
  distanceMeters: z.number(),
  durationSeconds: z.number(),
  geometry: LineStringGeometry,
  legs: z.array(RouteLeg),
});
