import {fetchGeocode} from '../geocode';
import {mockFetch} from './mockFetch';

const point = (lng: number, lat: number) => ({type: 'Point', coordinates: [lng, lat]});

const GREENE = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'W405330583',
      geometry: point(-87.6712712, 41.8293346),
      properties: {
        name: 'Nathanael Greene Elementary School',
        label: 'Nathanael Greene Elementary School, 3525 South Honore Street, Chicago',
      },
    },
    {
      type: 'Feature',
      geometry: point(-87.6711, 41.8294),
      properties: {name: null, label: '3525 South Honore Street, Chicago'},
    },
  ],
};

describe('fetchGeocode', () => {
  it('requests the trimmed query and splits each label into title and subtitle', async () => {
    const {requests, restore} = mockFetch([{body: GREENE}]);

    const results = await fetchGeocode('  3525 S Honore ');

    const url = new URL(requests[0].url);
    expect(url.pathname).toBe('/v1/geocode');
    expect(url.searchParams.get('q')).toBe('3525 S Honore');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(results).toEqual([
      {
        id: 'W405330583',
        title: 'Nathanael Greene Elementary School',
        subtitle: '3525 South Honore Street, Chicago',
        center: [-87.6712712, 41.8293346],
      },
      {
        id: 'geocode:1:-87.6711,41.8294',
        title: '3525 South Honore Street',
        subtitle: 'Chicago',
        center: [-87.6711, 41.8294],
      },
    ]);
    restore();
  });

  it('makes no request for a query too short to be useful', async () => {
    const {requests, restore} = mockFetch([{body: GREENE}]);

    await expect(fetchGeocode('35')).resolves.toEqual([]);
    expect(requests).toHaveLength(0);
    restore();
  });

  it.each([
    ['the endpoint is not deployed yet', {status: 404, body: {statusCode: 404, error: 'Not Found', message: 'Route GET:/v1/geocode not found'}}],
    ['the geocoder is down', {status: 502, body: {statusCode: 502, error: 'Bad Gateway', message: 'photon unavailable'}}],
    ['the network is unreachable', {networkError: true}],
  ])('reports addresses as unavailable when %s', async (_, response) => {
    const {restore} = mockFetch([response]);

    await expect(fetchGeocode('3525 S Honore')).rejects.toMatchObject({
      message: 'Address search is unavailable right now.',
    });
    restore();
  });

  it('fails loudly when the response drifts from the contract', async () => {
    const {restore} = mockFetch([{body: {type: 'FeatureCollection', features: [{type: 'Feature', geometry: point(-87.6, 41.8), properties: {}}]}}]);

    await expect(fetchGeocode('3525 S Honore')).rejects.toThrow();
    restore();
  });
});
