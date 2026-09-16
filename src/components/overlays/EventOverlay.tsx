import {GeoJSONSource, Layer} from '@maplibre/maplibre-react-native';
import React, {useMemo} from 'react';

import {LAYER_ACCENT} from '../../config/layers';
import {FONT_REGULAR} from '../../config/map';
import {hasEnv} from '../../lib/api/env';
import {useBandsintownEvents, useTicketmasterEvents} from '../../lib/api/events/hooks';
import type {LocalEvent} from '../../lib/api/events/ticketmaster';
import {EMPTY_COLLECTION, toPointCollection} from '../../lib/geo';
import type {OverlayPressHandler} from './types';

const SOURCE_ID = 'events';

/** The shape an event takes on the map: flat, with dates as ISO strings. */
export type EventFeatureProperties = Omit<LocalEvent, 'startsAt'> & {startsAt: string};

type Props = {
  visible: boolean;
  center: {latitude: number; longitude: number};
  onPress: OverlayPressHandler;
};

/**
 * Events with a venue location — Ticketmaster and Bandsintown, merged.
 *
 * Both need a key. Each source is enabled independently, so configuring only
 * one of them still produces a working layer. Chicago Park District events
 * have no coordinates (a permit names a park number, not a point), so they
 * appear in the park detail card instead of here.
 */
export function EventOverlay({visible, center, onPress}: Props) {
  const ticketmaster = useTicketmasterEvents(
    {latitude: center.latitude, longitude: center.longitude, radius: 15},
    {enabled: visible && hasEnv('TICKETMASTER_KEY')},
  );
  const bandsintown = useBandsintownEvents(
    {location: 'Chicago,IL'},
    {enabled: visible && hasEnv('BANDSINTOWN_APP_ID')},
  );

  const collection = useMemo(() => {
    const events = [...(ticketmaster.data ?? []), ...(bandsintown.data ?? [])];
    if (events.length === 0) {
      return EMPTY_COLLECTION;
    }
    return toPointCollection<EventFeatureProperties>(
      events.map(e => ({...e, startsAt: e.startsAt?.toISOString() ?? ''})),
      e => (e.longitude !== null && e.latitude !== null ? [e.longitude, e.latitude] : null),
    );
  }, [ticketmaster.data, bandsintown.data]);

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
