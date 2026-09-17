import {GeoJSONSource, Layer} from '@maplibre/maplibre-react-native';
import React from 'react';

import {LAYER_ACCENT} from '../../config/layers';
import {FONT_REGULAR} from '../../config/map';
import {useEvents, type Bbox} from '../../api/hooks';
import type {EventSummary} from '../../api/types';
import {EMPTY_COLLECTION} from '../../lib/geo';
import type {OverlayPressHandler} from './types';

const SOURCE_ID = 'events';

/** An event as it arrives on a tapped feature. */
export type EventFeatureProperties = EventSummary;

type Props = {
  visible: boolean;
  /** The viewport, debounced; events are fetched for this box. */
  bbox: Bbox | null;
  onPress: OverlayPressHandler;
};

/**
 * Events with a location, from GET /v1/events. The backend merges every
 * source, so there are no per-vendor keys or requests in the app. The API
 * already returns GeoJSON, so no conversion is needed.
 */
export function EventOverlay({visible, bbox, onPress}: Props) {
  const {data} = useEvents(bbox, {enabled: visible});
  const collection = data ?? EMPTY_COLLECTION;

  if (!visible) {
    return null;
  }

  return (
    <GeoJSONSource id={SOURCE_ID} data={collection} onPress={onPress}>
      <Layer
        id="events-circle"
        type="circle"
        source={SOURCE_ID}
        paint={{
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 9],
          'circle-color': LAYER_ACCENT.events,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        }}
      />
      <Layer
        id="events-label"
        type="symbol"
        source={SOURCE_ID}
        minzoom={14}
        layout={{
          'text-field': ['get', 'title'],
          'text-font': FONT_REGULAR,
          'text-size': 10,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-max-width': 10,
        }}
        paint={{
          'text-color': '#831843',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.4,
        }}
      />
    </GeoJSONSource>
  );
}
