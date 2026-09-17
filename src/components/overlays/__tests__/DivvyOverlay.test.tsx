import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import type {DivvyStation} from '../../../lib/api/transit/divvyGbfs';
import {useDivvyStations} from '../../../lib/api/transit/hooks';
import {DivvyOverlay} from '../DivvyOverlay';

jest.mock('@maplibre/maplibre-react-native', () => {
  const {createElement} = require('react');
  return {
    GeoJSONSource: (props: object) => createElement('GeoJSONSource', props),
    Layer: (props: object) => createElement('Layer', props),
  };
});

jest.mock('../../../lib/api/transit/hooks', () => ({
  useDivvyStations: jest.fn(),
}));

const mockUseDivvyStations = useDivvyStations as jest.Mock;

const station = (overrides: Partial<DivvyStation> = {}) =>
  ({
    station_id: 's1',
    name: 'Clark St & Lake St',
    lat: 41.886,
    lon: -87.631,
    bikesAvailable: 5,
    ebikesAvailable: 1,
    docksAvailable: 10,
    isRenting: true,
    isReturning: true,
    ...overrides,
  } as DivvyStation);

async function render(visible: boolean) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <DivvyOverlay visible={visible} onPress={jest.fn()} />,
    );
  });
  return renderer;
}

beforeEach(() => mockUseDivvyStations.mockReset());

describe('DivvyOverlay', () => {
  it('renders nothing and keeps the query disabled while hidden', async () => {
    mockUseDivvyStations.mockReturnValue({data: undefined});

    const renderer = await render(false);

    expect(renderer.toJSON()).toBeNull();
    expect(mockUseDivvyStations).toHaveBeenCalledWith({enabled: false});
  });

  it('enables the query when visible', async () => {
    mockUseDivvyStations.mockReturnValue({data: undefined});

    await render(true);

    expect(mockUseDivvyStations).toHaveBeenCalledWith({enabled: true});
  });

  it('feeds an empty collection before data arrives', async () => {
    mockUseDivvyStations.mockReturnValue({data: undefined});

    const renderer = await render(true);
    const source = renderer.root.findByType('GeoJSONSource' as any);

    expect(source.props.data).toEqual({type: 'FeatureCollection', features: []});
  });

  it('maps stations to [lon, lat] points with the station as properties', async () => {
    const s = station();
    mockUseDivvyStations.mockReturnValue({data: [s]});

    const renderer = await render(true);
    const source = renderer.root.findByType('GeoJSONSource' as any);

    expect(source.props.id).toBe('divvy-stations');
    expect(source.props.data.features).toEqual([
      {
        type: 'Feature',
        properties: s,
        geometry: {type: 'Point', coordinates: [-87.631, 41.886]},
      },
    ]);
  });

  it('renders the circle and count layers against its source', async () => {
    mockUseDivvyStations.mockReturnValue({data: [station()]});

    const renderer = await render(true);
    const layers = renderer.root.findAllByType('Layer' as any);

    expect(layers.map(l => l.props.id)).toEqual(['divvy-circle', 'divvy-count']);
    for (const layer of layers) {
      expect(layer.props.source).toBe('divvy-stations');
    }
  });
});
