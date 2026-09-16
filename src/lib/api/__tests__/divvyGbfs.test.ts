import {
  fetchDivvyStations,
  fetchStationInformation,
  resetGbfsFeedCache,
} from '../transit/divvyGbfs';
import discovery from '../__fixtures__/divvyDiscovery.json';
import information from '../__fixtures__/divvyStationInformation.json';
import status from '../__fixtures__/divvyStationStatus.json';
import {mockFetchSequence} from './testUtils';

beforeEach(() => resetGbfsFeedCache());

describe('Divvy GBFS', () => {
  it('resolves the feed URL from the discovery document', async () => {
    const {calls, restore} = mockFetchSequence([
      {body: discovery},
      {body: information},
    ]);

    await fetchStationInformation();

    expect(calls[0].url).toContain('gbfs.json');
    // The point of discovery: the second call goes wherever the doc says,
    // which is currently Lyft-hosted rather than divvybikes.com.
    expect(calls[1].url).toContain('station_information.json');
    restore();
  });

  it('joins information and status on station_id', async () => {
    const {restore} = mockFetchSequence([
      {body: discovery},
      {body: information},
      {body: status},
    ]);

    const stations = await fetchDivvyStations();

    expect(stations.length).toBeGreaterThan(0);

    const first = stations[0];
    expect(typeof first.name).toBe('string');
    expect(typeof first.bikesAvailable).toBe('number');
    // GBFS 1.x sends 1/0 for these; they must surface as booleans.
    expect(typeof first.isRenting).toBe('boolean');
    restore();
  });
});
