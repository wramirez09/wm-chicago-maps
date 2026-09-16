import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {useCurrentWeather} from '../lib/api/plumbing/hooks';

type Props = {
  /** Map centre. Rounded by the caller so panning does not refetch endlessly. */
  coordinates: {latitude: number; longitude: number} | null;
};

/**
 * Current conditions from Open-Meteo. No key, no signup.
 *
 * Renders nothing at all until it has data: a permanent "—°" placeholder on
 * top of the map is worse than no chip, and this is decoration, not a feature
 * anyone is waiting on.
 */
export function WeatherChip({coordinates}: Props) {
  const {data, isError} = useCurrentWeather(coordinates);

  if (isError || !data || data.temperature === null) {
    return null;
  }

  return (
    <View style={styles.chip}>
      <Text style={styles.temperature}>
        {Math.round(data.temperature)}
        {data.units.temperature}
      </Text>
      <Text style={styles.description} numberOfLines={1}>
        {data.description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 11,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
    elevation: 3,
  },
  temperature: {fontSize: 13, fontWeight: '700', color: '#111827'},
  description: {fontSize: 12, color: '#6b7280'},
});
