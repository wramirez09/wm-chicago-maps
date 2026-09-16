/**
 * Typed access to the values react-native-config inlines at build time.
 *
 * react-native-config reads `.env` during the native build and exposes the
 * result as a plain object, so every value is `string | undefined` — there is
 * no runtime loading and no way to change these without rebuilding.
 *
 * Only keys that are safe to ship inside the app bundle belong here. Anything
 * that must stay secret (OAuth client secrets, the Supabase service-role key)
 * goes through a Supabase Edge Function instead; see supabase/functions/.
 */
import Config from 'react-native-config';

export type EnvKey =
  | 'SUPABASE_URL'
  | 'SUPABASE_ANON_KEY'
  | 'CTA_TRAIN_KEY'
  | 'CTA_BUS_KEY'
  | 'METRA_KEY'
  | 'METRA_SECRET'
  | 'TICKETMASTER_KEY'
  | 'BANDSINTOWN_APP_ID'
  | 'SOCRATA_APP_TOKEN'
  | 'PHOTON_URL'
  | 'VALHALLA_URL'
  | 'SENTRY_DSN'
  | 'POSTHOG_API_KEY'
  | 'POSTHOG_HOST';

export function env(key: EnvKey): string | undefined {
  const value = (Config as Record<string, string | undefined>)[key];
  return value && value.length > 0 ? value : undefined;
}

/**
 * For values a client cannot work without. Throws at call time rather than at
 * import time, so a missing key breaks one feature instead of app startup.
 */
export function requireEnv(key: EnvKey): string {
  const value = env(key);
  if (!value) {
    throw new Error(
      `Missing ${key}. Add it to .env and rebuild — react-native-config ` +
        'inlines env vars during the native build, so a JS reload will not ' +
        'pick it up.',
    );
  }
  return value;
}

/**
 * Whether a key is configured, for UI that should explain a missing key
 * instead of attempting a request that `requireEnv` would reject.
 */
export function hasEnv(key: EnvKey): boolean {
  return env(key) !== undefined;
}
