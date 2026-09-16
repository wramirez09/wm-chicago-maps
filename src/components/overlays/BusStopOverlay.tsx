import {GeoJSONSource, Layer} from '@maplibre/maplibre-react-native';
import React, {useMemo} from 'react';

import {LAYER_ACCENT} from '../../config/layers';
import {LABEL_ANCHOR_LAYER_ID} from '../../config/map';
import type {BBox} from '../../lib/api/places/socrata';
import type {BusStop} from '../../lib/api/transit/busStops';
import {useBusStops} from '../../lib/api/transit/hooks';
import {EMPTY_COLLECTION, toPointCollection} from '../../lib/geo';
import type {OverlayPressHandler} from './types';

const SOURCE_ID = 'bus-stops';

/**
 * A stop as it travels through MapLibre. Feature properties must be flat JSON,
 * so `routes` crosses the native bridge as a joined string, not an array —
 * and the tap handler receives this shape, not `BusStop`.
 */
export type BusStopFeatureProperties = Omit<BusStop, 'routes'> & {routes: string};

/** ~11,000 stops citywide; below this zoom a bbox still holds thousands. */
export const BUS_STOP_MIN_ZOOM = 15;

type Props = {
  visible: boolean;
  bbox: BBox | null;
  zoom: number;
  onPress: OverlayPressHandler;
};

/** CTA bus stops for the viewport. Keyless; tapping one fetches predictions. */
export function BusStopOverlay({visible, bbox, zoom, onPress}: Props) {
  const {data} = useBusStops(bbox, {enabled: visible && zoom >= BUS_STOP_MIN_ZOOM});

  const collection = useMemo(
    () =>
      data
        ? toPointCollection<BusStopFeatureProperties>(
            data.map(stop => ({...stop, routes: stop.routes.join(', ')})),
            stop => [stop.longitude, stop.latitude],
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
        id="bus-stops-circle"
        type="circle"
        source={SOURCE_ID}
        beforeId={LABEL_ANCHOR_LAYER_ID}
        minzoom={BUS_STOP_MIN_ZOOM}
        paint={{
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 3.5, 18, 8],
          'circle-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-stroke-color': LAYER_ACCENT.busStops,
        }}
      />
    </GeoJSONSource>
  );
}
