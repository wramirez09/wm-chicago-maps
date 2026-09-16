/**
 * Shared helpers for the ingest scripts.
 *
 * These run under tsx on a workstation or CI box, never in the app bundle.
 * They use the Supabase SERVICE ROLE key, which bypasses RLS entirely — it
 * must never appear in the app or in a committed file. Put it in
 * `scripts/.env`, which is gitignored.
 */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {createClient} from '@supabase/supabase-js';

import type {Database} from '../../src/lib/supabase.types';

/** Chicago bbox: [west, south, east, north]. Matches CHICAGO_BOUNDS. */
export const CHICAGO_BBOX: [number, number, number, number] = [
  -87.94, 41.64, -87.52, 42.03,
];

/**
 * Minimal .env reader — avoids a dotenv dependency for four lines of parsing.
 * Values may be quoted; `export` prefixes and comments are ignored.
 */
export function loadScriptEnv(file = 'scripts/.env'): Record<string, string> {
  const merged: Record<string, string> = {...process.env as Record<string, string>};

  try {
    const contents = readFileSync(resolve(process.cwd(), file), 'utf8');

    for (const line of contents.split('\n')) {
      const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match || line.trim().startsWith('#')) {
        continue;
      }
      const [, key, rawValue] = match;
      merged[key] = rawValue.replace(/^["']|["']$/g, '').trim();
    }
  } catch {
    // No scripts/.env is fine when the values come from the environment.
  }

  return merged;
}

export function serviceClient() {
  const env = loadScriptEnv();
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in scripts/.env ' +
        '(gitignored) or the environment. The service-role key bypasses RLS — ' +
        'never put it in .env or anywhere the app can read.',
    );
  }

  return createClient<Database>(url, key, {
    auth: {persistSession: false, autoRefreshToken: false},
  });
}

/**
 * Upserts in chunks. PostgREST rejects very large payloads, and a failed
 * 50k-row insert tells you nothing about which row was bad.
 */
export async function upsertInChunks<T>(
  rows: T[],
  chunkSize: number,
  write: (chunk: T[]) => Promise<{error: {message: string} | null}>,
): Promise<number> {
  let written = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const {error} = await write(chunk);

    if (error) {
      throw new Error(
        `Upsert failed at rows ${i}–${i + chunk.length}: ${error.message}`,
      );
    }

    written += chunk.length;
    process.stdout.write(`\r  upserted ${written}/${rows.length}`);
  }

  process.stdout.write('\n');
  return written;
}

export function log(message: string): void {
  console.log(`[ingest] ${message}`);
}
