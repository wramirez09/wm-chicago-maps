import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {ArterialOverlay} from '../ArterialOverlay';
import {ExpresswayOverlay} from '../ExpresswayOverlay';
import {TransitOverlay} from '../TransitOverlay';

jest.mock('@maplibre/maplibre-react-native', () => {
  const {createElement} = require('react');
  return {
    GeoJSONSource: (props: object) => createElement('GeoJSONSource', props),
    Layer: (props: object) => createElement('Layer', props),
  };
});

const EMPTY = {type: 'FeatureCollection', features: []};
const line = (properties: object) => ({
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      geometry: {type: 'LineString' as const, coordinates: [[-87.66, 41.9], [-87.66, 41.95]] as [number, number][]},
      properties,
    },
  ],
});

async function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(element);
  });
  return renderer;
}

const sources = (renderer: ReactTestRenderer.ReactTestRenderer) =>
  renderer.root.findAllByType('GeoJSONSource' as never);

describe('API-backed layer overlays', () => {
  it('mounts with an empty collection while loading, so draw order never depends on load order', async () => {
    const renderer = await render(<ArterialOverlay visible data={undefined} onPress={jest.fn()} />);

    const [source] = sources(renderer);
    expect(source.props.data).toEqual(EMPTY);
    // The layers exist already, inserted in declaration order.
    expect(renderer.root.findAllByType('Layer' as never).length).toBeGreaterThan(0);
  });

  it('passes the API collection straight through once loaded', async () => {
    const data = line({name: 'Kennedy', ref: 'I 90', kind: 'motorway', localName: 'Kennedy'});
    const renderer = await render(<ExpresswayOverlay visible data={data} onPress={jest.fn()} />);

    expect(sources(renderer)[0].props.data).toBe(data);
  });

  it('renders nothing at all when toggled off', async () => {
    const renderer = await render(<ExpresswayOverlay visible={false} data={undefined} onPress={jest.fn()} />);
    expect(renderer.toJSON()).toBeNull();
  });

  it('feeds transit lines and stations to separate sources, each empty until loaded', async () => {
    const lines = line({line: 'Red', color: '#c60c30'});
    const renderer = await render(
      <TransitOverlay visible lines={lines} stations={undefined} onPress={jest.fn()} />,
    );

    const [lineSource, stationSource] = sources(renderer);
    expect(lineSource.props.data).toBe(lines);
    expect(stationSource.props.data).toEqual(EMPTY);
  });
});
