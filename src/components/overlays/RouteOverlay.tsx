import {GeoJSONSource, Layer} from '@maplibre/maplibre-react-native';
import React, {useMemo} from 'react';

import {LABEL_ANCHOR_LAYER_ID} from '../../config/map';
import type {RouteResult} from '../../api/types';

const SOURCE_ID = 'route';

type Props = {
  route: RouteResult | null;
};

/** The walking route from the user to the selected feature, from GET /v1/route. */
export function RouteOverlay({route}: Props) {
  // The API returns the route already decoded as a LineString.
  const collection = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: route ? [{type: 'Feature', properties: {}, geometry: route.geometry}] : [],
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
