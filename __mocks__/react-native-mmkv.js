/**
 * react-native-mmkv v4 imports react-native-nitro-modules at module load, and
 * Nitro asks TurboModuleRegistry for its native module immediately — which
 * throws under Jest before createMMKV's own test-environment check can run.
 * So MMKV is replaced wholesale with an in-memory store.
 *
 * Covers the methods the app uses. Each id gets its own store, as on device.
 *
 * Picked up automatically for node_modules packages — no jest.mock() needed.
 */
const stores = new Map();

function createMMKV(configuration = {}) {
  const id = configuration.id ?? 'mmkv.default';
  if (!stores.has(id)) {
    stores.set(id, new Map());
  }
  const data = stores.get(id);

  return {
    id,
    set: (key, value) => {
      data.set(key, value);
    },
    getString: key => {
      const value = data.get(key);
      return typeof value === 'string' ? value : undefined;
    },
    getNumber: key => {
      const value = data.get(key);
      return typeof value === 'number' ? value : undefined;
    },
    getBoolean: key => {
      const value = data.get(key);
      return typeof value === 'boolean' ? value : undefined;
    },
    contains: key => data.has(key),
    remove: key => data.delete(key),
    getAllKeys: () => [...data.keys()],
    clearAll: () => data.clear(),
    addOnValueChangedListener: () => ({remove: () => {}}),
  };
}

module.exports = {__esModule: true, createMMKV};
