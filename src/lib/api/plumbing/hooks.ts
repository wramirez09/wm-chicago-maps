/**
 * TanStack Query hooks for the plumbing clients.
 */
import {useQuery} from '@tanstack/react-query';

import {STALE_TIME} from '../../query';
import {fetchCurrentWeather} from './openMeteo';

export const plumbingKeys = {
  weather: (latitude: number, longitude: number, imperial: boolean) =>
    ['plumbing', 'weather', latitude, longitude, imperial] as const,
};

export function useCurrentWeather(
  coordinates: {latitude: number; longitude: number} | null,
  options: {imperial?: boolean} = {},
) {
  const imperial = options.imperial ?? true;
  const {latitude = 0, longitude = 0} = coordinates ?? {};

  return useQuery({
    queryKey: plumbingKeys.weather(latitude, longitude, imperial),
    queryFn: ({signal}) => fetchCurrentWeather(latitude, longitude, {imperial, signal}),
    staleTime: STALE_TIME.weather,
    refetchInterval: STALE_TIME.weather,
    enabled: Boolean(coordinates),
  });
}
