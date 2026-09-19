/**
 * TypeScript types inferred from the backend contract (@wm/shared).
 *
 * The shared package exports zod schemas; these are their `z.infer` shapes,
 * replacing the hand-written property types that used to live beside the
 * generated data in src/data.
 */
import type {
  AreaSummary as AreaSummarySchema,
  DivvyStation as DivvyStationSchema,
  EventCollection as EventCollectionSchema,
  EventSummary as EventSummarySchema,
  RouteResult as RouteResultSchema,
} from '@wm/shared';
import type {
  ArterialCollection as ArterialCollectionSchema,
  ArterialProperties as ArterialPropertiesSchema,
  BusRouteCollection as BusRouteCollectionSchema,
  BusRouteProperties as BusRoutePropertiesSchema,
  BusStopCollection as BusStopCollectionSchema,
  BusStopProperties as BusStopPropertiesSchema,
  ExpresswayCollection as ExpresswayCollectionSchema,
  ExpresswayProperties as ExpresswayPropertiesSchema,
  MetraLineCollection as MetraLineCollectionSchema,
  MetraLineProperties as MetraLinePropertiesSchema,
  MetraStationCollection as MetraStationCollectionSchema,
  MetraStationProperties as MetraStationPropertiesSchema,
  TransitLineCollection as TransitLineCollectionSchema,
  TransitLineProperties as TransitLinePropertiesSchema,
  TransitStationCollection as TransitStationCollectionSchema,
  TransitStationProperties as TransitStationPropertiesSchema,
} from '@wm/shared';
import type {z} from 'zod';

export type ExpresswayProperties = z.infer<typeof ExpresswayPropertiesSchema>;
export type ArterialProperties = z.infer<typeof ArterialPropertiesSchema>;
export type TransitLineProperties = z.infer<typeof TransitLinePropertiesSchema>;
export type TransitStationProperties = z.infer<typeof TransitStationPropertiesSchema>;
export type BusRouteProperties = z.infer<typeof BusRoutePropertiesSchema>;
export type BusStopProperties = z.infer<typeof BusStopPropertiesSchema>;
export type MetraLineProperties = z.infer<typeof MetraLinePropertiesSchema>;
export type MetraStationProperties = z.infer<typeof MetraStationPropertiesSchema>;

export type ExpresswayCollection = z.infer<typeof ExpresswayCollectionSchema>;
export type ArterialCollection = z.infer<typeof ArterialCollectionSchema>;
export type TransitLineCollection = z.infer<typeof TransitLineCollectionSchema>;
export type TransitStationCollection = z.infer<typeof TransitStationCollectionSchema>;
export type BusRouteCollection = z.infer<typeof BusRouteCollectionSchema>;
export type BusStopCollection = z.infer<typeof BusStopCollectionSchema>;
export type MetraLineCollection = z.infer<typeof MetraLineCollectionSchema>;
export type MetraStationCollection = z.infer<typeof MetraStationCollectionSchema>;

export type AreaSummary = z.infer<typeof AreaSummarySchema>;
export type DivvyStation = z.infer<typeof DivvyStationSchema>;
export type EventSummary = z.infer<typeof EventSummarySchema>;
export type EventCollection = z.infer<typeof EventCollectionSchema>;
export type RouteResult = z.infer<typeof RouteResultSchema>;
