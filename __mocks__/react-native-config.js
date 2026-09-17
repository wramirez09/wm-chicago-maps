/**
 * react-native-config reads `.env` during the *native* build, so under Jest it
 * resolves to an empty object. This supplies the keys the app reads, so code
 * that builds URLs from them can be exercised.
 *
 * Jest picks this up automatically for node_modules packages — no jest.mock()
 * call needed in individual tests.
 */
module.exports = {
  __esModule: true,
  default: {
    API_URL: 'http://api.test',
  },
};
