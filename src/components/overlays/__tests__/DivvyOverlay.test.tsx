import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {useDivvy} from '../../../api/hooks';
import type {DivvyStation} from '../../../api/types';
import {DivvyOverlay} from '../DivvyOverlay';

jest.mock('@maplibre/maplibre-react-native', () => {
  const {createElement} = require('react');
  return {
    GeoJSONSource: (props: object) => createElement('GeoJSONSource', props),
    Layer: (props: object) => createElement('Layer', props),
  };
});

jest.mock('../../../api/hooks', () => ({
  useDivvy: jest.fn(),
}));

const mockUseDivvy = useDivvy as jest.Mock;

const station = (overrides: Partial<DivvyStation> = {}) =>
  ({
    id: 's1',
    name: 'Clark St & Lake St',
    lat: 41.886,
    lng: -87.631,
    bikes: 5,
    ebikes: 1,
    docks: 10,
    renting: true,
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

beforeEach(() => mockUseDivvy.mockReset());

describe('DivvyOverlay', () => {
  it('renders nothing and keeps the query disabled while hidden', async () => {
    mockUseDivvy.mockReturnValue({data: undefined});

    const renderer = await render(false);

    expect(renderer.toJSON()).toBeNull();
    expect(mockUseDivvy).toHaveBeenCalledWith({enabled: false});
  });

  it('enables the query when visible', async () => {
    mockUseDivvy.mockReturnValue({data: undefined});

    await render(true);

    expect(mockUseDivvy).toHaveBeenCalledWith({enabled: true});
  });

  it('feeds an empty collection before data arrives', async () => {
    mockUseDivvy.mockReturnValue({data: undefined});

    const renderer = await render(true);
    const source = renderer.root.findByType('GeoJSONSource' as any);

    expect(source.props.data).toEqual({type: 'FeatureCollection', features: []});
  });

  it('maps stations to [lon, lat] points with the station as properties', async () => {
    const s = station();
    mockUseDivvy.mockReturnValue({data: {fetchedAt: '2026-09-16T12:00:00Z', stations: [s]}});

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
    mockUseDivvy.mockReturnValue({data: {fetchedAt: '2026-09-16T12:00:00Z', stations: [station()]}});

    const renderer = await render(true);
    const layers = renderer.root.findAllByType('Layer' as any);

    expect(layers.map(l => l.props.id)).toEqual(['divvy-circle', 'divvy-count']);
    for (const layer of layers) {
      expect(layer.props.source).toBe('divvy-stations');
    }
  });
});
