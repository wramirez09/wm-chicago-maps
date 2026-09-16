import {fetchActiveBusinessLicenses} from '../places/businessLicenses';
import licenses from '../__fixtures__/businessLicenses.json';
import {mockFetchOnce, queryOf} from './testUtils';

describe('fetchActiveBusinessLicenses', () => {
  it('filters to active licences and sends the app token header', async () => {
    const {calls, restore} = mockFetchOnce(licenses);

    await fetchActiveBusinessLicenses();

    const query = queryOf(calls[0].url);
    expect(query.$where).toContain("license_status = 'AAI'");
    expect(query.$where).toContain('expiration_date');
    expect((calls[0].init?.headers as Record<string, string>)['X-App-Token']).toBe(
      'test-socrata-token',
    );
    restore();
  });

  it('parses coordinates to numbers', async () => {
    const {restore} = mockFetchOnce(licenses);

    const result = await fetchActiveBusinessLicenses();

    for (const row of result) {
      expect(typeof row.latitude).toBe('number');
      expect(typeof row.longitude).toBe('number');
      expect(Number.isFinite(row.latitude)).toBe(true);
    }
    restore();
  });

  it('drops rows with no mappable location', async () => {
    const {restore} = mockFetchOnce([
      {id: 'a', latitude: '41.88', longitude: '-87.63'},
      {id: 'b'},
      {id: 'c', latitude: '', longitude: ''},
    ]);

    const result = await fetchActiveBusinessLicenses();

    expect(result.map(r => r.id)).toEqual(['a']);
    restore();
  });

  it('builds a within_box clause in SoQL corner order', async () => {
    const {calls, restore} = mockFetchOnce([]);

    await fetchActiveBusinessLicenses({bbox: [-87.94, 41.64, -87.52, 42.03]});

    // within_box(col, NW_lat, NW_lon, SE_lat, SE_lon) — north first, not west.
    expect(queryOf(calls[0].url).$where).toContain(
      'within_box(location, 42.03, -87.94, 41.64, -87.52)',
    );
    restore();
  });

  it('escapes single quotes in a filter value', async () => {
    const {calls, restore} = mockFetchOnce([]);

    await fetchActiveBusinessLicenses({communityAreaName: "O'Hare"});

    expect(queryOf(calls[0].url).$where).toContain("O''Hare");
    restore();
  });
});
