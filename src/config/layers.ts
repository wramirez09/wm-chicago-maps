/**
 * The overlay layers, their identity and their colours.
 *
 * These live in config rather than inside the overlay components because three
 * unrelated places need them: the components themselves, the toggle chips, and
 * the search index (which has to colour a result for a layer it never renders).
 *
 * `LayerKey` here is what the *map* draws, which is not one-to-one with the
 * backend's layer keys: one chip can draw two API layers, and several chips
 * are not /v1/layers at all. LAYER_SOURCES maps between the two.
 */
import type {LayerKey as ApiLayerKey} from '@wm/shared';

export type LayerKey =
  | 'expressways'
  | 'arterials'
  | 'transit'
  | 'bus'
  | 'metra'
  | 'landmarks'
  | 'divvy'
  | 'events'
  | 'neighborhoods';

export type LayerVisibility = Record<LayerKey, boolean>;

/**
 * Which `GET /v1/layers/:key` collections each map layer draws.
 *
 * A chip is not one API layer: "CTA rail" is lines plus stations, and both
 * carry their own credit. Only layers served by /v1/layers appear here —
 * landmarks, Divvy, events and neighborhoods come from other endpoints and
 * carry their attribution (or none) with their own data.
 */
export const LAYER_SOURCES: Partial<Record<LayerKey, readonly ApiLayerKey[]>> = {
  expressways: ['expressways'],
  arterials: ['arterials'],
  transit: ['transit-lines', 'transit-stations'],
  bus: ['bus-routes', 'bus-stops'],
  metra: ['metra-lines', 'metra-stations'],
};

/**
 * Layers backed by a live API rather than committed data. They start hidden:
 * turning one on is what triggers its first network request, so the map still
 * opens instantly and offline.
 */
export const LIVE_LAYERS: LayerKey[] = [
  // Buses and Metra are the two heaviest layers in the city — every route and
  // every stop — so they wait to be asked for, like the live feeds do.
  'bus',
  'metra',
  'divvy',
  'events',
  'neighborhoods',
];

export const LAYER_ACCENT: Record<LayerKey, string> = {
  expressways: '#1d4ed8',
  arterials: '#b45309',
  transit: '#0f766e',
  bus: '#0b7285',
  metra: '#4c1d95',
  landmarks: '#e4572e',
  divvy: '#0b6bcb',
  events: '#db2777',
  neighborhoods: '#475569',
};

export const LAYER_LABEL: Record<LayerKey, string> = {
  expressways: 'Expressways',
  arterials: 'Streets',
  transit: 'CTA rail',
  bus: 'Buses',
  metra: 'Metra',
  landmarks: 'Landmarks',
  divvy: 'Divvy',
  events: 'Events',
  neighborhoods: 'Neighborhoods',
};

/** Draw order, and the order the toggle chips appear in. */
export const LAYER_ORDER: LayerKey[] = [
  'expressways',
  'arterials',
  'transit',
  'bus',
  'metra',
  'landmarks',
  'divvy',
  'events',
  'neighborhoods',
];

/** Zoom the camera eases to when a feature on this layer is tapped. */
export const FOCUS_ZOOM: Record<LayerKey, number> = {
  expressways: 12,
  arterials: 14,
  transit: 13,
  bus: 15,
  metra: 13,
  landmarks: 14,
  divvy: 16,
  events: 15,
  neighborhoods: 12,
};
