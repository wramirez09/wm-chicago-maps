/**
 * react-native-permissions is a native module and throws at import time under
 * Jest. The package ships an official mock; this re-exports it.
 *
 * Imported via the public `/mock` subpath: the package's `exports` map blocks
 * deep paths into dist/, and under `require` that subpath already resolves to
 * the CommonJS build this project's Jest config can load.
 *
 * Picked up automatically for node_modules packages — no jest.mock() needed.
 */
module.exports = require('react-native-permissions/mock');
