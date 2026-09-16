import React from 'react';
import {ActivityIndicator, Linking, Pressable, StyleSheet, Text, View} from 'react-native';

import {useNeighborhoodSummary} from '../lib/api/neighborhoods/hooks';

type Props = {
  /** A community-area name, e.g. "Hyde Park". */
  neighborhood: string;
};

/**
 * The Wikipedia lead paragraph for a neighbourhood.
 *
 * Wikipedia text is CC BY-SA 4.0, which requires attribution with a link
 * wherever the text is shown — so the source line is not optional styling, it
 * is the licence condition, and it renders whenever the extract does.
 */
export function NeighborhoodSummary({neighborhood}: Props) {
  const {data, isLoading, isError} = useNeighborhoodSummary(neighborhood);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color="#9ca3af" />
      </View>
    );
  }

  // No article, a disambiguation page, or offline: say nothing rather than
  // show an error for what is supplementary context.
  if (isError || !data) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.extract} numberOfLines={4}>
        {data.extract}
      </Text>
      {data.pageUrl ? (
        <Pressable
          onPress={() => Linking.openURL(data.pageUrl!)}
          accessibilityRole="link"
          hitSlop={8}>
          <Text style={styles.attribution}>Wikipedia · CC BY-SA 4.0</Text>
        </Pressable>
      ) : (
        <Text style={styles.attribution}>Wikipedia · CC BY-SA 4.0</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {paddingTop: 10, alignItems: 'flex-start'},
  container: {marginTop: 10, gap: 6},
  extract: {fontSize: 13, lineHeight: 18, color: '#374151'},
  attribution: {fontSize: 11, color: '#2563eb'},
});
