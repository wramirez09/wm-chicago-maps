import {fetchIsochrone, fetchRoute} from '../transit/valhalla';
import {mockFetchOnce} from './testUtils';

const ROUTE = {
  trip: {
    summary: {length: 2.4, time: 1800},
    legs: [
      {
        shape: 'abc123',
        summary: {length: 2.4, time: 1800},
        maneuvers: [
          {instruction: 'Walk east on West Addison Street.', length: 0.4, time: 300},
        ],
      },
    ],
  },
};

describe('fetchRoute', () => {
  it('POSTs locations as {lat, lon}, flipping from [lng, lat]', async () => {
    const {calls, restore} = mockFetchOnce(ROUTE);

    await fetchRoute([-87.6553, 41.9484], [-87.6298, 41.8781]);

    const body = JSON.parse(calls[0].init?.body as string);
    expect(body.locations).toEqual([
      {lat: 41.9484, lon: -87.6553},
      {lat: 41.8781, lon: -87.6298},
    ]);
    expect(calls[0].init?.method).toBe('POST');
    restore();
  });

  it('defaults to pedestrian costing', async () => {
    const {calls, restore} = mockFetchOnce(ROUTE);
    await fetchRoute([-87.65, 41.94], [-87.62, 41.87]);
    expect(JSON.parse(calls[0].init?.body as string).costing).toBe('pedestrian');
    restore();
  });

  it('maps the trip summary and maneuvers', async () => {
    const {restore} = mockFetchOnce(ROUTE);

    const result = await fetchRoute([-87.65, 41.94], [-87.62, 41.87], {mode: 'bicycle'});

    expect(result).toMatchObject({mode: 'bicycle', distanceKm: 2.4, durationSeconds: 1800});
    expect(result.legs[0].maneuvers[0].instruction).toContain('Walk east');
    restore();
  });

  // The real server reports errors as HTTP 400 with a JSON body. The body
  // below was captured from valhalla1.openstreetmap.de for a walk from San
  // Francisco to Chicago.
  it('turns a 400 distance-limit error into a readable message', async () => {
    const {restore} = mockFetchOnce(
      {
        error_code: 154,
        error: 'Path distance exceeds the max distance limit: 100000 meters',
        status_code: 400,
        status: 'Bad Request',
      },
      400,
    );

    await expect(fetchRoute([-122.4064, 37.7858], [-87.6713, 41.8293])).rejects.toThrow(
      'That is too far to walk from here.',
    );
    restore();
  });

  it("falls back to Valhalla's own text for other errors", async () => {
    const {restore} = mockFetchOnce(
      {error_code: 999, error: 'Some other routing failure', status_code: 400},
      400,
    );

    await expect(fetchRoute([-87.65, 41.94], [-87.62, 41.87])).rejects.toThrow(
      'Some other routing failure',
    );
    restore();
  });

  it('keeps the original error when the body is not Valhalla JSON', async () => {
    const {restore} = mockFetchOnce('<html>gateway timeout</html>', 400);

    await expect(fetchRoute([-87.65, 41.94], [-87.62, 41.87])).rejects.toThrow(/HTTP 400/);
    restore();
  });
});

describe('fetchIsochrone', () => {
  it('sends contours in minutes and asks for polygons', async () => {
    const {calls, restore} = mockFetchOnce({type: 'FeatureCollection', features: []});

    await fetchIsochrone([-87.63, 41.88], {minutes: [5, 10]});

    const body = JSON.parse(calls[0].init?.body as string);
    expect(body.contours).toEqual([{time: 5}, {time: 10}]);
    expect(body.polygons).toBe(true);
    restore();
  });
});
