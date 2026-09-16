import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import type {EnvKey} from '../lib/api/env';

type Props = {
  /** What the missing key would unlock, e.g. "Live train arrivals". */
  feature: string;
  envKey: EnvKey;
};

/**
 * Shown in place of a live feed whose key is not configured.
 *
 * Says exactly what to do, including the rebuild: react-native-config inlines
 * .env at native build time, so the natural next step — editing .env and
 * reloading — silently does nothing, and that is the trap worth naming.
 */
export function KeyHint({feature, envKey}: Props) {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>
        {feature} needs <Text style={styles.code}>{envKey}</Text> in .env, then
        a rebuild (npm run ios).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 8,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  text: {fontSize: 12, lineHeight: 16, color: '#78350f'},
  code: {fontFamily: 'Menlo', fontSize: 11, fontWeight: '600'},
});
