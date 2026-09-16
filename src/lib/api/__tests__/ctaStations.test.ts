import {fetchCtaStations, nearestStation} from '../transit/ctaStations';
import lStops from '../__fixtures__/ctaLStops.json';
import {mockFetchOnce} from './testUtils';

describe('fetchCtaStations', () => {
  it('collapses per-platform rows into one station per map_id', async () => {
    const {restore} = mockFetchOnce(lStops);

    const stations = await fetchCtaStations();

    const mapIds = stations.map(s => s.mapId);
    expect(new Set(mapIds).size).toBe(mapIds.length);
    // The fixture has several platform rows per station.
    expect(stations.length).toBeLessThan(lStops.length);
    restore();
  });

  it('parses the {latitude, longitude} location shape to numbers', async () => {
    const {restore} = mockFetchOnce(lStops);

    const [station] = await fetchCtaStations();

    expect(typeof station.latitude).toBe('number');
    expect(Number.isFinite(station.longitude)).toBe(true);
    restore();
  });
});

describe('nearestStation', () => {
  const stations = [
    {mapId: 'A', name: 'Western', descriptiveName: 'Western (Blue)', latitude: 41.9162, longitude: -87.6873},
    {mapId: 'B', name: 'Western', descriptiveName: 'Western (Brown)', latitude: 41.9661, longitude: -87.6885},
  ];

  it('tells same-named stations apart by position', () => {
    expect(nearestStation(stations, [-87.6874, 41.9161])?.mapId).toBe('A');
    expect(nearestStation(stations, [-87.6884, 41.966])?.mapId).toBe('B');
  });

  it('refuses a match beyond 250 m rather than guessing a neighbour', () => {
    // ~1.1 km north of station A.
    expect(nearestStation(stations, [-87.6873, 41.9262])).toBeNull();
  });
});
