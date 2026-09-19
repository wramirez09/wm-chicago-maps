import {GeoJSONSource, Layer} from '@maplibre/maplibre-react-native';
import React from 'react';

import {FONT_REGULAR, LABEL_ANCHOR_LAYER_ID} from '../../config/map';
import type {MetraLineCollection, MetraStationCollection} from '../../api/types';
import {EMPTY_COLLECTION} from '../../lib/geo';
import type {OverlayPressHandler} from './types';

const LINE_SOURCE_ID = 'metra-lines';
const STATION_SOURCE_ID = 'metra-stations';

type Props = {
  visible: boolean;
  /** From useLayer('metra-lines'); undefined while loading. */
  lines: MetraLineCollection | undefined;
  /** From useLayer('metra-stations'); undefined while loading. */
  stations: MetraStationCollection | undefined;
  onPress: OverlayPressHandler;
};

/**
 * Metra commuter rail: lines and stations.
 *
 * Dashed, to read as a different system from the CTA's solid lines at a
 * glance. Metra stations are sparse — a few dozen in the city — so unlike bus
 * stops they can show from the same zoom as the line itself.
 */
export function MetraOverlay({visible, lines, stations, onPress}: Props) {
  if (!visible) {
    return null;
  }

  return (
    <>
      <GeoJSONSource
        id={LINE_SOURCE_ID}
        data={lines ?? EMPTY_COLLECTION}
        onPress={onPress}>
        <Layer
          id="metra-lines-casing"
          type="line"
          source={LINE_SOURCE_ID}
          beforeId={LABEL_ANCHOR_LAYER_ID}
          layout={{'line-cap': 'butt', 'line-join': 'round'}}
          paint={{
            'line-color': '#ffffff',
            'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, 2.5, 16, 7],
          }}
        />
        <Layer
          id="metra-lines-line"
          type="line"
          source={LINE_SOURCE_ID}
          beforeId={LABEL_ANCHOR_LAYER_ID}
          layout={{'line-cap': 'butt', 'line-join': 'round'}}
          paint={{
            'line-color': ['get', 'color'],
            'line-dasharray': [2, 1.5],
            'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, 1.2, 16, 4],
          }}
        />
      </GeoJSONSource>

      <GeoJSONSource
        id={STATION_SOURCE_ID}
        data={stations ?? EMPTY_COLLECTION}
        onPress={onPress}>
        {/* Square-ish pins, to tell a Metra stop from a CTA one without
            reading the label: CTA stations are circles. */}
        <Layer
          id="metra-stations-square"
          type="circle"
          source={STATION_SOURCE_ID}
          beforeId={LABEL_ANCHOR_LAYER_ID}
          minzoom={11}
          paint={{
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2.5, 16, 6],
            'circle-color': '#4c1d95',
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
          }}
        />
        <Layer
          id="metra-stations-label"
          type="symbol"
          source={STATION_SOURCE_ID}
          beforeId={LABEL_ANCHOR_LAYER_ID}
          minzoom={13}
          layout={{
            'text-field': ['get', 'name'],
            'text-font': FONT_REGULAR,
            'text-size': 10,
            'text-offset': [0, 1.1],
            'text-anchor': 'top',
          }}
          paint={{
            'text-color': '#4c1d95',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.4,
          }}
        />
      </GeoJSONSource>
    </>
  );
}
