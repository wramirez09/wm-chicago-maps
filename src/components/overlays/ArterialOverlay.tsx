import {GeoJSONSource, Layer} from '@maplibre/maplibre-react-native';
import React from 'react';

import {FONT_REGULAR, LABEL_ANCHOR_LAYER_ID} from '../../config/map';
import {ARTERIALS} from '../../data/arterials';
import type {OverlayPressHandler} from './types';

export const ARTERIAL_ACCENT = '#b45309';

const SOURCE_ID = 'arterials';

type Props = {
  visible: boolean;
  onPress: OverlayPressHandler;
};

export function ArterialOverlay({visible, onPress}: Props) {
  if (!visible) {
    return null;
  }

  return (
    <GeoJSONSource id={SOURCE_ID} data={ARTERIALS} onPress={onPress}>
      <Layer
        id="arterials-line"
        type="line"
        source={SOURCE_ID}
        beforeId={LABEL_ANCHOR_LAYER_ID}
        minzoom={10}
        layout={{'line-cap': 'round', 'line-join': 'round'}}
        paint={{
          'line-color': [
            'match',
            ['get', 'kind'],
            'primary',
            ARTERIAL_ACCENT,
            '#d97706',
          ],
          'line-width': [
            'interpolate',
            ['exponential', 1.5],
            ['zoom'],
            10,
            1,
            14,
            3.5,
            18,
            10,
          ],
          'line-opacity': 0.85,
        }}
      />
      {/* Street names only once the grid is legible — below z13 the labels
          collide into mush on a city this dense. */}
      <Layer
        id="arterials-label"
        type="symbol"
        source={SOURCE_ID}
        beforeId={LABEL_ANCHOR_LAYER_ID}
        minzoom={13}
        layout={{
          'text-field': ['get', 'name'],
          'text-font': FONT_REGULAR,
          'text-size': 11,
          'symbol-placement': 'line',
          'symbol-spacing': 300,
        }}
        paint={{
          'text-color': '#7c2d12',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        }}
      />
    </GeoJSONSource>
  );
}
