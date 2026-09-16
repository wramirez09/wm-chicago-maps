/**
 * Open-Meteo — current conditions for the events feed. No key, no signup.
 *
 * Docs: https://open-meteo.com/en/docs
 *
 * `current` takes a comma-separated variable list and returns one object plus
 * a matching `current_units`. Times are ISO 8601 in the requested timezone.
 */
import {fetchJson} from '../http';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

/** WMO weather interpretation codes: https://open-meteo.com/en/docs */
export type WeatherCode = number;

export type OpenMeteoResponse = {
  latitude: number;
  longitude: number;
  timezone?: string;
  current_units?: Record<string, string>;
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    weather_code?: WeatherCode;
    wind_speed_10m?: number;
    is_day?: number;
  };
};

export type CurrentWeather = {
  observedAt: Date | null;
  temperature: number | null;
  feelsLike: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  weatherCode: WeatherCode | null;
  description: string;
  isDay: boolean;
  units: {temperature: string; wind: string; precipitation: string};
};

export async function fetchCurrentWeather(
  latitude: number,
  longitude: number,
  options: {imperial?: boolean; signal?: AbortSignal} = {},
): Promise<CurrentWeather> {
  const imperial = options.imperial ?? true;

  const response = await fetchJson<OpenMeteoResponse>(BASE_URL, {
    query: {
      latitude,
      longitude,
      current: [
        'temperature_2m',
        'apparent_temperature',
        'relative_humidity_2m',
        'precipitation',
        'weather_code',
        'wind_speed_10m',
        'is_day',
      ].join(','),
      temperature_unit: imperial ? 'fahrenheit' : 'celsius',
      wind_speed_unit: imperial ? 'mph' : 'kmh',
      precipitation_unit: imperial ? 'inch' : 'mm',
      timezone: 'America/Chicago',
    },
    signal: options.signal,
  });

  const current = response.current ?? {};
  const observedAt = current.time ? new Date(current.time) : null;

  return {
    observedAt: observedAt && !Number.isNaN(observedAt.getTime()) ? observedAt : null,
    temperature: current.temperature_2m ?? null,
    feelsLike: current.apparent_temperature ?? null,
    precipitation: current.precipitation ?? null,
    windSpeed: current.wind_speed_10m ?? null,
    weatherCode: current.weather_code ?? null,
    description: describeWeather(current.weather_code),
    isDay: current.is_day !== 0,
    units: {
      temperature: response.current_units?.temperature_2m ?? (imperial ? '°F' : '°C'),
      wind: response.current_units?.wind_speed_10m ?? (imperial ? 'mph' : 'km/h'),
      precipitation: response.current_units?.precipitation ?? (imperial ? 'in' : 'mm'),
    },
  };
}

/** WMO code → plain English. Grouped; the full table has ~28 values. */
export function describeWeather(code: WeatherCode | undefined): string {
  if (code === undefined) {
    return 'Unknown';
  }
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Fog';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  return 'Thunderstorm';
}
