/**
 * The recenter button's modes, modelled on Google Maps:
 *
 *   off      The map is free. Tapping locates the user and starts following.
 *   follow   The camera stays centred on the user, north up. Tapping again
 *            switches to heading.
 *   heading  Centred, and the map rotates with the device compass. Tapping
 *            again goes back to follow, north up.
 *
 * Any pan by the user drops back to off. The native camera does that itself
 * and reports it through onTrackUserLocationChange, so JS never has to guess.
 */
import type {TrackUserLocation} from '@maplibre/maplibre-react-native';

export type RecenterMode = 'off' | 'follow' | 'heading';

/**
 * Zoom to ease to when recentering from further out. Close enough to read
 * street names and see nearby Divvy docks; if the user is already zoomed in
 * further, their zoom is kept.
 */
export const RECENTER_ZOOM = 16;

export function nextRecenterMode(mode: RecenterMode): RecenterMode {
  return mode === 'follow' ? 'heading' : 'follow';
}

export function recenterZoom(currentZoom: number): number {
  return Math.max(currentZoom, RECENTER_ZOOM);
}

export function toTrackUserLocation(
  mode: RecenterMode,
): TrackUserLocation | undefined {
  switch (mode) {
    case 'follow':
      return 'default';
    case 'heading':
      return 'heading';
    default:
      return undefined;
  }
}

/** 'course' is never requested, but treat it as heading if the OS reports it. */
export function fromTrackUserLocation(
  value: TrackUserLocation | null | undefined,
): RecenterMode {
  switch (value) {
    case 'default':
      return 'follow';
    case 'heading':
    case 'course':
      return 'heading';
    default:
      return 'off';
  }
}

const RANK: Record<RecenterMode, number> = {off: 0, follow: 1, heading: 2};

/**
 * Applies a tracking change reported by the native camera.
 *
 * Native may only step tracking *down* (the user panned, or rotated out of
 * compass mode). It never turns tracking on: those events can land after JS has
 * already switched tracking off, and trusting them re-enables following, so
 * the camera snaps back to the user and the map cannot be panned.
 */
export function reconcileTrackingChange(
  current: RecenterMode,
  reported: TrackUserLocation | null | undefined,
): RecenterMode {
  const next = fromTrackUserLocation(reported);
  return RANK[next] < RANK[current] ? next : current;
}

/** Movement, in points, before a touch counts as a drag rather than a tap. */
export const PAN_THRESHOLD = 10;

export type TouchPoint = {x: number; y: number};

/**
 * Whether a touch on the map is a one-finger drag. Two fingers are a pinch or
 * rotate, which (as in Google Maps) zooms around the user without leaving
 * follow mode.
 */
export function isPanGesture(
  start: TouchPoint,
  current: TouchPoint,
  touchCount: number,
): boolean {
  if (touchCount !== 1) {
    return false;
  }
  return Math.hypot(current.x - start.x, current.y - start.y) > PAN_THRESHOLD;
}
