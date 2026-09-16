import {fetchBusPredictions, parseBusTime} from '../transit/ctaBus';
import predictions from '../__fixtures__/ctaBusPredictions.json';
import errorBody from '../__fixtures__/ctaBusError.json';
import noArrivals from '../__fixtures__/ctaBusNoArrivals.json';
import {mockFetchOnce, queryOf} from './testUtils';

describe('parseBusTime', () => {
  it('parses BusTime\'s non-ISO format', () => {
    const date = parseBusTime('20260916 12:35');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8); // September
    expect(date.getDate()).toBe(16);
    expect(date.getHours()).toBe(12);
    expect(date.getMinutes()).toBe(35);
  });

  it('returns Invalid Date for junk rather than a wrong date', () => {
    expect(Number.isNaN(parseBusTime('not a time').getTime())).toBe(true);
  });
});

describe('fetchBusPredictions', () => {
  it('maps predictions and represents DUE as null minutes', async () => {
    const {calls, restore} = mockFetchOnce(predictions);

    const result = await fetchBusPredictions([1106]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({route: '151', minutesAway: 6, isDue: false});
    expect(result[1]).toMatchObject({minutesAway: null, isDue: true, isDelayed: true});

    expect(queryOf(calls[0].url)).toMatchObject({stpid: '1106', format: 'json'});
    restore();
  });

  it('throws on an invalid-key error envelope', async () => {
    const {restore} = mockFetchOnce(errorBody);
    await expect(fetchBusPredictions([1106])).rejects.toThrow(/Invalid API access key/);
    restore();
  });

  it('treats "No arrival times" as an empty result, not a failure', async () => {
    const {restore} = mockFetchOnce(noArrivals);
    await expect(fetchBusPredictions([1106])).resolves.toEqual([]);
    restore();
  });

  it('short-circuits an empty stop list without calling fetch', async () => {
    const {calls, restore} = mockFetchOnce(predictions);
    await expect(fetchBusPredictions([])).resolves.toEqual([]);
    expect(calls).toHaveLength(0);
    restore();
  });
});
