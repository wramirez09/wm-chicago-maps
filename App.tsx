import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MapScreen } from './src/components/MapScreen';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <View style={styles.root}>
        <MapScreen />
      </View>
    </SafeAreaProvider>
  );
}

export default App;

const styles = StyleSheet.create({
  root: { flex: 1 },
});
