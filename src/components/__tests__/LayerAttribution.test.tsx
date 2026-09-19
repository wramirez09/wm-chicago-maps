import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {mockFetch, type ScriptedResponse} from '../../api/__tests__/mockFetch';
import type {LayerVisibility} from '../../config/layers';
import {LayerAttribution} from '../LayerAttribution';

const OSM = '© OpenStreetMap contributors, ODbL';
const CTA = 'Chicago Transit Authority via the Chicago Data Portal';

/** The live index shape, with the credits the deployed backend actually sends. */
const INDEX = {
  layers: [
    {key: 'expressways', featureCount: 1958, generatedAt: null, attribution: OSM},
    {key: 'arterials', featureCount: 20883, generatedAt: null, attribution: OSM},
    {key: 'transit-lines', featureCount: 1223, generatedAt: null, attribution: OSM},
    {
      key: 'transit-stations',
      featureCount: 137,
      generatedAt: null,
      attribution: `${OSM}; stop ids from the ${CTA}`,
    },
    {key: 'bus-routes', featureCount: 949, generatedAt: null, attribution: CTA},
    {key: 'bus-stops', featureCount: 10556, generatedAt: null, attribution: CTA},
    {key: 'metra-lines', featureCount: 2999, generatedAt: null, attribution: OSM},
    {key: 'metra-stations', featureCount: 99, generatedAt: null, attribution: OSM},
  ],
};

const HIDDEN: LayerVisibility = {
  expressways: false,
  arterials: false,
  transit: false,
  bus: false,
  metra: false,
  landmarks: false,
  divvy: false,
  events: false,
  neighborhoods: false,
};

async function render(visibility: LayerVisibility, response: ScriptedResponse = {body: INDEX}) {
  const fetch = mockFetch([response]);
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <QueryClientProvider client={client}>
        <LayerAttribution visibility={visibility} />
      </QueryClientProvider>,
    );
  });
  const wait = (ms: number) =>
    ReactTestRenderer.act(() => new Promise<void>(resolve => setTimeout(resolve, ms)));
  for (let i = 0; i < 40 && client.isFetching() > 0; i++) {
    await wait(10);
  }
  await wait(10);

  const texts = () =>
    renderer.root.findAllByType(Text).map(t => [t.props.children].flat().join(''));
  const expand = async () => {
    await ReactTestRenderer.act(() => {
      renderer.root.findByProps({testID: 'layer-attribution'}).props.onPress();
    });
  };
  const cleanup = async () => {
    await ReactTestRenderer.act(() => renderer.unmount());
    client.clear();
    fetch.restore();
  };
  return {texts, expand, cleanup, renderer};
}

describe('LayerAttribution', () => {
  it('names the single source outright when only one applies', async () => {
    const {texts, cleanup} = await render({...HIDDEN, expressways: true});

    expect(texts()).toContain(`Data: ${OSM}`);
    await cleanup();
  });

  // The whole point of reading attribution per layer: turning buses on credits
  // the CTA, and no hardcoded OSM line would ever say so.
  it('credits the CTA for the bus layers, not OpenStreetMap', async () => {
    const {texts, expand, cleanup} = await render({...HIDDEN, bus: true});

    expect(texts()).toContain(`Data: ${CTA}`);
    await expand();
    expect(texts().join('\n')).toContain(CTA);
    expect(texts().join('\n')).not.toContain('OpenStreetMap');
    await cleanup();
  });

  it('collapses to a count when the visible layers disagree, and lists them on tap', async () => {
    const {texts, expand, cleanup} = await render({...HIDDEN, expressways: true, bus: true});

    expect(texts()).toContain('Data: 2 sources — tap for credits');

    await expand();
    const shown = texts().join('\n');
    expect(shown).toContain(OSM);
    expect(shown).toContain(CTA);
    // Each credit is labelled with the layers it covers.
    expect(shown).toContain('Expressways');
    expect(shown).toContain('Buses');
    await cleanup();
  });

  // transit-stations is OSM geometry carrying CTA stop ids, and says so.
  it('uses the combined credit rail stations carry', async () => {
    const {texts, expand, cleanup} = await render({...HIDDEN, transit: true});

    await expand();
    expect(texts().join('\n')).toContain(`${OSM}; stop ids from the ${CTA}`);
    await cleanup();
  });

  it('shows nothing for layers that are switched off', async () => {
    const {renderer, cleanup} = await render(HIDDEN);

    expect(renderer.root.findAllByType(Text)).toHaveLength(0);
    await cleanup();
  });

  // The index is one more request that can fail. Losing it must not put an
  // error on the map; it just means no credits to show yet.
  it('renders nothing when the index is unavailable', async () => {
    const {renderer, cleanup} = await render(
      {...HIDDEN, expressways: true},
      {status: 502, body: {statusCode: 502, error: 'Bad Gateway', message: 'down'}},
    );

    expect(renderer.root.findAllByType(Text)).toHaveLength(0);
    await cleanup();
  });
});
