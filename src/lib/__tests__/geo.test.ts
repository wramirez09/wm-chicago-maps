import {EMPTY_COLLECTION, toPointCollection} from '../geo';

type Row = {id: string; lon?: number; lat?: number};

const coords = (r: Row): [number, number] | null =>
  r.lon == null || r.lat == null ? null : [r.lon, r.lat];

describe('toPointCollection', () => {
  it('builds a FeatureCollection with [lon, lat] points', () => {
    const rows: Row[] = [{id: 'a', lon: -87.62, lat: 41.88}];

    expect(toPointCollection(rows, coords)).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: rows[0],
          geometry: {type: 'Point', coordinates: [-87.62, 41.88]},
        },
      ],
    });
  });

  it('skips rows without coordinates and keeps the order of the rest', () => {
    const rows: Row[] = [
      {id: 'a', lon: -87.6, lat: 41.9},
      {id: 'b'},
      {id: 'c', lon: -87.7, lat: 41.8},
    ];

    const {features} = toPointCollection(rows, coords);

    expect(features.map(f => f.properties.id)).toEqual(['a', 'c']);
  });

  it('keeps zero coordinates rather than treating them as missing', () => {
    const {features} = toPointCollection([{id: 'z'}], () => [0, 0]);

    expect(features).toHaveLength(1);
    expect(features[0].geometry.coordinates).toEqual([0, 0]);
  });

  it('never sets a feature id, since MapLibre drops string ids', () => {
    const {features} = toPointCollection([{id: 'a', lon: 1, lat: 2}], coords);

    expect(features[0]).not.toHaveProperty('id');
    expect(features[0].properties.id).toBe('a');
  });

  it('returns an empty collection for no rows', () => {
    expect(toPointCollection([], coords)).toEqual({
      type: 'FeatureCollection',
      features: [],
    });
  });
});

describe('EMPTY_COLLECTION', () => {
  it('is a valid, empty FeatureCollection', () => {
    expect(EMPTY_COLLECTION).toEqual({type: 'FeatureCollection', features: []});
  });
});
