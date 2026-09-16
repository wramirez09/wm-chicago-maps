import {GeoJSONSource, Layer} from '@maplibre/maplibre-react-native';
import React from 'react';

import {FONT_REGULAR, LABEL_ANCHOR_LAYER_ID} from '../../config/map';
import {TRANSIT_LINES, TRANSIT_STATIONS} from '../../data/transit';
import type {OverlayPressHandler} from './types';

const LINE_SOURCE_ID = 'transit-lines';
const STATION_SOURCE_ID = 'transit-stations';

type Props = {
  visible: boolean;
  onPress: OverlayPressHandler;
};

export function TransitOverlay({visible, onPress}: Props) {
  if (!visible) {
    return null;
  }

  return (
    <>
      <GeoJSONSource
        id={LINE_SOURCE_ID}
        data={TRANSIT_LINES}
        onPress={onPress}>
        <Layer
          id="transit-lines-casing"
          type="line"
          source={LINE_SOURCE_ID}
          beforeId={LABEL_ANCHOR_LAYER_ID}
          layout={{'line-cap': 'round', 'line-join': 'round'}}
          paint={{
            'line-color': '#ffffff',
            'line-width': [
              'interpolate',
              ['exponential', 1.5],
              ['zoom'],
              10,
              3,
              16,
              9,
            ],
          }}
        />
        {/* Each route paints itself from the CTA colour baked into the data. */}
        <Layer
          id="transit-lines-line"
          type="line"
          source={LINE_SOURCE_ID}
          beforeId={LABEL_ANCHOR_LAYER_ID}
          layout={{'line-cap': 'round', 'line-join': 'round'}}
          paint={{
            'line-color': ['get', 'color'],
            'line-width': [
              'interpolate',
              ['exponential', 1.5],
              ['zoom'],
              10,
              1.5,
              16,
              5,
            ],
          }}
        />
      </GeoJSONSource>

      <GeoJSONSource
        id={STATION_SOURCE_ID}
        data={TRANSIT_STATIONS}
        onPress={onPress}>
        <Layer
          id="transit-stations-circle"
          type="circle"
          source={STATION_SOURCE_ID}
          beforeId={LABEL_ANCHOR_LAYER_ID}
          minzoom={11}
          paint={{
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2.5, 16, 6],
            'circle-color': '#ffffff',
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#111827',
          }}
        />
        <Layer
          id="transit-stations-label"
          type="symbol"
          source={STATION_SOURCE_ID}
          beforeId={LABEL_ANCHOR_LAYER_ID}
          minzoom={14}
          layout={{
            'text-field': ['get', 'name'],
            'text-font': FONT_REGULAR,
            'text-size': 10,
            'text-offset': [0, 1.1],
            'text-anchor': 'top',
          }}
          paint={{
            'text-color': '#111827',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.4,
          }}
        />
      </GeoJSONSource>
    </>
  );
}
