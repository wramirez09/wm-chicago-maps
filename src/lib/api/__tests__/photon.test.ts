import {geocode, reverseGeocode} from '../places/photon';
import {mockFetchOnce, queryOf} from './testUtils';

const RESPONSE = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {type: 'Point', coordinates: [-87.6553, 41.9484]},
      properties: {
        name: 'Wrigley Field',
        housenumber: '1060',
        street: 'West Addison Street',
        city: 'Chicago',
        state: 'Illinois',
        osm_key: 'leisure',
      },
    },
  ],
};

describe('geocode', () => {
  it('bbox-locks the search to Chicago', async () => {
    const {calls, restore} = mockFetchOnce(RESPONSE);

    await geocode('Wrigley');

    expect(queryOf(calls[0].url).bbox).toBe('-87.94,41.64,-87.52,42.03');
    restore();
  });

  it('builds a label from the name and the address parts', async () => {
    const {restore} = mockFetchOnce(RESPONSE);

    const [result] = await geocode('Wrigley');

    expect(result.label).toBe('Wrigley Field, 1060 West Addison Street, Chicago, Illinois');
    expect(result.latitude).toBeCloseTo(41.9484);
    expect(result.longitude).toBeCloseTo(-87.6553);
    restore();
  });

  it('leads with the street when there is no POI name', async () => {
    const {restore} = mockFetchOnce({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {type: 'Point', coordinates: [-87.63, 41.88]},
          properties: {housenumber: '233', street: 'South Wacker Drive', city: 'Chicago'},
        },
      ],
    });

    const [result] = await geocode('233 S Wacker');
    expect(result.label).toBe('233 South Wacker Drive, Chicago');
    restore();
  });

  it('does not call the service for a one-character query', async () => {
    const {calls, restore} = mockFetchOnce(RESPONSE);
    await expect(geocode('W')).resolves.toEqual([]);
    expect(calls).toHaveLength(0);
    restore();
  });
});

describe('reverseGeocode', () => {
  it('sends lon and lat in Photon\'s parameter order', async () => {
    const {calls, restore} = mockFetchOnce(RESPONSE);

    await reverseGeocode(-87.63, 41.88);

    expect(queryOf(calls[0].url)).toMatchObject({lon: '-87.63', lat: '41.88'});
    expect(calls[0].url).toContain('/reverse');
    restore();
  });
});
