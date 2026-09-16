import {fetchBusStops, normalizeStopId} from '../transit/busStops';
import busStops from '../__fixtures__/ctaBusStops.json';
import {mockFetchOnce, queryOf} from './testUtils';

describe('normalizeStopId', () => {
  it('strips the float suffix Socrata stores, which Bus Tracker rejects', () => {
    expect(normalizeStopId('15189.0')).toBe('15189');
  });

  it('leaves an integer id alone and rejects junk', () => {
    expect(normalizeStopId('1106')).toBe('1106');
    expect(normalizeStopId('abc')).toBeNull();
    expect(normalizeStopId(undefined)).toBeNull();
  });
});

describe('fetchBusStops', () => {
  it('filters to the bbox on the_geom', async () => {
    const {calls, restore} = mockFetchOnce(busStops);

    await fetchBusStops([-87.64, 41.87, -87.62, 41.89]);

    expect(queryOf(calls[0].url).$where).toBe(
      'within_box(the_geom, 41.89, -87.64, 41.87, -87.62)',
    );
    restore();
  });

  it('reads the GeoJSON point shape and normalises ids and routes', async () => {
    const {restore} = mockFetchOnce(busStops);

    const stops = await fetchBusStops([-88, 41, -87, 42]);

    expect(stops.length).toBeGreaterThan(0);
    for (const stop of stops) {
      expect(stop.stopId).toMatch(/^\d+$/);
      expect(Number.isFinite(stop.latitude)).toBe(true);
      expect(Array.isArray(stop.routes)).toBe(true);
    }
    restore();
  });
});
