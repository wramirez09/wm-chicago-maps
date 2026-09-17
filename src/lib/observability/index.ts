/**
 * Sentry + PostHog — the seam the app reports through.
 *
 * Sentry:  https://docs.sentry.io/platforms/react-native/
 * PostHog: https://posthog.com/docs/libraries/react-native
 *
 * ⚠️ NOT WIRED UP. Neither SDK is installed. Until they are, every function
 * here is a safe no-op (errors still reach the console), so the rest of the app
 * can call `captureError` / `track` today and gain real reporting later without
 * touching any call site.
 *
 * Why there is no "load the SDK if it happens to be installed" trick here:
 * Metro resolves every `require('some-package')` string literal statically, at
 * bundle time, before any code runs. A try/catch around the require cannot
 * catch a missing package — the whole bundle fails to build and the app shows a
 * red screen. (Jest resolves requires at runtime instead, which is why tests
 * never caught this.) So the SDK imports can only exist once the packages do.
 *
 * ── To enable Sentry ─────────────────────────────────────────────────────
 *   npm install @sentry/react-native
 *   npx @sentry/wizard@latest -i reactNative   # patches ios/ + android/
 *   cd ios && bundle exec pod install
 *   Add SENTRY_DSN to .env and rebuild.
 *   Then, in this file:
 *     import * as Sentry from '@sentry/react-native';
 *     in initObservability():  Sentry.init({dsn, tracesSampleRate: 0.1});
 *     in captureError():        Sentry.captureException(error, {extra: context});
 *
 * ── To enable PostHog ────────────────────────────────────────────────────
 *   npm install posthog-react-native @react-native-async-storage/async-storage
 *   cd ios && bundle exec pod install
 *   Add POSTHOG_API_KEY (and optionally POSTHOG_HOST) to .env and rebuild.
 *   Then, in this file:
 *     import PostHog from 'posthog-react-native';
 *     const posthog = new PostHog(key, {host});
 *     in track():     posthog.capture(event, properties);
 *     in identify():  posthog.identify(userId, properties);
 *
 * Keep tracesSampleRate low: a map app emits a lot of spans, and the default of
 * 1.0 exhausts a free Sentry quota in days.
 */
import Config from 'react-native-config';

/** Reads an optional key inlined by react-native-config; '' counts as unset. */
function env(key: 'SENTRY_DSN' | 'POSTHOG_API_KEY'): string | undefined {
  const value = (Config as Record<string, string | undefined>)[key];
  return value ? value : undefined;
}

let initialised = false;

/** Call once, as early in App.tsx as possible. Idempotent. */
export function initObservability(): void {
  if (initialised) {
    return;
  }
  initialised = true;

  if (env('SENTRY_DSN') || env('POSTHOG_API_KEY')) {
    // Keys are configured but the SDKs are not installed — worth saying
    // loudly, because it means reporting the developer expects is silently off.
    console.warn(
      '[observability] SENTRY_DSN / POSTHOG_API_KEY are set, but the SDKs are ' +
        'not installed, so nothing is being reported. See ' +
        'src/lib/observability/index.ts.',
    );
  }
}

/** Report a handled error. Console-only until Sentry is wired. */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  console.error('[error]', error, context ?? '');
}

/** Record a product event. No-op until PostHog is wired. */
export function track(_event: string, _properties?: Record<string, unknown>): void {}

/** Associate events with a user. No-op until PostHog is wired. */
export function identify(_userId: string, _properties?: Record<string, unknown>): void {}
