import {fetchParkEventPermits, fetchParkFacilities} from '../neighborhoods/parkDistrict';
import permits from '../__fixtures__/parkEventPermits.json';
import {mockFetchOnce, queryOf} from './testUtils';

describe('fetchParkEventPermits', () => {
  it('asks only for approved, future bookings', async () => {
    const {calls, restore} = mockFetchOnce(permits);

    await fetchParkEventPermits();

    const where = queryOf(calls[0].url).$where;
    expect(where).toContain("upper(permit_status) = 'APPROVED'");
    expect(where).toContain('reservation_start_date >=');
    restore();
  });

  it('maps permits into the shared LocalEvent shape', async () => {
    const {restore} = mockFetchOnce(permits);

    const events = await fetchParkEventPermits();

    for (const event of events) {
      expect(event.source).toBe('chicago-parks');
      expect(typeof event.title).toBe('string');
      expect(event.title.length).toBeGreaterThan(0);
    }
    restore();
  });

  it('derives a stable id, since the dataset has no row id', async () => {
    const {restore} = mockFetchOnce([
      {
        park_number: '572',
        reservation_start_date: '2026-10-01T00:00:00.000',
        organization: 'Test Org',
        event_type: 'Festival',
      },
    ]);

    const [event] = await fetchParkEventPermits();
    expect(event.id).toBe('572|2026-10-01T00:00:00.000|Test Org');
    restore();
  });
});

describe('fetchParkFacilities', () => {
  it('returns only the feature columns that are set', async () => {
    const {restore} = mockFetchOnce([
      {
        park_no: '572',
        park: 'Test Park',
        acres: '12.5',
        ward: '43',
        playground: '1',
        tennis_cou: '4',
        pool_indoo: '0',
        zoo: '0',
      },
    ]);

    const facilities = await fetchParkFacilities('572');

    expect(facilities).toEqual(['playground', 'tennis_cou']);
    // Metadata columns must not leak in as if they were amenities.
    expect(facilities).not.toContain('acres');
    expect(facilities).not.toContain('ward');
    restore();
  });

  it('returns an empty list for an unknown park', async () => {
    const {restore} = mockFetchOnce([]);
    await expect(fetchParkFacilities('nope')).resolves.toEqual([]);
    restore();
  });
});
