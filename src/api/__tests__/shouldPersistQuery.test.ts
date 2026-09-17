import {hashKey} from '@tanstack/react-query';

import {CHICAGO_BOUNDS} from '../../config/map';
import {apiKeys} from '../hooks';
import {shouldPersistQuery} from '../queryClient';

const query = (queryKey: readonly unknown[], status = 'success') => ({
  queryKey: queryKey as unknown[],
  queryHash: hashKey(queryKey as unknown[]),
  state: {status} as never,
});

describe('shouldPersistQuery', () => {
  it('persists layers and areas', () => {
    expect(shouldPersistQuery(query(apiKeys.layer('arterials')))).toBe(true);
    expect(shouldPersistQuery(query(apiKeys.areas()))).toBe(true);
  });

  it('persists the citywide landmark query, so landmarks draw offline', () => {
    // Must stay in step with the key usePlaces builds for the launch viewport.
    expect(shouldPersistQuery(query(apiKeys.places(CHICAGO_BOUNDS, 'landmark')))).toBe(true);
  });

  it('does not persist viewport places queries or live data', () => {
    expect(shouldPersistQuery(query(apiKeys.places([-87.7, 41.85, -87.6, 41.95], 'landmark')))).toBe(false);
    expect(shouldPersistQuery(query(apiKeys.divvy()))).toBe(false);
    expect(shouldPersistQuery(query(apiKeys.arrivals('40380', 'rail')))).toBe(false);
  });

  it('never persists a failed query', () => {
    expect(shouldPersistQuery(query(apiKeys.layer('arterials'), 'error'))).toBe(false);
  });
});
