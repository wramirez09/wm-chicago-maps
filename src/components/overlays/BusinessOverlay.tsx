import {GeoJSONSource, Layer} from '@maplibre/maplibre-react-native';
import React, {useMemo} from 'react';

import {FONT_REGULAR, LABEL_ANCHOR_LAYER_ID} from '../../config/map';
import {LAYER_ACCENT} from '../../config/layers';
import type {BusinessLicense} from '../../lib/api/places/businessLicenses';
import {useBusinessLicenses} from '../../lib/api/places/hooks';
import type {BBox} from '../../lib/api/places/socrata';
import {EMPTY_COLLECTION, toPointCollection} from '../../lib/geo';
import type {OverlayPressHandler} from './types';

const SOURCE_ID = 'businesses';

/**
 * Below this zoom the viewport covers most of the city and the query would
 * return an arbitrary 200 of tens of thousands of licences — a misleading
 * scatter rather than a useful answer.
 */
export const BUSINESS_MIN_ZOOM = 14;

type Props = {
  visible: boolean;
  /** The map's visible bounds, or null before the first region event. */
  bbox: BBox | null;
  zoom: number;
  onPress: OverlayPressHandler;
};

/**
 * Active business licences from the Chicago Data Portal, for the visible
 * viewport. Keyless — the Socrata app token is optional.
 */
export function BusinessOverlay({visible, bbox, zoom, onPress}: Props) {
  const enabled = visible && bbox !== null && zoom >= BUSINESS_MIN_ZOOM;

  const {data} = useBusinessLicenses(
    {bbox: bbox ?? undefined, limit: 200},
    {enabled},
  );

  const collection = useMemo(
    () =>
      data
        ? toPointCollection<BusinessLicense>(data, row => [
            row.longitude,
            row.latitude,
          ])
        : EMPTY_COLLECTION,
    [data],
  );

  if (!visible) {
    return null;
  }

  return (
    <GeoJSONSource id={SOURCE_ID} data={collection} onPress={onPress}>
      <Layer
        id="businesses-circle"
        type="circle"
        source={SOURCE_ID}
        beforeId={LABEL_ANCHOR_LAYER_ID}
        minzoom={BUSINESS_MIN_ZOOM}
        paint={{
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 3.5, 18, 9],
          'circle-color': LAYER_ACCENT.businesses,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        }}
      />
      <Layer
        id="businesses-label"
        type="symbol"
        source={SOURCE_ID}
        minzoom={16}
        layout={{
          'text-field': ['get', 'doing_business_as_name'],
          'text-font': FONT_REGULAR,
          'text-size': 10,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          'text-max-width': 9,
        }}
        paint={{
          'text-color': '#4c1d95',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.4,
        }}
      />
    </GeoJSONSource>
  );
}
