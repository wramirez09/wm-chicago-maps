import {QueryClientProvider} from '@tanstack/react-query';
import React, {useEffect, useState} from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {MapScreen} from './src/components/MapScreen';
import {createQueryClient} from './src/lib/query';
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
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <View style={styles.root}>
          <MapScreen />
        </View>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

export default App;

const styles = StyleSheet.create({
  root: {flex: 1},
});
