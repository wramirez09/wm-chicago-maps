/**
 * Session management against the API's own auth. No UI yet.
 *
 * The backend owns auth: the app signs in natively with Apple or Google, sends
 * the provider's identity token to POST /v1/auth/native, and receives the
 * API's own JWT pair. Tokens live in MMKV (see tokens.ts); the client attaches
 * the access token and refreshes on 401 (see client.ts).
 *
 * TODO(native sign-in): not added in this pass. Obtaining an identity token
 * needs native modules:
 *   - Sign in with Apple: @invertase/react-native-apple-authentication
 *   - Google:             @react-native-google-signin/google-signin
 * Each yields an identity token to pass to signInNative({provider, identityToken}).
 * Apple sends the user's name only on first sign-in; forward it as displayName.
 */
import {NativeSignIn, TokenPair} from '@wm/shared';
import type {z} from 'zod';

import {apiFetch, apiRequest, refreshSession} from './client';
import {clearTokens, getAccessToken, getRefreshToken, setTokens, type TokenPairData} from './tokens';

export {getAccessToken, getRefreshToken} from './tokens';

export type NativeSignInInput = z.input<typeof NativeSignIn>;

/** POST /v1/auth/native with a provider identity token; stores the JWT pair. */
export async function signInNative(input: NativeSignInInput): Promise<TokenPairData> {
  // Validate before sending, so a malformed token fails here, not as a 400.
  const body = NativeSignIn.parse(input);
  const pair = await apiRequest('/v1/auth/native', TokenPair, {
    method: 'POST',
    body,
    anonymous: true,
  });
  setTokens(pair);
  return pair;
}

/**
 * POST /v1/auth/refresh. Resolves true with a fresh pair stored, false if
 * there is no session or it could not be refreshed. Shares an in-flight
 * refresh with the client's 401 handling (refresh tokens rotate).
 */
export function refresh(): Promise<boolean> {
  return refreshSession();
}

/**
 * POST /v1/auth/logout, revoking the refresh token server-side.
 *
 * Local tokens are cleared *before* the request: someone who taps "Sign out"
 * on a train with no signal is signed out on the device regardless. The
 * server-side revoke is then best effort; if it fails, the refresh token
 * simply expires on its own.
 */
export async function signOut(): Promise<void> {
  const refreshToken = getRefreshToken();
  clearTokens();

  if (!refreshToken) {
    return;
  }
  try {
    await apiFetch('/v1/auth/logout', {method: 'POST', body: {refreshToken}, anonymous: true});
  } catch {
    // Best effort; see above.
  }
}

export function isSignedIn(): boolean {
  return Boolean(getAccessToken() || getRefreshToken());
}
