/**
 * VENDORED from wramirez09/wm-chicago-maps-backend packages/shared/src/index.ts
 * at commit 883b4f761de8a60baeb30757ea27cc49f92b3fef. Do not edit here — change the backend and re-vendor.
 *
 * Only change from upstream: relative imports drop their ".js" suffix. The
 * backend is NodeNext ESM, where "./common.js" resolves to common.ts; Metro
 * does not do that mapping and fails to resolve the ".js" path.
 */
export * from './common';
export * from './places';
export * from './areas';
export * from './events';
export * from './layers';
export * from './transit';
export * from './route';
export * from './auth';
export * from './mod';
export * from './geocode';
