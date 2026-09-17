module.exports = {
  preset: '@react-native/jest-preset',
  // Vendored backend contract; see metro.config.js for why it is not a package.
  moduleNameMapper: {
    '^@wm/shared$': '<rootDir>/src/api/schema/index.ts',
  },
  // Default testMatch collects everything under __tests__/, which swept up the
  // shared helper file and failed it for having no tests.
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  // Several dependencies ship untranspiled ESM and have to go through babel.
  // `react-native[^/]*` rather than `react-native` — the latter matched only
  // the core package's own directory, so react-native-url-polyfill and friends
  // were skipped and failed with "Cannot use import statement outside a module".
  transformIgnorePatterns: [
    'node_modules/(?!(?:@react-native(?:-community)?|react-native[^/]*|@maplibre)/)',
  ],
};
