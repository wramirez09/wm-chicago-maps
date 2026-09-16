import {describeWeather, fetchCurrentWeather} from '../plumbing/openMeteo';
import weather from '../__fixtures__/openMeteo.json';
import {mockFetchOnce, queryOf} from './testUtils';

describe('fetchCurrentWeather', () => {
  it('maps the current block and carries the units through', async () => {
    const {restore} = mockFetchOnce(weather);

    const result = await fetchCurrentWeather(41.88, -87.63);

    expect(typeof result.temperature).toBe('number');
    expect(result.units.temperature).toBeTruthy();
    expect(result.observedAt).toBeInstanceOf(Date);
    expect(typeof result.description).toBe('string');
    restore();
  });

  it('requests Chicago time and imperial units by default', async () => {
    const {calls, restore} = mockFetchOnce(weather);

    await fetchCurrentWeather(41.88, -87.63);

    expect(queryOf(calls[0].url)).toMatchObject({
      timezone: 'America/Chicago',
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
    });
    restore();
  });

  it('switches to metric when asked', async () => {
    const {calls, restore} = mockFetchOnce(weather);
    await fetchCurrentWeather(41.88, -87.63, {imperial: false});
    expect(queryOf(calls[0].url).temperature_unit).toBe('celsius');
    restore();
  });

  it('survives a response with no current block', async () => {
    const {restore} = mockFetchOnce({latitude: 41.88, longitude: -87.63});

    const result = await fetchCurrentWeather(41.88, -87.63);

    expect(result.temperature).toBeNull();
    expect(result.observedAt).toBeNull();
    expect(result.description).toBe('Unknown');
    restore();
  });
});

describe('describeWeather', () => {
  it('maps WMO codes to plain English', () => {
    expect(describeWeather(0)).toBe('Clear');
    expect(describeWeather(3)).toBe('Overcast');
    expect(describeWeather(65)).toBe('Rain');
    expect(describeWeather(95)).toBe('Thunderstorm');
    expect(describeWeather(undefined)).toBe('Unknown');
  });
});
