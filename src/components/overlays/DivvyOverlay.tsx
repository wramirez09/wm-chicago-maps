import {GeoJSONSource, Layer} from '@maplibre/maplibre-react-native';
import React, {useMemo} from 'react';

import {FONT_BOLD} from '../../config/map';
import {useDivvyStations} from '../../lib/api/transit/hooks';
import type {DivvyStation} from '../../lib/api/transit/divvyGbfs';
import {EMPTY_COLLECTION, toPointCollection} from '../../lib/geo';
import type {OverlayPressHandler} from './types';

const SOURCE_ID = 'divvy-stations';

type Props = {
  visible: boolean;
  onPress: OverlayPressHandler;
};

/**
 * Live Divvy dock availability, from GBFS. No API key.
 *
 * The query only runs while the layer is visible, so the map costs nothing
 * until the user asks for it. Refetch is on the 60s GBFS cadence, set in the
 * hook rather than here.
 */
export function DivvyOverlay({visible, onPress}: Props) {
  const {data} = useDivvyStations({enabled: visible});

  const collection = useMemo(
    () =>
      data
        ? toPointCollection<DivvyStation>(data, s => [s.lon, s.lat])
        : EMPTY_COLLECTION,
    [data],
  );

  if (!visible) {
    return null;
  }

  return (
    <GeoJSONSource id={SOURCE_ID} data={collection} onPress={onPress}>
      {/* Colour encodes availability, which is the whole point of the layer:
          red means you cannot get a bike here right now. */}
      <Layer
        id="divvy-circle"
        type="circle"
        source={SOURCE_ID}
        minzoom={12}
        paint={{
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 17, 13],
          'circle-color': [
            'case',
            ['==', ['get', 'isRenting'], false], '#9ca3af',
            ['==', ['get', 'bikesAvailable'], 0], '#dc2626',
            ['<', ['get', 'bikesAvailable'], 3], '#f59e0b',
            '#0b6bcb',
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
        }}
      />
      {/* The count itself, once the pins are big enough to hold a number. */}
      <Layer
        id="divvy-count"
        type="symbol"
        source={SOURCE_ID}
        minzoom={15}
        layout={{
          'text-field': ['to-string', ['get', 'bikesAvailable']],
          'text-font': FONT_BOLD,
          'text-size': 10,
          'text-allow-overlap': true,
        }}
        paint={{'text-color': '#ffffff'}}
      />
    </GeoJSONSource>
  );
}
