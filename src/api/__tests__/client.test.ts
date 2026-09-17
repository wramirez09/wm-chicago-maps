import {LayerIndex} from '@wm/shared';

import {ApiError, apiFetch, apiRequest, buildUrl} from '../client';
import {authStorage} from '../storage';
import {mockFetch} from './mockFetch';

afterEach(() => authStorage.clearAll());

describe('buildUrl', () => {
  it('prefixes API_URL and drops empty query values', () => {
    expect(buildUrl('/v1/places', {bbox: '1,2,3,4', category: undefined, q: ''})).toBe(
      'http://api.test/v1/places?bbox=1%2C2%2C3%2C4',
    );
  });
});

describe('apiFetch', () => {
  it('sends the stored access token as a Bearer header', async () => {
    authStorage.set('accessToken', 'token-123');
    const {header, restore} = mockFetch([{body: {ok: true}}]);

    await apiFetch('/v1/me');

    expect(header(0, 'Authorization')).toBe('Bearer token-123');
    restore();
  });

  it('sends no Authorization header when signed out or anonymous', async () => {
    const {header, restore} = mockFetch([{body: {}}, {body: {}}]);

    await apiFetch('/v1/layers');
    authStorage.set('accessToken', 'token-123');
    await apiFetch('/v1/auth/refresh', {method: 'POST', anonymous: true});

    expect(header(0, 'Authorization')).toBeUndefined();
    expect(header(1, 'Authorization')).toBeUndefined();
    restore();
  });

  it("carries the backend's statusCode and message on error", async () => {
    const {restore} = mockFetch([
      {status: 404, body: {statusCode: 404, error: 'Not Found', message: 'Place not found'}},
    ]);

    const error = await apiFetch('/v1/places/x').catch(e => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({statusCode: 404, message: 'Place not found'});
    restore();
  });

  it('still produces an ApiError for a non-JSON error page', async () => {
    const {restore} = mockFetch([{status: 502, raw: '<html>Bad gateway</html>'}]);

    await expect(apiFetch('/v1/layers')).rejects.toMatchObject({statusCode: 502});
    restore();
  });

  it('reports an unreachable API as statusCode 0', async () => {
    const {restore} = mockFetch([{networkError: true}]);

    const error = await apiFetch('/v1/layers').catch(e => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(0);
    expect(error.isNetworkError).toBe(true);
    restore();
  });

  it('resolves a 304 instead of throwing', async () => {
    const {restore} = mockFetch([{status: 304}]);
    await expect(apiFetch('/v1/layers/arterials', {etag: '"abc"'})).resolves.toMatchObject({
      status: 304,
    });
    restore();
  });
});

describe('apiRequest', () => {
  it('returns the schema-parsed body', async () => {
    const body = {
      layers: [{key: 'arterials', featureCount: 3, generatedAt: null, attribution: 'OSM'}],
    };
    const {restore} = mockFetch([{body}]);

    await expect(apiRequest('/v1/layers', LayerIndex)).resolves.toEqual(body);
    restore();
  });

  it('fails loudly when the backend drifts from the contract', async () => {
    const {restore} = mockFetch([{body: {layers: [{key: 'not-a-layer'}]}}]);

    await expect(apiRequest('/v1/layers', LayerIndex)).rejects.toThrow();
    restore();
  });
});
