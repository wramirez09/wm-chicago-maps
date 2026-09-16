module.exports = {
  preset: '@react-native/jest-preset',
  // Default testMatch collects everything under __tests__/, which swept up the
  // shared helper file and failed it for having no tests.
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  // The MapLibre package ships untranspiled ESM, so it has to go through babel.
  transformIgnorePatterns: [
    'node_modules/(?!(?:@react-native|react-native|@maplibre)/)',
  ],
};
