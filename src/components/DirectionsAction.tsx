import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';

import type {RouteResult} from '../api/types';

type Props = {
  route: RouteResult | null;
  loading: boolean;
  error: string | null;
  onRequest: () => void;
  onClear: () => void;
};

/** "Walk here" — routes from the user's location to the selected feature. */
export function DirectionsAction({route, loading, error, onRequest, onClear}: Props) {
  if (route) {
    return (
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          🚶 {formatDuration(route.durationSeconds)} · {formatDistance(route.distanceMeters)}
        </Text>
        <Pressable onPress={onClear} hitSlop={8} accessibilityRole="button">
          <Text style={styles.clear}>Clear</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={onRequest}
        disabled={loading}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Walking directions here">
        {loading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>Walk here</Text>
        )}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** Miles, because this is a Chicago app; the API answers in metres. */
function formatDistance(meters: number): string {
  const miles = meters / 1609.344;
  return miles < 0.1 ? `${Math.round(miles * 5280)} ft` : `${miles.toFixed(1)} mi`;
}

const styles = StyleSheet.create({
  wrapper: {marginTop: 10, gap: 6, alignItems: 'flex-start'},
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 96,
    alignItems: 'center',
  },
  buttonText: {color: '#ffffff', fontSize: 14, fontWeight: '600'},
  summary: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryText: {fontSize: 14, fontWeight: '600', color: '#1e3a8a'},
  clear: {fontSize: 13, color: '#2563eb', fontWeight: '600'},
  error: {fontSize: 12, color: '#b91c1c'},
});
