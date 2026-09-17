import {PersistQueryClientProvider} from '@tanstack/react-query-persist-client';
import React, {useEffect, useState} from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {MapScreen} from './src/components/MapScreen';
import {createQueryClient, persistOptions} from './src/api/queryClient';
import {initObservability} from './src/lib/observability';

function App() {
  // One client for the app's lifetime. Created in state rather than at module
  // scope so a fast refresh does not swap it out and drop every cached query.
  const [queryClient] = useState(createQueryClient);

  useEffect(() => {
    // Safe to call with nothing configured — it no-ops and logs once.
    initObservability();
  }, []);

  return (
    // Restores layers and areas from disk before queries run, so the map draws
    // cached overlays immediately — including when the API is unreachable.
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <View style={styles.root}>
          <MapScreen />
        </View>
      </SafeAreaProvider>
    </PersistQueryClientProvider>
  );
}

export default App;

const styles = StyleSheet.create({
  root: {flex: 1},
});
