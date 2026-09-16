/**
 * Sentry + PostHog initialisation.
 *
 * Sentry:  https://docs.sentry.io/platforms/react-native/
 * PostHog: https://posthog.com/docs/libraries/react-native
 *
 * ⚠️ NOT WIRED UP. Neither SDK is a dependency yet — both have a native side,
 * and Sentry's install also rewrites the Xcode build phases to upload source
 * maps. Installing them blind would change the native projects under you.
 *
 * `initObservability()` is safe to call today: with nothing installed and no
 * DSN configured it is a no-op that logs once. Wire it into App.tsx now and it
 * starts working as soon as the setup below is done.
 *
 * ── Sentry setup ─────────────────────────────────────────────────────────
 *   npm install @sentry/react-native
 *   npx @sentry/wizard@latest -i reactNative   # patches ios/ + android/
 *   cd ios && bundle exec pod install
 *   Add SENTRY_DSN to .env.
 *
 * ── PostHog setup ────────────────────────────────────────────────────────
 *   npm install posthog-react-native @react-native-async-storage/async-storage
 *   cd ios && bundle exec pod install
 *   Add POSTHOG_API_KEY and POSTHOG_HOST to .env.
 *   Note: posthog-react-native needs async-storage (or expo-file-system) for
 *   its queue; without it, events are dropped on background.
 */
import {env} from '../api/env';

type SentryLike = {
  init: (options: Record<string, unknown>) => void;
  captureException: (error: unknown, hint?: unknown) => void;
};

type PostHogLike = {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (id: string, properties?: Record<string, unknown>) => void;
  flush?: () => Promise<void>;
};

let sentry: SentryLike | null = null;
let postHog: PostHogLike | null = null;
let warned = false;

function optional<T>(load: () => T): T | null {
  try {
    return load();
  } catch {
    return null;
  }
}

/**
 * Call once, as early in App.tsx as possible — errors thrown before this runs
 * are not reported.
 */
export function initObservability(): void {
  const dsn = env('SENTRY_DSN');
  const postHogKey = env('POSTHOG_API_KEY');

  if (dsn) {
    const module = optional(() => require('@sentry/react-native')) as SentryLike | null;

    if (module) {
      module.init({
        dsn,
        // Traces are sampled down hard: a map app fires a lot of spans and
        // the default of 1.0 will exhaust a free quota in days.
        tracesSampleRate: 0.1,
        enableAutoSessionTracking: true,
      });
      sentry = module;
    }
  }

  if (postHogKey) {
    const module = optional(() => require('posthog-react-native')) as {
      PostHog?: new (key: string, options?: unknown) => PostHogLike;
    } | null;

    if (module?.PostHog) {
      postHog = new module.PostHog(postHogKey, {
        host: env('POSTHOG_HOST') ?? 'https://us.i.posthog.com',
      });
    }
  }

  if (!sentry && !postHog && !warned) {
    warned = true;
    console.warn(
      '[observability] disabled — no SDK installed or no DSN/key in .env. ' +
        'See src/lib/observability/index.ts for setup.',
    );
  }
}

/** Report a handled error. Falls back to console when Sentry is absent. */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (sentry) {
    sentry.captureException(error, context ? {extra: context} : undefined);
    return;
  }
  console.error('[error]', error, context ?? '');
}

export function track(event: string, properties?: Record<string, unknown>): void {
  postHog?.capture(event, properties);
}

export function identify(userId: string, properties?: Record<string, unknown>): void {
  postHog?.identify(userId, properties);
}
