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

  it('surfaces a Valhalla error body', async () => {
    const {restore} = mockFetchOnce({error: 'No path could be found'});
    await expect(fetchRoute([-87.65, 41.94], [-87.62, 41.87])).rejects.toThrow(
      /No path could be found/,
    );
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
