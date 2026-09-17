/**
 * VENDORED from wramirez09/wm-chicago-maps-backend packages/shared/src/layers.ts
 * at commit 9e2c168ba920e9c02c806781f9c7c2fb776b4066. Do not edit here — change the backend and re-vendor.
 *
 * Only change from upstream: relative imports drop their ".js" suffix. The
 * backend is NodeNext ESM, where "./common.js" resolves to common.ts; Metro
 * does not do that mapping and fails to resolve the ".js" path.
 */
import { z } from 'zod';
import { LineStringGeometry, PointGeometry, feature, featureCollection } from './common';

/**
 * Static map overlay layers that used to be bundled into the mobile app as
 * generated TypeScript. They are now ingested from OpenStreetMap into PostGIS
 * and served as GeoJSON with long cache lifetimes.
 */
export const LayerKey = z.enum(['expressways', 'arterials', 'transit-lines', 'transit-stations']);
export type LayerKey = z.infer<typeof LayerKey>;

export const ExpresswayProperties = z.object({
  name: z.string(),
  ref: z.string(),
  kind: z.enum(['motorway', 'trunk']),
  localName: z.string(),
});
export const ArterialProperties = z.object({ name: z.string(), kind: z.enum(['primary', 'secondary']) });
export const TransitLineProperties = z.object({ line: z.string(), color: z.string() });
export const TransitStationProperties = z.object({ name: z.string(), lines: z.string() });

export const ExpresswayCollection = featureCollection(feature(LineStringGeometry, ExpresswayProperties));
export const ArterialCollection = featureCollection(feature(LineStringGeometry, ArterialProperties));
export const TransitLineCollection = featureCollection(feature(LineStringGeometry, TransitLineProperties));
export const TransitStationCollection = featureCollection(feature(PointGeometry, TransitStationProperties));

export const LayerMeta = z.object({
  key: LayerKey,
  featureCount: z.number().int(),
  generatedAt: z.string().nullable(),
  attribution: z.string(),
});
export const LayerIndex = z.object({ layers: z.array(LayerMeta) });

/** Official CTA line colours; preferred over OSM's `colour` tag. */
export const CTA_LINE_COLORS = {
  Red: '#c60c30',
  Blue: '#00a1de',
  Brown: '#62361b',
  Green: '#009b3a',
  Orange: '#f9461c',
  Pink: '#e27ea6',
  Purple: '#522398',
  Yellow: '#f9e300',
} as const;
