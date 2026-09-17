import {GeoJSONSource, Layer} from '@maplibre/maplibre-react-native';
import React from 'react';

import {LAYER_ACCENT, type LayerKey} from '../../config/layers';
import {FONT_BOLD, LABEL_ANCHOR_LAYER_ID} from '../../config/map';
import {EMPTY_COLLECTION} from '../../lib/geo';
import type {OverlayPressHandler} from './types';

type Props = {
  layer: Extract<LayerKey, 'neighborhoods'>;
  visible: boolean;
  data: GeoJSON.FeatureCollection | undefined;
  /** Property holding the display name, which differs per dataset. */
  labelField: string;
  /** Labels below this zoom collide into noise; parks need more room. */
  labelMinZoom?: number;
  onPress: OverlayPressHandler;
};

/**
 * Polygon boundaries from the API — currently community areas (/v1/areas).
 * Kept generic over its data and label field so further boundary layers can
 * reuse it once the API serves them.
 *
 * The fill is nearly transparent on purpose: it exists to make the interior
 * tappable (a line layer is only tappable on its few-pixel stroke), not to tint
 * the map.
 */
export function BoundaryOverlay({
  layer,
  visible,
  data,
  labelField,
  labelMinZoom = 11,
  onPress,
}: Props) {
  if (!visible) {
    return null;
  }

  const sourceId = `boundary-${layer}`;
  const accent = LAYER_ACCENT[layer];

  return (
    <GeoJSONSource
      id={sourceId}
      data={(data ?? EMPTY_COLLECTION) as GeoJSON.FeatureCollection}
      onPress={onPress}>
      <Layer
        id={`${sourceId}-fill`}
        type="fill"
        source={sourceId}
        beforeId={LABEL_ANCHOR_LAYER_ID}
        paint={{
          'fill-color': accent,
          'fill-opacity': 0.06,
        }}
      />
      <Layer
        id={`${sourceId}-line`}
        type="line"
        source={sourceId}
        beforeId={LABEL_ANCHOR_LAYER_ID}
        paint={{
          'line-color': accent,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 15, 2.2],
          'line-opacity': 0.8,
        }}
      />
      <Layer
        id={`${sourceId}-label`}
        type="symbol"
        source={sourceId}
        minzoom={labelMinZoom}
        layout={{
          'text-field': ['get', labelField],
          'text-font': FONT_BOLD,
          'text-size': 11,
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.06,
          'text-max-width': 8,
        }}
        paint={{
          'text-color': accent,
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.6,
        }}
      />
    </GeoJSONSource>
  );
}
