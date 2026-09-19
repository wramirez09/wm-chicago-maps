import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {mockFetch, type ScriptedResponse} from '../../api/__tests__/mockFetch';
import {type LiveDetail, SelectionDetails} from '../SelectionDetails';

const ARRIVALS = {
  stop: '40850',
  mode: 'rail',
  fetchedAt: '2026-09-17T18:00:00.000Z',
  arrivals: [
    {
      route: 'Orange',
      destination: 'Loop',
      arrivesAt: '2026-09-17T18:03:00.000Z',
      minutes: 3,
      live: true,
      delayed: false,
    },
    {
      route: 'Orange',
      destination: 'Midway',
      arrivesAt: '2026-09-17T18:00:00.000Z',
      minutes: 0,
      live: true,
      delayed: true,
    },
    {
      route: 'Orange',
      destination: 'Loop',
      arrivesAt: '2026-09-17T18:14:00.000Z',
      minutes: 14,
      live: false,
      delayed: false,
    },
  ],
};

async function render(detail: LiveDetail, response: ScriptedResponse) {
  const fetch = mockFetch([response]);
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <QueryClientProvider client={client}>
        <SelectionDetails detail={detail} />
      </QueryClientProvider>,
    );
  });
  // Real timers, as in SearchBar.test: React Query notifies through setTimeout.
  const wait = (ms: number) =>
    ReactTestRenderer.act(() => new Promise<void>(resolve => setTimeout(resolve, ms)));
  for (let i = 0; i < 40 && client.isFetching() > 0; i++) {
    await wait(10);
  }
  await wait(10);

  const texts = () =>
    renderer.root.findAllByType(Text).map(t => [t.props.children].flat().join(''));
  const cleanup = async () => {
    await ReactTestRenderer.act(() => renderer.unmount());
    client.clear();
    fetch.restore();
  };
  return {texts, fetch, cleanup};
}

describe('SelectionDetails arrivals', () => {
  it('asks for the tapped stop and lists its departures', async () => {
    const {texts, fetch, cleanup} = await render(
      {kind: 'arrivals', stop: '40850', mode: 'rail'},
      {body: ARRIVALS},
    );

    const url = new URL(fetch.requests[0].url);
    expect(url.pathname).toBe('/v1/transit/arrivals');
    expect(url.searchParams.get('stop')).toBe('40850');
    expect(url.searchParams.get('mode')).toBe('rail');

    expect(texts()).toEqual(
      expect.arrayContaining([
        'Next departures',
        'Orange to Loop · 3 min',
        // Nothing is "0 min" away, and a delay is worth saying out loud.
        'Orange to Midway · Due · delayed',
        'Orange to Loop · 14 min · scheduled',
      ]),
    );
    await cleanup();
  });

  it('sends the mode a bus stop was tapped with', async () => {
    const {fetch, cleanup} = await render(
      {kind: 'arrivals', stop: '1106', mode: 'bus'},
      {body: {...ARRIVALS, stop: '1106', mode: 'bus', arrivals: []}},
    );

    expect(new URL(fetch.requests[0].url).searchParams.get('mode')).toBe('bus');
    await cleanup();
  });

  it('says so when the stop has nothing scheduled', async () => {
    const {texts, cleanup} = await render(
      {kind: 'arrivals', stop: '40850', mode: 'rail'},
      {body: {...ARRIVALS, arrivals: []}},
    );

    expect(texts()).toContain('No departures scheduled.');
    await cleanup();
  });

  // Metra arrivals answer 400 "not implemented yet". That is a feature the
  // backend does not have, not a fault, so it reads as a gap rather than
  // something that might work on a retry.
  it('says Metra arrivals do not exist yet rather than reporting a failure', async () => {
    const {texts, cleanup} = await render(
      {kind: 'arrivals', stop: 'RAVENSWOOD', mode: 'metra'},
      {status: 400, body: {statusCode: 400, error: 'HttpError', message: 'Metra arrivals not implemented yet'}},
    );

    expect(texts()).toContain('Live arrivals for Metra are not available yet.');
    await cleanup();
  });

  // Rail and bus answer 502 until the CTA tracker keys are set as Fly secrets,
  // so this is the path every arrivals tap takes today. It must degrade to a
  // note on the card, not throw.
  it('degrades to a note when the upstream tracker refuses', async () => {
    const {texts, cleanup} = await render(
      {kind: 'arrivals', stop: '40850', mode: 'rail'},
      {status: 502, body: {statusCode: 502, error: 'Bad Gateway', message: 'cta-train unavailable'}},
    );

    expect(texts()).toContain('Arrivals unavailable right now.');
    await cleanup();
  });
});
