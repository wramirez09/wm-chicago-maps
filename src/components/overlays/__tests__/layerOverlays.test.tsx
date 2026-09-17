import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {ArterialOverlay} from '../ArterialOverlay';
import {ExpresswayOverlay} from '../ExpresswayOverlay';
import {LandmarkOverlay} from '../LandmarkOverlay';
import {TransitOverlay} from '../TransitOverlay';

jest.mock('@maplibre/maplibre-react-native', () => {
  const {createElement} = require('react');
  return {
    GeoJSONSource: (props: object) => createElement('GeoJSONSource', props),
    Layer: (props: object) => createElement('Layer', props),
  };
});

const EMPTY = {type: 'FeatureCollection', features: []};
// Generic so each overlay's properties keep their contract type.
const line = <P,>(properties: P) => ({
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
    const data = line({name: 'Kennedy', ref: 'I 90', kind: 'motorway' as const, localName: 'Kennedy'});
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

describe('LandmarkOverlay (places)', () => {
  const PLACES = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: {type: 'Point' as const, coordinates: [-87.6233, 41.8827] as [number, number]},
        properties: {
          id: '5b1e2a3c-0000-4000-8000-000000000001',
          slug: 'cloud-gate',
          name: 'Cloud Gate',
          category: 'landmark' as const,
          independence: 'excluded' as const,
          communityArea: null,
          address: null,
          vouchCount: 0,
        },
      },
    ],
  };

  it('is empty until places load, then draws the API collection', async () => {
    const loading = await render(<LandmarkOverlay visible data={undefined} onPress={jest.fn()} />);
    expect(sources(loading)[0].props.data).toEqual(EMPTY);

    const loaded = await render(<LandmarkOverlay visible data={PLACES} onPress={jest.fn()} />);
    expect(sources(loaded)[0].props.data).toBe(PLACES);
  });
});
