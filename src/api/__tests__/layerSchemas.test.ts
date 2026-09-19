import {
  BusStopCollection,
  LayerKey,
  MetraStationCollection,
  TransitStationCollection,
} from '@wm/shared';

const point = (lng: number, lat: number) => ({type: 'Point', coordinates: [lng, lat]});

const collection = (properties: unknown) => ({
  type: 'FeatureCollection',
  features: [{type: 'Feature', geometry: point(-87.626, 41.8837), properties}],
});

const stopIdOf = (parsed: {features: {properties: {stopId: string | null}}[]}) =>
  parsed.features[0].properties.stopId;

describe('vendored layer schemas', () => {
  it('covers every layer the backend serves', () => {
    expect(LayerKey.options).toEqual([
      'expressways',
      'arterials',
      'transit-lines',
      'transit-stations',
      'bus-routes',
      'bus-stops',
      'metra-lines',
      'metra-stations',
    ]);
  });

  it('reads the stop id a rail station carries', () => {
    const parsed = TransitStationCollection.parse(
      collection({name: 'Halsted', lines: 'Orange', stopId: '40850'}),
    );

    expect(stopIdOf(parsed)).toBe('40850');
  });

  // `stopId` is declared `.nullable().default(null)`, and the default is what
  // makes it OPTIONAL on input. Features written by an ingest that predates the
  // id source omit the key entirely; without the default they fail validation
  // and the whole layer — every station on the map — disappears with them.
  it('parses a feature written before the stop id existed', () => {
    expect(stopIdOf(TransitStationCollection.parse(collection({name: 'Halsted', lines: 'Orange'})))).toBeNull();
    expect(
      stopIdOf(BusStopCollection.parse(collection({name: '63rd & Halsted', routes: '8'}))),
    ).toBeNull();
    expect(
      stopIdOf(MetraStationCollection.parse(collection({name: 'Ravenswood', lines: 'UP-N'}))),
    ).toBeNull();
  });

  it('reads an explicit null as no stop id', () => {
    expect(
      stopIdOf(TransitStationCollection.parse(collection({name: 'X', lines: '', stopId: null}))),
    ).toBeNull();
  });

  it('keeps the alphanumeric ids Metra uses', () => {
    expect(
      stopIdOf(
        MetraStationCollection.parse(
          collection({name: 'Ravenswood', lines: 'UP-N', stopId: 'RAVENSWOOD'}),
        ),
      ),
    ).toBe('RAVENSWOOD');
  });

  it('rejects a feature missing the fields the map draws', () => {
    expect(() => BusStopCollection.parse(collection({stopId: '1234'}))).toThrow();
  });
});
