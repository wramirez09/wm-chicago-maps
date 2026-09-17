/**
 * Token storage. Step 1 only reads the access token so the client can send
 * it; sign-in, refresh and sign-out are added alongside the 401 retry.
 */
import {authStorage} from './storage';

const ACCESS_TOKEN_KEY = 'accessToken';

export function getAccessToken(): string | undefined {
  return authStorage.getString(ACCESS_TOKEN_KEY);
}
