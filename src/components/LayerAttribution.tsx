import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {useLayers} from '../api/hooks';
import {
  LAYER_LABEL,
  LAYER_ORDER,
  LAYER_SOURCES,
  type LayerVisibility,
} from '../config/layers';

type Props = {visibility: LayerVisibility};

/**
 * Credit for the overlay data currently on the map.
 *
 * The attribution is not a constant: it comes from `GET /v1/layers`, per layer,
 * and the layers do not share one. Expressways and Metra are OpenStreetMap, the
 * bus layers are the CTA's own published data, and rail stations are both — OSM
 * geometry with CTA stop ids. Displaying one hardcoded OSM line would credit
 * the wrong source for half the map and would silently go stale the first time
 * a layer changed upstream.
 *
 * Collapsed it is one line, because this sits over the map; tapping expands it
 * to the full per-layer list. Only layers that are switched on are credited —
 * an attribution for data that is not being shown is noise.
 */
export function LayerAttribution({visibility}: Props) {
  const index = useLayers();
  const [expanded, setExpanded] = useState(false);

  const credits = useMemo(() => {
    if (!index.data) {
      return [];
    }
    const byKey = new Map(index.data.layers.map(meta => [meta.key, meta]));

    // Grouped by attribution text rather than listed per layer: with rail on,
    // "lines" and "stations" would otherwise repeat the same OSM sentence.
    const grouped = new Map<string, string[]>();
    for (const layer of LAYER_ORDER) {
      if (!visibility[layer]) {
        continue;
      }
      for (const source of LAYER_SOURCES[layer] ?? []) {
        const attribution = byKey.get(source)?.attribution;
        if (!attribution) {
          continue;
        }
        const labels = grouped.get(attribution) ?? [];
        if (!labels.includes(LAYER_LABEL[layer])) {
          labels.push(LAYER_LABEL[layer]);
        }
        grouped.set(attribution, labels);
      }
    }
    return [...grouped].map(([attribution, labels]) => ({attribution, labels}));
  }, [index.data, visibility]);

  if (credits.length === 0) {
    return null;
  }

  return (
    <Pressable
      testID="layer-attribution"
      onPress={() => setExpanded(previous => !previous)}
      style={styles.wrapper}
      accessibilityRole="button"
      accessibilityLabel={
        expanded ? 'Hide map data credits' : 'Show map data credits'
      }>
      {expanded ? (
        <View style={styles.list}>
          {credits.map(({attribution, labels}) => (
            <Text key={attribution} style={styles.text}>
              <Text style={styles.label}>{labels.join(', ')}: </Text>
              {attribution}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.text} numberOfLines={1}>
          {summarize(credits)}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * The collapsed line. One source is named outright; more than one is counted,
 * since two full attributions do not fit on a phone in one line and a
 * truncated credit credits nobody.
 */
function summarize(credits: {attribution: string}[]): string {
  if (credits.length === 1) {
    return `Data: ${credits[0].attribution}`;
  }
  return `Data: ${credits.length} sources — tap for credits`;
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
    maxWidth: '78%',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  list: {gap: 4},
  text: {fontSize: 10, lineHeight: 14, color: '#4b5563'},
  label: {fontWeight: '700', color: '#374151'},
});
