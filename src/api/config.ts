/**
 * Where the API lives.
 *
 * API_URL is inlined from .env by react-native-config at NATIVE build time —
 * changing it needs a rebuild, not a Metro reload. The default suits the iOS
 * simulator, which shares the Mac's network; see .env.example for devices and
 * the Android emulator.
 */
import Config from 'react-native-config';

const DEFAULT_API_URL = 'http://localhost:3000';

export const API_URL = (
  (Config as Record<string, string | undefined>).API_URL || DEFAULT_API_URL
).replace(/\/+$/, '');

/** Requests give up after this. */
export const REQUEST_TIMEOUT_MS = 10_000;
