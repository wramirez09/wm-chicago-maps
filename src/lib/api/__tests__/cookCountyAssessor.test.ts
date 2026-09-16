import {
  fetchParcelByPin,
  fetchParcelsByAddress,
  normalizePin,
} from '../places/cookCountyAssessor';
import parcels from '../__fixtures__/cookCountyParcels.json';
import {mockFetchOnce, queryOf} from './testUtils';

describe('normalizePin', () => {
  it('strips the conventional dashes', () => {
    expect(normalizePin('17-09-123-045-0000')).toBe('17091230450000');
  });
});

describe('fetchParcelByPin', () => {
  it('queries the undashed pin and takes the newest tax year', async () => {
    const {calls, restore} = mockFetchOnce(parcels);

    await fetchParcelByPin('17-09-123-045-0000');

    const query = queryOf(calls[0].url);
    expect(query.$where).toBe("pin = '17091230450000'");
    expect(query.$order).toBe('year DESC');
    expect(calls[0].url).toContain('datacatalog.cookcountyil.gov');
    restore();
  });

  it('returns null when nothing matches', async () => {
    const {restore} = mockFetchOnce([]);
    await expect(fetchParcelByPin('00000000000000')).resolves.toBeNull();
    restore();
  });
});

describe('owner-occupancy heuristic', () => {
  it('is true when the mailing address matches the property address', async () => {
    const {restore} = mockFetchOnce([
      {
        pin: '1',
        prop_address_full: '1060 W ADDISON ST',
        mail_address_full: '1060 w addison st',
      },
    ]);

    const [parcel] = await fetchParcelsByAddress('1060 W ADDISON');
    expect(parcel.likelyOwnerOccupied).toBe(true);
    restore();
  });

  it('is false when the owner receives post elsewhere', async () => {
    const {restore} = mockFetchOnce([
      {
        pin: '2',
        prop_address_full: '1060 W ADDISON ST',
        mail_address_full: '123 N LASALLE ST STE 400',
      },
    ]);

    const [parcel] = await fetchParcelsByAddress('1060 W ADDISON');
    expect(parcel.likelyOwnerOccupied).toBe(false);
    restore();
  });

  it('is false rather than true when the property address is missing', async () => {
    const {restore} = mockFetchOnce([{pin: '3'}]);

    const [parcel] = await fetchParcelsByAddress('anything');
    expect(parcel.likelyOwnerOccupied).toBe(false);
    restore();
  });
});
