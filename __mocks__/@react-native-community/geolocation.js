/**
 * @react-native-community/geolocation is a native module and throws "doesn't
 * seem to be linked" at import time under Jest. It ships no official mock, so
 * this covers the calls src/lib/device/location.ts makes.
 *
 * getCurrentPosition resolves with the Loop, so a test that exercises the
 * locate flow gets a plausible Chicago fix rather than a callback that never
 * fires and hangs the test.
 */
const position = {
  coords: {
    latitude: 41.8781,
    longitude: -87.6298,
    accuracy: 10,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: 0,
};

const Geolocation = {
  getCurrentPosition: jest.fn(success => success(position)),
  watchPosition: jest.fn(() => 1),
  clearWatch: jest.fn(),
  stopObserving: jest.fn(),
  requestAuthorization: jest.fn(),
  setRNConfiguration: jest.fn(),
};

module.exports = {__esModule: true, default: Geolocation, ...Geolocation};
