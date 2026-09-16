import {fetchTicketmasterEvents} from '../events/ticketmaster';
import events from '../__fixtures__/ticketmasterEvents.json';
import {mockFetchOnce, queryOf} from './testUtils';

describe('fetchTicketmasterEvents', () => {
  it('maps an event to the shared LocalEvent shape', async () => {
    const {restore} = mockFetchOnce(events);

    const [event] = await fetchTicketmasterEvents({latitude: 41.88, longitude: -87.63});

    expect(event).toMatchObject({
      source: 'ticketmaster',
      title: 'Chicago Symphony Orchestra',
      venueName: 'Symphony Center',
      category: 'Classical',
    });
    expect(event.address).toBe('220 S Michigan Ave, Chicago, IL');
    expect(event.latitude).toBeCloseTo(41.8789);
    restore();
  });

  it('picks the largest image, not the first', async () => {
    const {restore} = mockFetchOnce(events);
    const [event] = await fetchTicketmasterEvents({latitude: 41.88, longitude: -87.63});
    expect(event.imageUrl).toBe('https://s1.ticketm.net/large.jpg');
    restore();
  });

  it('sends latlong and a radius', async () => {
    const {calls, restore} = mockFetchOnce(events);

    await fetchTicketmasterEvents({latitude: 41.88, longitude: -87.63, radius: 25});

    expect(queryOf(calls[0].url)).toMatchObject({
      latlong: '41.88,-87.63',
      radius: '25',
      unit: 'miles',
      apikey: 'test-ticketmaster-key',
    });
    restore();
  });

  it('formats dates without milliseconds, which the API rejects', async () => {
    const {calls, restore} = mockFetchOnce(events);

    await fetchTicketmasterEvents({
      latitude: 41.88,
      longitude: -87.63,
      startDateTime: new Date('2026-10-01T12:00:00.500Z'),
    });

    expect(queryOf(calls[0].url).startDateTime).toBe('2026-10-01T12:00:00Z');
    restore();
  });

  it('returns an empty list when nothing is embedded', async () => {
    const {restore} = mockFetchOnce({page: {size: 0, totalElements: 0, totalPages: 0, number: 0}});
    await expect(
      fetchTicketmasterEvents({latitude: 41.88, longitude: -87.63}),
    ).resolves.toEqual([]);
    restore();
  });
});
