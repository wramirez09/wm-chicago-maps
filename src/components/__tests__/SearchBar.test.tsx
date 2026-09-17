import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import React from 'react';
import {Text, TextInput} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {mockFetch, type ScriptedResponse} from '../../api/__tests__/mockFetch';
import {apiKeys} from '../../api/hooks';
import {CHICAGO_BOUNDS} from '../../config/map';
import {SearchBar} from '../SearchBar';

const EMPTY = {type: 'FeatureCollection', features: []};

const GREENE = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'W405330583',
      geometry: {type: 'Point', coordinates: [-87.6712712, 41.8293346]},
      properties: {
        name: 'Nathanael Greene Elementary School',
        label: 'Nathanael Greene Elementary School, 3525 South Honore Street, Chicago',
      },
    },
  ],
};

/** Layers and landmarks already cached, as after launch, so only geocode hits fetch. */
function seededClient() {
  const client = new QueryClient({defaultOptions: {queries: {staleTime: Infinity}}});
  for (const key of ['expressways', 'arterials', 'transit-lines', 'transit-stations'] as const) {
    client.setQueryData(apiKeys.layer(key), EMPTY);
  }
  client.setQueryData(apiKeys.places(CHICAGO_BOUNDS, 'landmark'), EMPTY);
  return client;
}

async function typeInto(response: ScriptedResponse, query: string) {
  const fetch = mockFetch([response]);
  const client = seededClient();
  const onSelectAddress = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <QueryClientProvider client={client}>
        <SearchBar onSelect={jest.fn()} onSelectAddress={onSelectAddress} />
      </QueryClientProvider>,
    );
  });
  const input = renderer.root.findByType(TextInput);
  await ReactTestRenderer.act(() => {
    input.props.onFocus();
    input.props.onChangeText(query);
  });
  const texts = () => renderer.root.findAllByType(Text).map(t => [t.props.children].flat().join(''));
  // Real timers throughout: React Query schedules its notifications with
  // setTimeout too, and fake timers would strand them. Wait out the 300 ms
  // debounce, then until the request has settled and rendered.
  const wait = (ms: number) => ReactTestRenderer.act(() => new Promise<void>(resolve => setTimeout(resolve, ms)));
  await wait(350);
  for (let i = 0; i < 40 && (fetch.requests.length === 0 || client.isFetching() > 0); i++) {
    await wait(10);
  }
  await wait(10);

  const cleanup = async () => {
    await ReactTestRenderer.act(() => renderer.unmount());
    client.clear();
    fetch.restore();
  };
  return {renderer, texts, fetch, onSelectAddress, cleanup};
}

describe('SearchBar address results', () => {
  it('lists geocoded places under Addresses and selects one', async () => {
    const {renderer, texts, fetch, onSelectAddress, cleanup} = await typeInto({body: GREENE}, '3525 S Honore');

    expect(new URL(fetch.requests[0].url).searchParams.get('q')).toBe('3525 S Honore');
    expect(texts()).toEqual(
      expect.arrayContaining(['Addresses', 'Nathanael Greene Elementary School', '3525 South Honore Street, Chicago']),
    );

    const row = renderer.root.findByProps({accessibilityLabel: 'Nathanael Greene Elementary School, 3525 South Honore Street, Chicago'});
    await ReactTestRenderer.act(() => row.props.onPress());
    expect(onSelectAddress).toHaveBeenCalledWith(
      expect.objectContaining({title: 'Nathanael Greene Elementary School', center: [-87.6712712, 41.8293346]}),
    );
    await cleanup();
  });

  it('says address search is unavailable while the endpoint is missing', async () => {
    const {texts, cleanup} = await typeInto(
      {status: 404, body: {statusCode: 404, error: 'Not Found', message: 'Route GET:/v1/geocode not found'}},
      '3525 S Honore',
    );

    expect(texts()).toContain(
      'Nothing matching “3525 S Honore” on the map. Address search is unavailable right now.',
    );
    await cleanup();
  });
});
