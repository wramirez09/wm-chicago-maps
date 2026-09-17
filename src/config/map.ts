import type {LngLat, LngLatBounds} from '@maplibre/maplibre-react-native';
import {CHICAGO_BBOX, CHICAGO_CENTER as SHARED_CHICAGO_CENTER} from '@wm/shared';

/**
 * OpenFreeMap's "Liberty" style: a full OpenMapTiles/OSM basemap with real
 * street, highway and place detail. Free, no API key, no usage limits.
 *
 * Replaced MapLibre's demo tiles, which only carry country polygons — there
 * were no streets on the map at all at any zoom.
 */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/**
 * The only fontstacks the style's glyph server can serve. A symbol layer that
 * asks for anything else (including the spec default, "Open Sans Regular")
 * renders no text at all, silently.
 */
export const FONT_REGULAR = ['Noto Sans Regular'];
export const FONT_BOLD = ['Noto Sans Bold'];

/**
 * Overlay layers are inserted *before* this basemap layer, so our geometry
 * draws over the basemap's roads but underneath all of its labels. This is the
 * first label layer in the Liberty style; if the basemap is swapped again, this
 * id has to be re-checked or the overlays will cover the place names.
 */
export const LABEL_ANCHOR_LAYER_ID = 'waterway_line_label';

/**
 * Chicago's centre and bounds come from the backend contract, so the app's
 * camera limits and the API's bbox clamping can never disagree.
 *
 * Spread into MapLibre's types rather than re-exported as-is: the shared
 * constants are `as const` readonly tuples, which Camera's mutable
 * LngLat/LngLatBounds props do not accept.
 */
/** The Loop, roughly. */
export const CHICAGO_CENTER: LngLat = [...SHARED_CHICAGO_CENTER];

export const CHICAGO_ZOOM = 11;

/** [west, south, east, north] — city limits with a little breathing room. */
export const CHICAGO_BOUNDS: LngLatBounds = [...CHICAGO_BBOX];

export const MIN_ZOOM = 9;
export const MAX_ZOOM = 19;
