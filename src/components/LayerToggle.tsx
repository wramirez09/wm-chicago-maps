import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {
  LAYER_ACCENT,
  LAYER_LABEL,
  LAYER_ORDER,
  type LayerKey,
  type LayerVisibility,
} from '../config/layers';

type Props = {
  visibility: LayerVisibility;
  onToggle: (key: LayerKey) => void;
};

export function LayerToggle({visibility, onToggle}: Props) {
  // One scrolling row rather than a wrapping block: with a dozen layers, the
  // wrapped chips grew to three rows and covered the top third of the map.
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled">
      {LAYER_ORDER.map(key => {
        const on = visibility[key];
        // Built out here rather than inline: the swatch colour is data, and the
        // no-inline-styles lint rule can't tell those apart.
        const dotStyle = {
          backgroundColor: on ? LAYER_ACCENT[key] : 'transparent',
          borderColor: LAYER_ACCENT[key],
        };
        return (
          <Pressable
            key={key}
            onPress={() => onToggle(key)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="switch"
            accessibilityState={{checked: on}}
            accessibilityLabel={LAYER_LABEL[key]}>
            <View style={[styles.dot, dotStyle]} />
            <Text style={[styles.label, on && styles.labelOn]}>
              {LAYER_LABEL[key]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Vertical padding so the chips' shadows are not clipped by the scroll view.
  row: {flexDirection: 'row', gap: 8, paddingVertical: 4, paddingRight: 8},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  chipOn: {backgroundColor: '#ffffff'},
  dot: {width: 9, height: 9, borderRadius: 5, borderWidth: 1.5},
  label: {fontSize: 12, color: '#9ca3af', fontWeight: '500'},
  labelOn: {color: '#111827', fontWeight: '600'},
});
