import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Linking, Pressable, StyleSheet, Text, View} from 'react-native';

import {
  type Coordinates,
  getCurrentPosition,
  requestLocationPermission,
} from '../lib/device/location';
import {nextRecenterMode, type RecenterMode} from '../lib/recenter';

type Props = {
  mode: RecenterMode;
  /** A fresh fix from the off state. The parent eases there and starts following. */
  onLocated: (coordinates: Coordinates) => void;
  /** Tapped while already following: cycle follow ⇄ heading. */
  onModeChange: (mode: RecenterMode) => void;
};

const BLUE = '#1a73e8';
const GREY = '#5f6368';

const LABELS: Record<RecenterMode, string> = {
  off: 'Show my location',
  follow: 'Following your location. Tap to follow compass direction',
  heading: 'Following compass direction. Tap to reset to north',
};

/**
 * Google Maps-style recenter button.
 *
 * Permission is requested on tap, not at launch: asking before the user has
 * shown any interest in their location is the most reliable way to get a
 * permanent "Don't Allow", after which iOS never shows the prompt again.
 */
export function LocateButton({mode, onLocated, onModeChange}: Props) {
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

  const handlePress = useCallback(() => {
    if (mode === 'off') {
      locate();
    } else {
      onModeChange(nextRecenterMode(mode));
    }
  }, [locate, mode, onModeChange]);

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
        testID="recenter-button"
        onPress={handlePress}
        disabled={busy}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel={LABELS[mode]}
        accessibilityState={{selected: mode !== 'off', busy}}>
        {busy ? (
          <ActivityIndicator size="small" color={BLUE} />
        ) : mode === 'heading' ? (
          <HeadingIcon />
        ) : (
          <CrosshairIcon active={mode === 'follow'} />
        )}
      </Pressable>
    </View>
  );
}

/**
 * The "my location" crosshair: a ring with four ticks. Hollow and grey while
 * the map is free, blue with a filled centre while following. Drawn with
 * Views so it needs no icon font or asset.
 */
function CrosshairIcon({active}: {active: boolean}) {
  const color = active ? BLUE : GREY;
  return (
    <View testID={active ? 'icon-follow' : 'icon-off'} style={styles.icon}>
      <View style={[styles.tick, styles.tickTop, {backgroundColor: color}]} />
      <View style={[styles.tick, styles.tickBottom, {backgroundColor: color}]} />
      <View style={[styles.tickH, styles.tickLeft, {backgroundColor: color}]} />
      <View style={[styles.tickH, styles.tickRight, {backgroundColor: color}]} />
      <View style={[styles.ring, {borderColor: color}]}>
        {active ? <View style={styles.dot} /> : null}
      </View>
    </View>
  );
}

/** Compass mode: a blue arrow pointing up, like Google's navigation arrow. */
function HeadingIcon() {
  return (
    <View testID="icon-heading" style={styles.icon}>
      <View style={styles.arrow} />
    </View>
  );
}

const ICON = 22;
const RING = 14;

const styles = StyleSheet.create({
  wrapper: {alignItems: 'flex-end', gap: 8},
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
    elevation: 4,
  },
  icon: {
    width: ICON,
    height: ICON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {width: 6, height: 6, borderRadius: 3, backgroundColor: BLUE},
  tick: {position: 'absolute', width: 2, height: 4, left: (ICON - 2) / 2},
  tickTop: {top: 0},
  tickBottom: {bottom: 0},
  tickH: {position: 'absolute', width: 4, height: 2, top: (ICON - 2) / 2},
  tickLeft: {left: 0},
  tickRight: {right: 0},
  // A CSS-border triangle, nudged up so its visual centre sits mid-button.
  arrow: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: BLUE,
  },
  message: {
    maxWidth: 220,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  messageText: {fontSize: 12, color: '#ffffff'},
});
