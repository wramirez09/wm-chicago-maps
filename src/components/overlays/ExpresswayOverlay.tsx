import {GeoJSONSource, Layer} from '@maplibre/maplibre-react-native';
import React from 'react';

import {LAYER_ACCENT} from '../../config/layers';
import {FONT_BOLD, LABEL_ANCHOR_LAYER_ID} from '../../config/map';
import type {ExpresswayCollection} from '../../api/types';
import {EMPTY_COLLECTION} from '../../lib/geo';
import type {OverlayPressHandler} from './types';

const SOURCE_ID = 'expressways';

type Props = {
  visible: boolean;
  /** From useLayer('expressways'); undefined while loading. */
  data: ExpresswayCollection | undefined;
  onPress: OverlayPressHandler;
};

/**
 * While the layer is still loading, the source mounts with an empty collection
 * rather than rendering nothing. Each Layer is inserted just below
 * LABEL_ANCHOR_LAYER_ID at mount time, so mount order is draw order: if this
 * overlay only mounted once its data arrived, whichever layer the network
 * returned last would draw on top. Mounting empty keeps the declared order
 * (arterials < expressways < transit) no matter which request finishes first.
 */
export function ExpresswayOverlay({visible, data, onPress}: Props) {
  if (!visible) {
    return null;
  }

  return (
    <GeoJSONSource id={SOURCE_ID} data={data ?? EMPTY_COLLECTION} onPress={onPress}>
      {/* Dark casing under a bright core, so the route still reads where it
          runs over the basemap's own motorway ribbon. */}
      <Layer
        id="expressways-casing"
        type="line"
        source={SOURCE_ID}
        beforeId={LABEL_ANCHOR_LAYER_ID}
        layout={{'line-cap': 'round', 'line-join': 'round'}}
        paint={{
          'line-color': '#0b1e4d',
          'line-width': [
            'interpolate',
            ['exponential', 1.5],
            ['zoom'],
            9,
            4,
            14,
            11,
            18,
            26,
          ],
          'line-opacity': 0.9,
        }}
      />
      <Layer
        id="expressways-line"
        type="line"
        source={SOURCE_ID}
        beforeId={LABEL_ANCHOR_LAYER_ID}
        layout={{'line-cap': 'round', 'line-join': 'round'}}
        paint={{
          'line-color': [
            'match',
            ['get', 'kind'],
            'motorway',
            LAYER_ACCENT.expressways,
            '#60a5fa',
          ],
          'line-width': [
            'interpolate',
            ['exponential', 1.5],
            ['zoom'],
            9,
            2,
            14,
            7,
            18,
            18,
          ],
        }}
      />
      {/* Route number riding along the line — the local name (Kennedy, Dan
          Ryan, ...) is what the tap card shows. */}
      <Layer
        id="expressways-shield"
        type="symbol"
        source={SOURCE_ID}
        beforeId={LABEL_ANCHOR_LAYER_ID}
        minzoom={10}
        filter={['!=', ['get', 'ref'], '']}
        layout={{
          'text-field': ['get', 'ref'],
          'text-font': FONT_BOLD,
          'text-size': 11,
          'symbol-placement': 'line',
          'symbol-spacing': 220,
          'text-rotation-alignment': 'viewport',
          'text-pitch-alignment': 'viewport',
        }}
        paint={{
          'text-color': '#ffffff',
          'text-halo-color': '#0b1e4d',
          'text-halo-width': 1.8,
        }}
      />
    </GeoJSONSource>
  );
}
