import {QueryClient} from '@tanstack/react-query';

import {apiKeys, fetchLayer} from '../hooks';
import {cacheStorage} from '../storage';
import {mockFetch} from './mockFetch';

const ARTERIALS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {type: 'LineString', coordinates: [[-87.66, 41.9], [-87.66, 41.95]]},
      properties: {name: 'North Ashland Avenue', kind: 'primary'},
    },
  ],
};

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient();
  cacheStorage.clearAll();
});

// setQueryData schedules each query's garbage-collection timer (gcTime, 5 min
// by default). Left running, it keeps an in-band Jest process alive after the
// run finishes, which hangs `jest <path>` locally and a single-worker CI job.
afterEach(() => queryClient.clear());

describe('fetchLayer', () => {
  it('fetches unconditionally the first time and stores the ETag', async () => {
    const {header, restore} = mockFetch([{body: ARTERIALS, headers: {ETag: '"v1"'}}]);

    const data = await fetchLayer('arterials', queryClient);

    expect(data).toEqual(ARTERIALS);
    expect(header(0, 'If-None-Match')).toBeUndefined();
    expect(cacheStorage.getString('etag:layers:arterials')).toBe('"v1"');
    restore();
  });

  it('revalidates with If-None-Match and keeps the cached body on 304', async () => {
    queryClient.setQueryData(apiKeys.layer('arterials'), ARTERIALS);
    cacheStorage.set('etag:layers:arterials', '"v1"');
    const {requests, header, restore} = mockFetch([{status: 304}]);

    const data = await fetchLayer('arterials', queryClient);

    expect(header(0, 'If-None-Match')).toBe('"v1"');
    expect(requests).toHaveLength(1);
    expect(data).toBe(queryClient.getQueryData(apiKeys.layer('arterials')));
    restore();
  });

  it('refetches unconditionally if a 304 arrives with nothing cached', async () => {
    const {requests, restore} = mockFetch([{status: 304}, {body: ARTERIALS, headers: {ETag: '"v2"'}}]);

    // An ETag with no body behind it (e.g. the cache was cleared).
    cacheStorage.set('etag:layers:arterials', '"stale"');
    const data = await fetchLayer('arterials', queryClient);

    expect(data).toEqual(ARTERIALS);
    expect(requests.length).toBeGreaterThanOrEqual(1);
    restore();
  });

  it('rejects a layer body that does not match the contract', async () => {
    const {restore} = mockFetch([
      {body: {type: 'FeatureCollection', features: [{type: 'Feature', geometry: null, properties: {}}]}},
    ]);

    await expect(fetchLayer('arterials', queryClient)).rejects.toThrow();
    restore();
  });
});
