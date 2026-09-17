/**
 * TypeScript types inferred from the backend contract (@wm/shared).
 *
 * The shared package exports zod schemas; these are their `z.infer` shapes,
 * replacing the hand-written property types that used to live beside the
 * generated data in src/data.
 */
import type {
  ArterialCollection as ArterialCollectionSchema,
  ArterialProperties as ArterialPropertiesSchema,
  ExpresswayCollection as ExpresswayCollectionSchema,
  ExpresswayProperties as ExpresswayPropertiesSchema,
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

export type ExpresswayCollection = z.infer<typeof ExpresswayCollectionSchema>;
export type ArterialCollection = z.infer<typeof ArterialCollectionSchema>;
export type TransitLineCollection = z.infer<typeof TransitLineCollectionSchema>;
export type TransitStationCollection = z.infer<typeof TransitStationCollectionSchema>;
