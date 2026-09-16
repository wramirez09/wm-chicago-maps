import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Linking, Pressable, StyleSheet, Text, View} from 'react-native';

import {
  type Coordinates,
  getCurrentPosition,
  requestLocationPermission,
} from '../lib/device/location';

type Props = {
  onLocated: (coordinates: Coordinates) => void;
};

/**
 * Centres the map on the user.
 *
 * Permission is requested on tap, not at launch: asking before the user has
 * shown any interest in their location is the most reliable way to get a
 * permanent "Don't Allow", after which iOS never shows the prompt again.
 */
export function LocateButton({onLocated}: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  const locate = useCallback(async () => {
    setBusy(true);
    setMessage(null);

    try {
      const status = await requestLocationPermission();

      if (status === 'blocked') {
        // The OS will not prompt again; only Settings can undo this.
        setBlocked(true);
        setMessage('Location is off for this app.');
        return;
      }
      if (status !== 'granted') {
        setMessage(
          status === 'unavailable'
            ? 'Location is not available on this device.'
            : 'Location permission was not granted.',
        );
        return;
      }

      onLocated(await getCurrentPosition({timeoutMs: 12_000}));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not get your location.');
    } finally {
      setBusy(false);
    }
  }, [onLocated]);

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      {message ? (
        <Pressable
          style={styles.message}
          onPress={() => (blocked ? Linking.openSettings() : setMessage(null))}>
          <Text style={styles.messageText}>
            {message}
            {blocked ? ' Open Settings' : ''}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={locate}
        disabled={busy}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Show my location">
        {busy ? (
          <ActivityIndicator size="small" color="#2563eb" />
        ) : (
          <Text style={styles.icon}>◎</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {alignItems: 'flex-end', gap: 8},
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
    elevation: 4,
  },
  icon: {fontSize: 22, color: '#2563eb', marginTop: -2},
  message: {
    maxWidth: 220,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  messageText: {fontSize: 12, color: '#ffffff'},
});
