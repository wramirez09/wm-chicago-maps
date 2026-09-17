import {refresh, signInNative, signOut, isSignedIn} from '../auth';
import {apiFetch} from '../client';
import {authStorage} from '../storage';
import {getAccessToken, getRefreshToken, setTokens} from '../tokens';
import {mockFetch} from './mockFetch';

const PAIR = {accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 900};
const ROTATED = {accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900};
const UNAUTHORIZED = {status: 401, body: {statusCode: 401, error: 'Unauthorized', message: 'jwt expired'}};
const IDENTITY_TOKEN = 'eyJhbGciOiJSUzI1NiJ9.identity-token-from-apple';

const bodyOf = (init: RequestInit) => JSON.parse(String(init.body));

beforeEach(() => authStorage.clearAll());

describe('signInNative', () => {
  it('posts the identity token anonymously and stores the returned pair', async () => {
    const {requests, header, restore} = mockFetch([{body: PAIR}]);

    await signInNative({provider: 'apple', identityToken: IDENTITY_TOKEN});

    expect(requests[0].url).toBe('http://api.test/v1/auth/native');
    expect(bodyOf(requests[0].init)).toEqual({provider: 'apple', identityToken: IDENTITY_TOKEN});
    expect(header(0, 'Authorization')).toBeUndefined();
    expect(getAccessToken()).toBe('access-1');
    expect(getRefreshToken()).toBe('refresh-1');
    expect(isSignedIn()).toBe(true);
    restore();
  });

  it('rejects a malformed identity token before making a request', async () => {
    const {requests, restore} = mockFetch([{body: PAIR}]);

    await expect(signInNative({provider: 'google', identityToken: 'short'})).rejects.toThrow();
    expect(requests).toHaveLength(0);
    restore();
  });
});

describe('401 handling in the client', () => {
  it('refreshes once and retries the request with the new access token', async () => {
    setTokens(PAIR);
    const {requests, header, restore} = mockFetch([UNAUTHORIZED, {body: ROTATED}, {body: {ok: true}}]);

    await expect(apiFetch('/v1/me')).resolves.toMatchObject({status: 200});

    expect(requests.map(r => new URL(r.url).pathname)).toEqual(['/v1/me', '/v1/auth/refresh', '/v1/me']);
    expect(bodyOf(requests[1].init)).toEqual({refreshToken: 'refresh-1'});
    expect(header(2, 'Authorization')).toBe('Bearer access-2');
    expect(getRefreshToken()).toBe('refresh-2');
    restore();
  });

  it('gives up after one retry: a second 401 propagates and does not refresh again', async () => {
    setTokens(PAIR);
    const {requests, restore} = mockFetch([UNAUTHORIZED, {body: ROTATED}, UNAUTHORIZED]);

    await expect(apiFetch('/v1/me')).rejects.toMatchObject({statusCode: 401});
    expect(requests.filter(r => r.url.endsWith('/v1/auth/refresh'))).toHaveLength(1);
    restore();
  });

  it('ends the session when the refresh token is rejected', async () => {
    setTokens(PAIR);
    const {restore} = mockFetch([UNAUTHORIZED, UNAUTHORIZED]);

    await expect(apiFetch('/v1/me')).rejects.toMatchObject({statusCode: 401});
    expect(getAccessToken()).toBeUndefined();
    expect(getRefreshToken()).toBeUndefined();
    restore();
  });

  it('keeps the session when the refresh fails for a network reason', async () => {
    setTokens(PAIR);
    const {restore} = mockFetch([UNAUTHORIZED, {networkError: true}]);

    await expect(apiFetch('/v1/me')).rejects.toMatchObject({statusCode: 401});
    expect(getRefreshToken()).toBe('refresh-1');
    restore();
  });

  it('shares one refresh between concurrent 401s, because refresh tokens rotate', async () => {
    setTokens(PAIR);
    const {requests, restore} = mockFetch([
      UNAUTHORIZED,
      UNAUTHORIZED,
      {body: ROTATED},
      {body: {ok: true}},
      {body: {ok: true}},
    ]);

    await Promise.all([apiFetch('/v1/me'), apiFetch('/v1/places/x')]);

    // Two refreshes would present refresh-1 twice; the second would be revoked.
    expect(requests.filter(r => r.url.endsWith('/v1/auth/refresh'))).toHaveLength(1);
    expect(getRefreshToken()).toBe('refresh-2');
    restore();
  });

  it('does not try to refresh when signed out', async () => {
    const {requests, restore} = mockFetch([UNAUTHORIZED]);

    await expect(apiFetch('/v1/me')).rejects.toMatchObject({statusCode: 401});
    expect(requests).toHaveLength(1);
    restore();
  });
});

describe('refresh', () => {
  it('resolves false with no session, without a request', async () => {
    const {requests, restore} = mockFetch([{body: ROTATED}]);
    await expect(refresh()).resolves.toBe(false);
    expect(requests).toHaveLength(0);
    restore();
  });
});

describe('signOut', () => {
  it('revokes the refresh token server-side and clears local tokens', async () => {
    setTokens(PAIR);
    const {requests, restore} = mockFetch([{status: 204}]);

    await signOut();

    expect(new URL(requests[0].url).pathname).toBe('/v1/auth/logout');
    expect(bodyOf(requests[0].init)).toEqual({refreshToken: 'refresh-1'});
    expect(isSignedIn()).toBe(false);
    restore();
  });

  it('signs out locally even when the logout request fails', async () => {
    setTokens(PAIR);
    const {restore} = mockFetch([{networkError: true}]);

    await expect(signOut()).resolves.toBeUndefined();
    expect(isSignedIn()).toBe(false);
    restore();
  });
});
