/**
 * Push notifications via Firebase Cloud Messaging.
 *
 * Docs: https://rnfirebase.io/messaging/usage
 *
 * ⚠️ NOT WIRED UP. `@react-native-firebase/messaging` is deliberately NOT a
 * dependency of this project yet, because installing it without the platform
 * config files breaks both builds — and a wrapper that pretends to register a
 * token it never got is worse than one that says it cannot.
 *
 * Everything below works the moment the setup is done; until then each call
 * throws `PushNotConfiguredError`, which callers can catch to hide the UI.
 *
 * ── Setup, in order ──────────────────────────────────────────────────────
 *
 * 1. Create a Firebase project and register both apps
 *    (iOS bundle id + Android applicationId must match this app exactly).
 *
 * 2. npm install @react-native-firebase/app @react-native-firebase/messaging
 *
 * 3. iOS
 *      - Put GoogleService-Info.plist in ios/WmChicagoMaps/ and add it to the
 *        Xcode target (drag into the project, "Copy items if needed").
 *      - Enable Push Notifications and Background Modes → Remote notifications
 *        in Signing & Capabilities.
 *      - Upload an APNs auth key (.p8) to Firebase → Project settings → Cloud
 *        Messaging. APNs is what actually delivers; FCM only brokers it.
 *      - cd ios && bundle exec pod install
 *      - Push does not work on the iOS Simulator: a physical device is needed.
 *
 * 4. Android
 *      - Put google-services.json in android/app/.
 *      - android/build.gradle: classpath 'com.google.gms:google-services:4.4.2'
 *      - android/app/build.gradle: apply plugin: 'com.google.gms.google-services'
 *      - API 33+ needs the POST_NOTIFICATIONS runtime permission in
 *        AndroidManifest.xml, requested at run time.
 *
 * 5. Delete the guard in `messaging()` below and the throw goes away.
 */
import {supabase} from '../supabase';

export class PushNotConfiguredError extends Error {
  constructor() {
    super(
      'Push is not configured: @react-native-firebase/messaging is not ' +
        'installed and the Firebase platform files are missing. See the ' +
        'setup steps in src/lib/device/push.ts.',
    );
    this.name = 'PushNotConfiguredError';
  }
}

type MessagingModule = {
  requestPermission: () => Promise<number>;
  getToken: () => Promise<string>;
  onTokenRefresh: (listener: (token: string) => void) => () => void;
  onMessage: (listener: (message: unknown) => void) => () => void;
  AuthorizationStatus: {AUTHORIZED: number; PROVISIONAL: number};
};

/**
 * Resolved at call time rather than imported, so this module compiles and can
 * be imported anywhere while the dependency is still absent.
 */
function messaging(): MessagingModule {
  try {
    const module = require('@react-native-firebase/messaging');
    return (module.default ?? module)();
  } catch {
    throw new PushNotConfiguredError();
  }
}

export function isPushAvailable(): boolean {
  try {
    messaging();
    return true;
  } catch {
    return false;
  }
}

export async function requestPushPermission(): Promise<boolean> {
  const fcm = messaging();
  const status = await fcm.requestPermission();
  return (
    status === fcm.AuthorizationStatus.AUTHORIZED ||
    status === fcm.AuthorizationStatus.PROVISIONAL
  );
}

export async function getPushToken(): Promise<string> {
  return messaging().getToken();
}

/**
 * Registers this device's token against the signed-in user.
 *
 * Upserted on `token` so reinstalls and token refreshes replace the row rather
 * than accumulating dead tokens — the `devices` table needs a unique index on
 * `token` for this to work.
 */
export async function registerDeviceToken(token: string, platform: 'ios' | 'android') {
  const client = supabase();
  const {data: auth} = await client.auth.getUser();

  const {error} = await client
    .from('devices')
    .upsert({token, platform, user_id: auth.user?.id ?? null, updated_at: new Date().toISOString()}, {onConflict: 'token'});

  if (error) {
    throw new Error(`Could not register device token: ${error.message}`);
  }
}

/** Keeps Supabase in sync when FCM rotates the token. Returns unsubscribe. */
export function onPushTokenRefresh(platform: 'ios' | 'android'): () => void {
  return messaging().onTokenRefresh(token => {
    registerDeviceToken(token, platform).catch(error => {
      console.warn('[push] could not persist refreshed token', error);
    });
  });
}
