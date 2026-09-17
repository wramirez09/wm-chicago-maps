/**
 * VENDORED from wramirez09/wm-chicago-maps-backend packages/shared/src/events.ts
 * at commit 9e2c168ba920e9c02c806781f9c7c2fb776b4066. Do not edit here — change the backend and re-vendor.
 *
 * Only change from upstream: relative imports drop their ".js" suffix. The
 * backend is NodeNext ESM, where "./common.js" resolves to common.ts; Metro
 * does not do that mapping and fails to resolve the ".js" path.
 */
import { z } from 'zod';
import { BboxParam, PointGeometry, Uuid, feature, featureCollection } from './common';

export const EventSource = z.enum(['owner', 'park_district', 'ticketmaster', 'bandsintown', 'community']);
export const EventSummary = z.object({
  id: Uuid,
  title: z.string(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  venueName: z.string().nullable(),
  placeId: Uuid.nullable(),
  source: EventSource,
  url: z.string().nullable(),
  free: z.boolean().nullable(),
});
export const EventFeature = feature(PointGeometry, EventSummary);
export const EventCollection = featureCollection(EventFeature);
export const EventsQuery = z.object({
  bbox: BboxParam,
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
