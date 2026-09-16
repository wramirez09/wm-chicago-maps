import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {ARTERIAL_ACCENT} from './overlays/ArterialOverlay';
import {EXPRESSWAY_ACCENT} from './overlays/ExpresswayOverlay';
import {LANDMARK_ACCENT} from './overlays/LandmarkOverlay';
import {TRANSIT_ACCENT} from './overlays/TransitOverlay';
import type {LayerKey, LayerVisibility} from './overlays/types';

const LAYERS: {key: LayerKey; label: string; accent: string}[] = [
  {key: 'expressways', label: 'Expressways', accent: EXPRESSWAY_ACCENT},
  {key: 'arterials', label: 'Streets', accent: ARTERIAL_ACCENT},
  {key: 'transit', label: 'CTA rail', accent: TRANSIT_ACCENT},
  {key: 'landmarks', label: 'Landmarks', accent: LANDMARK_ACCENT},
];

type Props = {
  visibility: LayerVisibility;
  onToggle: (key: LayerKey) => void;
};

export function LayerToggle({visibility, onToggle}: Props) {
  return (
    <View style={styles.row}>
      {LAYERS.map(({key, label, accent}) => {
        const on = visibility[key];
        // Built out here rather than inline: the swatch colour is data, and the
        // no-inline-styles lint rule can't tell those apart.
        const dotStyle = {
          backgroundColor: on ? accent : 'transparent',
          borderColor: accent,
        };
        return (
          <Pressable
            key={key}
            onPress={() => onToggle(key)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="switch"
            accessibilityState={{checked: on}}
            accessibilityLabel={label}>
            <View style={[styles.dot, dotStyle]} />
            <Text style={[styles.label, on && styles.labelOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
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
