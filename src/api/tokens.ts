/**
 * The session's tokens, persisted in MMKV.
 *
 * Its own module so dependencies run one way — auth.ts -> client.ts ->
 * tokens.ts. If the client imported auth.ts for tokens while auth.ts imports
 * the client for requests, Metro would warn about a require cycle on every
 * dev launch.
 */
import {authStorage} from './storage';

const ACCESS_TOKEN = 'accessToken';
const REFRESH_TOKEN = 'refreshToken';
const EXPIRES_AT = 'accessTokenExpiresAt';

export type TokenPairData = {accessToken: string; refreshToken: string; expiresIn: number};

export function getAccessToken(): string | undefined {
  return authStorage.getString(ACCESS_TOKEN);
}

export function getRefreshToken(): string | undefined {
  return authStorage.getString(REFRESH_TOKEN);
}

/** Epoch ms the access token expires at, if known. */
export function getAccessTokenExpiresAt(): number | undefined {
  return authStorage.getNumber(EXPIRES_AT);
}

export function setTokens({accessToken, refreshToken, expiresIn}: TokenPairData): void {
  authStorage.set(ACCESS_TOKEN, accessToken);
  authStorage.set(REFRESH_TOKEN, refreshToken);
  authStorage.set(EXPIRES_AT, Date.now() + expiresIn * 1000);
}

export function clearTokens(): void {
  authStorage.remove(ACCESS_TOKEN);
  authStorage.remove(REFRESH_TOKEN);
  authStorage.remove(EXPIRES_AT);
}
