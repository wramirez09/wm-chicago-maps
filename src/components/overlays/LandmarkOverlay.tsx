import {GeoJSONSource, Layer} from '@maplibre/maplibre-react-native';
import React from 'react';

import {LAYER_ACCENT} from '../../config/layers';
import {FONT_REGULAR} from '../../config/map';
import type {PlaceCollection} from '@wm/shared';

import {EMPTY_COLLECTION} from '../../lib/geo';
import type {OverlayPressHandler} from './types';

const SOURCE_ID = 'landmarks';

type Props = {
  visible: boolean;
  /** From usePlaces(viewport, 'landmark'); undefined while loading. */
  data: PlaceCollection | undefined;
  onPress: OverlayPressHandler;
};

/**
 * The app's places layer, currently landmarks. Mounts with an empty collection
 * while loading, like the other API-backed overlays.
 */
export function LandmarkOverlay({visible, data, onPress}: Props) {
  if (!visible) {
    return null;
  }

  // No `beforeId` here: landmarks are the app's own points of interest and
  // should sit on top of everything, basemap labels included.
  return (
    <GeoJSONSource id={SOURCE_ID} data={data ?? EMPTY_COLLECTION} onPress={onPress}>
      <Layer
        id="landmarks-circle"
        type="circle"
        source={SOURCE_ID}
        paint={{
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 5, 15, 11],
          'circle-color': LAYER_ACCENT.landmarks,
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
