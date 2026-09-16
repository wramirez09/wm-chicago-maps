import {GeoJSONSource, Layer} from '@maplibre/maplibre-react-native';
import React from 'react';

import {FONT_REGULAR} from '../../config/map';
import {LANDMARKS} from '../../data/landmarks';
import type {OverlayPressHandler} from './types';

export const LANDMARK_ACCENT = '#e4572e';

const SOURCE_ID = 'landmarks';

type Props = {
  visible: boolean;
  onPress: OverlayPressHandler;
};

export function LandmarkOverlay({visible, onPress}: Props) {
  if (!visible) {
    return null;
  }

  // No `beforeId` here: landmarks are the app's own points of interest and
  // should sit on top of everything, basemap labels included.
  return (
    <GeoJSONSource id={SOURCE_ID} data={LANDMARKS} onPress={onPress}>
      <Layer
        id="landmarks-circle"
        type="circle"
        source={SOURCE_ID}
        paint={{
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 5, 15, 11],
          'circle-color': LANDMARK_ACCENT,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        }}
      />
      <Layer
        id="landmarks-label"
        type="symbol"
        source={SOURCE_ID}
        minzoom={11}
        layout={{
          'text-field': ['get', 'name'],
          'text-font': FONT_REGULAR,
          'text-size': 12,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-allow-overlap': false,
        }}
        paint={{
          'text-color': '#1f2937',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.4,
        }}
      />
    </GeoJSONSource>
  );
}
