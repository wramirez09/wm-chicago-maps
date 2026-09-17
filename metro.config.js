const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * `@wm/shared` is the backend's contract (zod schemas). It is vendored into
 * src/api/schema rather than installed: npm cannot install a subdirectory of a
 * git repo (it ignores `&path:` and installs the whole monorepo), and the
 * package depends on pnpm `workspace:` packages. The alias keeps imports
 * reading `@wm/shared`, so moving to a published package later changes no
 * import. Mirrored in tsconfig.json `paths` and jest.config.js.
 */
const SHARED_ENTRY = path.resolve(__dirname, 'src/api/schema/index.ts');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === '@wm/shared') {
        return {type: 'sourceFile', filePath: SHARED_ENTRY};
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
