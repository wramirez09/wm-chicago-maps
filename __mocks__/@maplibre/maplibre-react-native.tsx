/**
 * MapLibre is a native module, so it cannot render under Jest. This mock swaps
 * every component for a plain View (or null for the non-rendering ones) so tests
 * can exercise the surrounding React tree.
 *
 * Jest picks this up automatically for `node_modules` packages — no jest.mock()
 * call is needed in individual test files.
 */
import React, {type ReactNode} from 'react';
import {View} from 'react-native';

const passthrough =
  (testID: string) =>
  ({children}: {children?: ReactNode}) =>
    <View testID={testID}>{children}</View>;

const nullComponent = () => null;

export const Map = passthrough('maplibre-map');
export const GeoJSONSource = passthrough('maplibre-geojson-source');
export const VectorSource = passthrough('maplibre-vector-source');
export const RasterSource = passthrough('maplibre-raster-source');
export const ImageSource = passthrough('maplibre-image-source');
export const Marker = passthrough('maplibre-marker');
export const Callout = passthrough('maplibre-callout');
export const ViewAnnotation = passthrough('maplibre-view-annotation');

export const Camera = nullComponent;
export const Layer = nullComponent;
export const Images = nullComponent;
export const UserLocation = nullComponent;
export const NativeUserLocation = nullComponent;

export const LocationManager = {
  start: jest.fn(),
  stop: jest.fn(),
  getLastKnownLocation: jest.fn(async () => null),
};
export const LogManager = {setLogLevel: jest.fn()};
export const OfflineManager = {createPack: jest.fn(), getPacks: jest.fn(async () => [])};
export const useCurrentPosition = () => undefined;
