/**
 * Supabase client for the app (anon key only).
 *
 * Docs: https://supabase.com/docs/reference/javascript/initializing
 *
 * `react-native-url-polyfill` is imported for its side effect: supabase-js
 * builds request URLs with the WHATWG `URL` API, which React Native's
 * Hermes/JSC environment does not implement completely.
 */
import 'react-native-url-polyfill/auto';
import {createClient} from '@supabase/supabase-js';

import {requireEnv} from './api/env';
import type {Database} from './supabase.types';

let client: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Created on first use rather than at module load, so that importing anything
 * from this file does not throw in a test or a build without env configured.
 */
export function supabase() {
  if (!client) {
    client = createClient<Database>(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_ANON_KEY'),
      {
        auth: {
          // No deep-link redirect handling in the app yet; without this,
          // supabase-js tries to read an OAuth code out of window.location,
          // which does not exist in React Native.
          detectSessionInUrl: false,
          persistSession: true,
          autoRefreshToken: true,
        },
      },
    );
  }
  return client;
}

/**
 * Calls a Supabase Edge Function. Used for every upstream whose credentials
 * must not ship in the app bundle — the app talks to the function, and the
 * function talks to the vendor.
 */
export async function invokeFunction<T>(
  name: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const {data, error} = await supabase().functions.invoke<T>(name, {body});
  if (error) {
    throw new Error(`Edge function "${name}" failed: ${error.message}`);
  }
  return data as T;
}
