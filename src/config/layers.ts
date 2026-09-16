/**
 * The overlay layers, their identity and their colours.
 *
 * These live in config rather than inside the overlay components because three
 * unrelated places need them: the components themselves, the toggle chips, and
 * the search index (which has to colour a result for a layer it never renders).
 */

export type LayerKey =
  | 'expressways'
  | 'arterials'
  | 'transit'
  | 'landmarks'
  | 'divvy'
  | 'businesses'
  | 'busStops'
  | 'metra'
  | 'events'
  | 'neighborhoods'
  | 'parks'
  | 'wards';

export type LayerVisibility = Record<LayerKey, boolean>;

/**
 * Layers backed by a live API rather than committed data. They start hidden:
 * turning one on is what triggers its first network request, so the map still
 * opens instantly and offline.
 */
export const LIVE_LAYERS: LayerKey[] = [
  'divvy',
  'businesses',
  'busStops',
  'metra',
  'events',
  'neighborhoods',
  'parks',
  'wards',
];

export const LAYER_ACCENT: Record<LayerKey, string> = {
  expressways: '#1d4ed8',
  arterials: '#b45309',
  transit: '#0f766e',
  landmarks: '#e4572e',
  divvy: '#0b6bcb',
  businesses: '#7c3aed',
  busStops: '#0369a1',
  metra: '#4338ca',
  events: '#db2777',
  neighborhoods: '#475569',
  parks: '#15803d',
  wards: '#a16207',
};

export const LAYER_LABEL: Record<LayerKey, string> = {
  expressways: 'Expressways',
  arterials: 'Streets',
  transit: 'CTA rail',
  landmarks: 'Landmarks',
  divvy: 'Divvy',
  businesses: 'Businesses',
  busStops: 'Bus stops',
  metra: 'Metra',
  events: 'Events',
  neighborhoods: 'Neighborhoods',
  parks: 'Parks',
  wards: 'Wards',
};

/** Draw order, and the order the toggle chips appear in. */
export const LAYER_ORDER: LayerKey[] = [
  'expressways',
  'arterials',
  'transit',
  'landmarks',
  'divvy',
  'businesses',
  'busStops',
  'metra',
  'events',
  'neighborhoods',
  'parks',
  'wards',
];

/** Zoom the camera eases to when a feature on this layer is tapped. */
export const FOCUS_ZOOM: Record<LayerKey, number> = {
  expressways: 12,
  arterials: 14,
  transit: 13,
  landmarks: 14,
  divvy: 16,
  businesses: 17,
  busStops: 17,
  metra: 13,
  events: 15,
  neighborhoods: 12,
  parks: 14,
  wards: 12,
};
