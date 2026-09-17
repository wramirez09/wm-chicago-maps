import type {PersistedClient, Persister} from '@tanstack/react-query-persist-client';

import {skipUnchangedWrites} from '../queryClient';

const client = (queries: [string, number][]): PersistedClient =>
  ({
    timestamp: Date.now(),
    buster: 'test',
    clientState: {
      mutations: [],
      queries: queries.map(([queryHash, dataUpdatedAt]) => ({
        queryHash,
        queryKey: [queryHash],
        state: {dataUpdatedAt},
      })),
    },
  }) as unknown as PersistedClient;

function fakePersister() {
  const persistClient = jest.fn();
  const inner: Persister = {
    persistClient,
    restoreClient: jest.fn(async () => undefined),
    removeClient: jest.fn(),
  };
  return {inner, persistClient};
}

describe('skipUnchangedWrites', () => {
  it('writes once, then skips while no persisted query changes', async () => {
    const {inner, persistClient} = fakePersister();
    const persister = skipUnchangedWrites(inner);

    // Same layers each time: what a Divvy refresh or a map pan produces, since
    // those queries are filtered out before reaching the persister.
    await persister.persistClient(client([['layers,arterials', 100], ['areas', 50]]));
    await persister.persistClient(client([['layers,arterials', 100], ['areas', 50]]));
    await persister.persistClient(client([['areas', 50], ['layers,arterials', 100]]));

    expect(persistClient).toHaveBeenCalledTimes(1);
  });

  it('writes again when a persisted query gets new data', async () => {
    const {inner, persistClient} = fakePersister();
    const persister = skipUnchangedWrites(inner);

    await persister.persistClient(client([['layers,arterials', 100]]));
    await persister.persistClient(client([['layers,arterials', 200]]));

    expect(persistClient).toHaveBeenCalledTimes(2);
  });

  it('writes after the cache is removed, even if the content matches', async () => {
    const {inner, persistClient} = fakePersister();
    const persister = skipUnchangedWrites(inner);

    await persister.persistClient(client([['areas', 50]]));
    await persister.removeClient();
    await persister.persistClient(client([['areas', 50]]));

    expect(persistClient).toHaveBeenCalledTimes(2);
  });
});
