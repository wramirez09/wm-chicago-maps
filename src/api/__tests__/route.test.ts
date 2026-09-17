import {fetchWalkingRoute} from '../route';
import {mockFetch} from './mockFetch';

const ROUTE = {
  mode: 'walk',
  distanceMeters: 7392,
  durationSeconds: 5220,
  geometry: {type: 'LineString', coordinates: [[-87.6298, 41.8781], [-87.6553, 41.9484]]},
  legs: [{mode: 'walk', distanceMeters: 7392, durationSeconds: 5220, instructions: ['Head north']}],
};

describe('fetchWalkingRoute', () => {
  it('requests a walking route with lng,lat pairs', async () => {
    const {requests, restore} = mockFetch([{body: ROUTE}]);

    const route = await fetchWalkingRoute([-87.6298, 41.8781], [-87.6553, 41.9484]);

    expect(route.distanceMeters).toBe(7392);
    const url = new URL(requests[0].url);
    expect(url.pathname).toBe('/v1/route');
    expect(url.searchParams.get('from')).toBe('-87.6298,41.8781');
    expect(url.searchParams.get('to')).toBe('-87.6553,41.9484');
    expect(url.searchParams.get('mode')).toBe('walk');
    restore();
  });

  it('replaces a 5xx such as "valhalla unavailable" with a readable message', async () => {
    // The exact body the local backend returns when no routing engine is set.
    const {restore} = mockFetch([
      {status: 502, body: {statusCode: 502, error: 'Bad Gateway', message: 'valhalla unavailable'}},
    ]);

    await expect(fetchWalkingRoute([-87.63, 41.88], [-87.65, 41.95])).rejects.toMatchObject({
      statusCode: 502,
      message: 'Directions are unavailable right now.',
    });
    restore();
  });

  it("keeps the backend's message for a 4xx", async () => {
    const {restore} = mockFetch([
      {status: 400, body: {statusCode: 400, error: 'Bad Request', message: 'from is outside Chicago'}},
    ]);

    await expect(fetchWalkingRoute([-122.4, 37.8], [-87.65, 41.95])).rejects.toMatchObject({
      statusCode: 400,
      message: 'from is outside Chicago',
    });
    restore();
  });
});
