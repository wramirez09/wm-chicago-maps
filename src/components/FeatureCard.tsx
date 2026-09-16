import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

/** Whatever the user last tapped on the map, flattened for display. */
export type MapSelection = {
  title: string;
  subtitle: string;
  /** Swatch colour, so the card reads as belonging to the layer it came from. */
  accent: string;
};

type Props = {
  selection: MapSelection;
  onDismiss: () => void;
};

export function FeatureCard({selection, onDismiss}: Props) {
  return (
    <View style={styles.card}>
      <View style={[styles.swatch, {backgroundColor: selection.accent}]} />
      <View style={styles.text}>
        <Text style={styles.name}>{selection.title}</Text>
        {selection.subtitle ? (
          <Text style={styles.subtitle}>{selection.subtitle}</Text>
        ) : null}
      </View>
      <Pressable
        onPress={onDismiss}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Dismiss">
        <Text style={styles.dismiss}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  swatch: {width: 6, alignSelf: 'stretch', borderRadius: 3},
  text: {flex: 1},
  name: {fontSize: 17, fontWeight: '600', color: '#111827'},
  subtitle: {marginTop: 2, fontSize: 14, color: '#6b7280'},
  dismiss: {fontSize: 18, color: '#9ca3af', paddingHorizontal: 4},
});
