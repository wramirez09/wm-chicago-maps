/**
 * Where the API lives.
 *
 * API_URL is inlined from .env by react-native-config at NATIVE build time —
 * changing it needs a rebuild, not a Metro reload. It defaults to the deployed
 * backend, so a fresh clone with no .env runs against production; point it at a
 * local backend by setting API_URL. See .env.example for the values a device,
 * simulator and emulator each need.
 */
import Config from 'react-native-config';

/** The deployed backend (Fly.io, region ord). */
const DEFAULT_API_URL = 'https://chicago-api.fly.dev';

export const API_URL = (
  (Config as Record<string, string | undefined>).API_URL || DEFAULT_API_URL
).replace(/\/+$/, '');

/** Requests give up after this. */
export const REQUEST_TIMEOUT_MS = 10_000;

/**
 * The budget for the first request of the session.
 *
 * Fly suspends the web machines when idle (`auto_stop_machines = "suspend"`),
 * so the request that wakes them pays a cold start that can run well past the
 * steady-state timeout. Timing that one out would show "could not reach the
 * API" on a backend that is merely waking up, and the retry would pay the same
 * cost again. Once any request has come back, the machines are up and the
 * normal timeout applies.
 */
export const COLD_START_TIMEOUT_MS = 30_000;
