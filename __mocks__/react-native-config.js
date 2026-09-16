/**
 * react-native-config reads `.env` during the *native* build, so under Jest it
 * resolves to an empty object and every `requireEnv` call would throw.
 *
 * This mock supplies deterministic values so client tests can exercise the
 * request-building code. Jest picks it up automatically for node_modules
 * packages — no jest.mock() call needed in individual tests.
 */
module.exports = {
  __esModule: true,
  default: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    CTA_TRAIN_KEY: 'test-cta-train-key',
    CTA_BUS_KEY: 'test-cta-bus-key',
    METRA_KEY: 'test-metra-key',
    METRA_SECRET: 'test-metra-secret',
    TICKETMASTER_KEY: 'test-ticketmaster-key',
    BANDSINTOWN_APP_ID: 'test-bandsintown-app-id',
    SOCRATA_APP_TOKEN: 'test-socrata-token',
    PHOTON_URL: 'https://photon.test',
    VALHALLA_URL: 'https://valhalla.test',
  },
};
