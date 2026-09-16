module.exports = {
  preset: '@react-native/jest-preset',
  // The MapLibre package ships untranspiled ESM, so it has to go through babel.
  transformIgnorePatterns: [
    'node_modules/(?!(?:@react-native|react-native|@maplibre)/)',
  ],
};
