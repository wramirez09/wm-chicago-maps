import {fetchTrainArrivals} from '../transit/ctaTrain';
import arrivals from '../__fixtures__/ctaTrainArrivals.json';
import errorBody from '../__fixtures__/ctaTrainError.json';
import {mockFetchOnce, queryOf} from './testUtils';

describe('fetchTrainArrivals', () => {
  it('maps the eta rows and parses the string flags', async () => {
    const {calls, restore} = mockFetchOnce(arrivals);

    const result = await fetchTrainArrivals({mapId: 40380});

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      stationName: 'Clark/Lake',
      route: 'Blue',
      destination: 'Forest Park',
      isApproaching: false,
      isScheduled: false,
    });
    // '1' must become true, not the string.
    expect(result[1].isApproaching).toBe(true);
    expect(result[0].latitude).toBeCloseTo(41.88574);

    expect(queryOf(calls[0].url)).toMatchObject({
      mapid: '40380',
      outputType: 'JSON',
      key: 'test-cta-train-key',
    });
    restore();
  });

  it('throws on an error envelope delivered with HTTP 200', async () => {
    const {restore} = mockFetchOnce(errorBody, 200);

    await expect(fetchTrainArrivals({mapId: 40380})).rejects.toThrow(
      /Invalid API key/,
    );
    restore();
  });

  it('requires mapId or stopId', async () => {
    await expect(fetchTrainArrivals({})).rejects.toThrow(/mapId or stopId/);
  });
});
