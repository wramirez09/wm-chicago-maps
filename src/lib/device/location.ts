/**
 * Location: permission request + one-shot position + watch.
 *
 * Docs:
 *   https://github.com/michalchudziak/react-native-geolocation
 *   https://github.com/zoontek/react-native-permissions
 *
 * NATIVE SETUP REQUIRED — these are native modules, so a JS reload is not
 * enough after installing them:
 *
 *   iOS    cd ios && bundle exec pod install
 *          Info.plist needs NSLocationWhenInUseUsageDescription (and
 *          NSLocationAlwaysAndWhenInUseUsageDescription only if you ever ask
 *          for background location).
 *          react-native-permissions also needs its setup in the Podfile:
 *          `setup_permissions(['LocationWhenInUse'])`.
 *
 *   Android  AndroidManifest.xml needs ACCESS_FINE_LOCATION and
 *            ACCESS_COARSE_LOCATION. Both are runtime permissions.
 */
import Geolocation, {
  type GeolocationError,
  type GeolocationResponse,
} from '@react-native-community/geolocation';
import {Platform} from 'react-native';
import {PERMISSIONS, RESULTS, check, request} from 'react-native-permissions';

export type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

export type LocationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable';

const PERMISSION =
  Platform.OS === 'ios'
    ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
    : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

function toStatus(result: string): LocationPermissionStatus {
  switch (result) {
    case RESULTS.GRANTED:
    case RESULTS.LIMITED:
      return 'granted';
    case RESULTS.BLOCKED:
      return 'blocked';
    case RESULTS.UNAVAILABLE:
      return 'unavailable';
    default:
      return 'denied';
  }
}

/** Current status without prompting. */
export async function checkLocationPermission(): Promise<LocationPermissionStatus> {
  return toStatus(await check(PERMISSION));
}

/**
 * Prompts if the OS will still show a prompt.
 *
 * 'blocked' means the user has denied it permanently — the OS will not ask
 * again, so the only route left is Settings. Callers should show that rather
 * than calling this in a loop.
 */
export async function requestLocationPermission(): Promise<LocationPermissionStatus> {
  const current = await check(PERMISSION);
  if (current === RESULTS.BLOCKED || current === RESULTS.UNAVAILABLE) {
    return toStatus(current);
  }
  return toStatus(await request(PERMISSION));
}

export type PositionOptions = {
  timeoutMs?: number;
  maximumAgeMs?: number;
  highAccuracy?: boolean;
};

/** One fix. Rejects rather than resolving null, so failures are explicit. */
export function getCurrentPosition(
  options: PositionOptions = {},
): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position: GeolocationResponse) => resolve(toCoordinates(position)),
      (error: GeolocationError) =>
        reject(new Error(`Location unavailable (${error.code}): ${error.message}`)),
      {
        enableHighAccuracy: options.highAccuracy ?? false,
        timeout: options.timeoutMs ?? 15_000,
        maximumAge: options.maximumAgeMs ?? 10_000,
      },
    );
  });
}

/** Returns an unsubscribe function; call it on unmount or the GPS stays hot. */
export function watchPosition(
  onChange: (coordinates: Coordinates) => void,
  onError?: (error: Error) => void,
  options: PositionOptions & {distanceFilterMeters?: number} = {},
): () => void {
  const id = Geolocation.watchPosition(
    position => onChange(toCoordinates(position)),
    error => onError?.(new Error(`Location watch failed (${error.code}): ${error.message}`)),
    {
      enableHighAccuracy: options.highAccuracy ?? false,
      distanceFilter: options.distanceFilterMeters ?? 25,
      timeout: options.timeoutMs,
      maximumAge: options.maximumAgeMs,
    },
  );

  return () => Geolocation.clearWatch(id);
}

function toCoordinates(position: GeolocationResponse): Coordinates {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? null,
    timestamp: position.timestamp,
  };
}
