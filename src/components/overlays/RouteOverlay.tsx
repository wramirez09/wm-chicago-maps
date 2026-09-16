import {GeoJSONSource, Layer} from '@maplibre/maplibre-react-native';
import React, {useMemo} from 'react';

import {LABEL_ANCHOR_LAYER_ID} from '../../config/map';
import type {RouteResult} from '../../lib/api/transit/valhalla';
import {decodePolyline} from '../../lib/geo';

const SOURCE_ID = 'route';

type Props = {
  route: RouteResult | null;
};

/** The walking route from the user to the selected feature, from Valhalla. */
export function RouteOverlay({route}: Props) {
  const collection = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: (route?.legs ?? []).map(leg => ({
        type: 'Feature',
        properties: {},
        geometry: {type: 'LineString', coordinates: decodePolyline(leg.shape, 6)},
      })),
    }),
    [route],
  );

  if (!route) {
    return null;
  }

  return (
    <GeoJSONSource id={SOURCE_ID} data={collection}>
      <Layer
        id="route-casing"
        type="line"
        source={SOURCE_ID}
        beforeId={LABEL_ANCHOR_LAYER_ID}
        layout={{'line-cap': 'round', 'line-join': 'round'}}
        paint={{'line-color': '#ffffff', 'line-width': 9}}
      />
      <Layer
        id="route-line"
        type="line"
        source={SOURCE_ID}
        beforeId={LABEL_ANCHOR_LAYER_ID}
        layout={{'line-cap': 'round', 'line-join': 'round'}}
        paint={{'line-color': '#2563eb', 'line-width': 5}}
      />
    </GeoJSONSource>
  );
}
