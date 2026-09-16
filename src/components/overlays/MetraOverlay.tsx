import {GeoJSONSource, Layer} from '@maplibre/maplibre-react-native';
import React, {useMemo} from 'react';

import {LAYER_ACCENT} from '../../config/layers';
import {FONT_BOLD} from '../../config/map';
import {hasEnv} from '../../lib/api/env';
import {useMetraVehiclePositions} from '../../lib/api/transit/hooks';
import type {MetraVehiclePosition} from '../../lib/api/transit/metra';
import {EMPTY_COLLECTION, toPointCollection} from '../../lib/geo';
import type {OverlayPressHandler} from './types';

const SOURCE_ID = 'metra-vehicles';

type Props = {
  visible: boolean;
  onPress: OverlayPressHandler;
};

/**
 * Live Metra train positions from GTFS-Realtime. Needs METRA_KEY; without it
 * the query stays disabled and MapScreen shows a key hint instead of an empty
 * layer that looks broken.
 */
export function MetraOverlay({visible, onPress}: Props) {
  const {data} = useMetraVehiclePositions({enabled: visible && hasEnv('METRA_KEY')});

  const collection = useMemo(
    () =>
      data
        ? toPointCollection(
            // Dates do not survive the native bridge; send an ISO string.
            data.map(v => ({...v, reportedAt: v.reportedAt?.toISOString() ?? ''})),
            (v: Omit<MetraVehiclePosition, 'reportedAt'>) => [v.longitude, v.latitude],
          )
        : EMPTY_COLLECTION,
    [data],
  );

  if (!visible) {
    return null;
  }

  return (
    <GeoJSONSource id={SOURCE_ID} data={collection} onPress={onPress}>
      <Layer
        id="metra-vehicle"
        type="circle"
        source={SOURCE_ID}
        paint={{
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 5, 15, 10],
          'circle-color': LAYER_ACCENT.metra,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        }}
      />
      <Layer
        id="metra-route"
        type="symbol"
        source={SOURCE_ID}
        minzoom={11}
        layout={{
          'text-field': ['coalesce', ['get', 'routeId'], ''],
          'text-font': FONT_BOLD,
          'text-size': 10,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
        }}
        paint={{
          'text-color': LAYER_ACCENT.metra,
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.4,
        }}
      />
    </GeoJSONSource>
  );
}
