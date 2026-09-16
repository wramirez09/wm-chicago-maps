/**
 * The overlay layers, their identity and their colours.
 *
 * These live in config rather than inside the overlay components because three
 * unrelated places need them: the components themselves, the toggle chips, and
 * the search index (which has to colour a result for a layer it never renders).
 */

export type LayerKey = 'expressways' | 'arterials' | 'transit' | 'landmarks';

export type LayerVisibility = Record<LayerKey, boolean>;

export const LAYER_ACCENT: Record<LayerKey, string> = {
  expressways: '#1d4ed8',
  arterials: '#b45309',
  transit: '#0f766e',
  landmarks: '#e4572e',
};

export const LAYER_LABEL: Record<LayerKey, string> = {
  expressways: 'Expressways',
  arterials: 'Streets',
  transit: 'CTA rail',
  landmarks: 'Landmarks',
};

/** Draw order, and the order the toggle chips appear in. */
export const LAYER_ORDER: LayerKey[] = [
  'expressways',
  'arterials',
  'transit',
  'landmarks',
];

/** Zoom the camera eases to when a feature on this layer is tapped. */
export const FOCUS_ZOOM: Record<LayerKey, number> = {
  expressways: 12,
  arterials: 14,
  transit: 13,
  landmarks: 14,
};
