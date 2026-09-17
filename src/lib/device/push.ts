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
 * Until the setup below is done, every call throws `PushNotConfiguredError`
 * (and `isPushAvailable()` returns false), which callers can use to hide the UI.
 * `registerDeviceToken` is real and works today.
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
 * 5. Replace the body of `messaging()` below with the real import.
 */

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

/**
 * Always throws until Firebase is installed.
 *
 * This deliberately does NOT try `require('@react-native-firebase/messaging')`
 * inside a try/catch. Metro resolves require string literals statically at
 * bundle time, so a missing package fails the entire bundle with a red screen
 * the moment this file is imported — the catch never runs. (Jest resolves at
 * runtime, which is why the tests could not catch it.)
 *
 * Once step 2 of the setup above is done, replace the body with:
 *     import messaging from '@react-native-firebase/messaging';
 *     ...
 *     return messaging();
 */
function messaging(): never {
  throw new PushNotConfiguredError();
}

export function isPushAvailable(): boolean {
  return false;
}

export async function requestPushPermission(): Promise<boolean> {
  return messaging();
}

export async function getPushToken(): Promise<string> {
  return messaging();
}

/**
 * Token registration is not implemented: the API has no device endpoint yet.
 * When it does, POST the token there through src/api/client.ts; this used to
 * write straight to a Supabase table, which the app no longer talks to.
 */
/** Would keep the backend in sync when FCM rotates the token. Returns unsubscribe. */
export function onPushTokenRefresh(_platform: 'ios' | 'android'): () => void {
  // Once Firebase is installed:
  //   return messaging().onTokenRefresh(token => {
  //     registerWithApi(token, platform).catch(error => {
  //       console.warn('[push] could not persist refreshed token', error);
  //     });
  //   });
  return messaging();
}
