import {GeoJSONSource, Layer} from '@maplibre/maplibre-react-native';
import React from 'react';

import {FONT_BOLD, FONT_REGULAR, LABEL_ANCHOR_LAYER_ID} from '../../config/map';
import type {BusRouteCollection, BusStopCollection} from '../../api/types';
import {EMPTY_COLLECTION} from '../../lib/geo';
import type {OverlayPressHandler} from './types';

const ROUTE_SOURCE_ID = 'bus-routes';
const STOP_SOURCE_ID = 'bus-stops';

type Props = {
  visible: boolean;
  /** From useLayer('bus-routes'); undefined while loading. */
  routes: BusRouteCollection | undefined;
  /** From useLayer('bus-stops'); undefined while loading. */
  stops: BusStopCollection | undefined;
  onPress: OverlayPressHandler;
};

/**
 * CTA bus routes and stops.
 *
 * Both are far denser than the rail layers — every route in the city, and a
 * stop every couple of blocks — so they hold back until zoomed in: routes from
 * 12, stops from 15, and stop names from 16. Drawn under the rail lines, since
 * rail is the layer people navigate by.
 */
export function BusOverlay({visible, routes, stops, onPress}: Props) {
  if (!visible) {
    return null;
  }

  return (
    <>
      <GeoJSONSource
        id={ROUTE_SOURCE_ID}
        data={routes ?? EMPTY_COLLECTION}
        onPress={onPress}>
        <Layer
          id="bus-routes-line"
          type="line"
          source={ROUTE_SOURCE_ID}
          beforeId={LABEL_ANCHOR_LAYER_ID}
          minzoom={12}
          layout={{'line-cap': 'round', 'line-join': 'round'}}
          paint={{
            'line-color': ['get', 'color'],
            // Thin and semi-transparent: with every route drawn, opaque lines
            // at rail weight turn the street grid into a solid wash.
            'line-opacity': 0.55,
            'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 0.8, 17, 3],
          }}
        />
      </GeoJSONSource>

      <GeoJSONSource
        id={STOP_SOURCE_ID}
        data={stops ?? EMPTY_COLLECTION}
        onPress={onPress}>
        <Layer
          id="bus-stops-circle"
          type="circle"
          source={STOP_SOURCE_ID}
          beforeId={LABEL_ANCHOR_LAYER_ID}
          minzoom={15}
          paint={{
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 2, 18, 5],
            'circle-color': '#0b7285',
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff',
          }}
        />
        {/* The route numbers, which are what identifies a stop on the street. */}
        <Layer
          id="bus-stops-label"
          type="symbol"
          source={STOP_SOURCE_ID}
          beforeId={LABEL_ANCHOR_LAYER_ID}
          minzoom={16}
          layout={{
            'text-field': ['get', 'routes'],
            'text-font': FONT_BOLD,
            'text-size': 9,
            'text-offset': [0, 0.9],
            'text-anchor': 'top',
          }}
          paint={{
            'text-color': '#0b7285',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.2,
          }}
        />
        <Layer
          id="bus-stops-name"
          type="symbol"
          source={STOP_SOURCE_ID}
          beforeId={LABEL_ANCHOR_LAYER_ID}
          minzoom={17}
          layout={{
            'text-field': ['get', 'name'],
            'text-font': FONT_REGULAR,
            'text-size': 9,
            'text-offset': [0, 1.9],
            'text-anchor': 'top',
          }}
          paint={{
            'text-color': '#374151',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.2,
          }}
        />
      </GeoJSONSource>
    </>
  );
}
