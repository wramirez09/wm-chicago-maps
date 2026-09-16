import {
  Camera,
  type CameraRef,
  Map,
  type PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import React, {useCallback, useRef, useState} from 'react';
import {type NativeSyntheticEvent, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {FeatureCard, type MapSelection} from './FeatureCard';
import {LayerToggle} from './LayerToggle';
import {ArterialOverlay, ARTERIAL_ACCENT} from './overlays/ArterialOverlay';
import {
  ExpresswayOverlay,
  EXPRESSWAY_ACCENT,
} from './overlays/ExpresswayOverlay';
import {LandmarkOverlay, LANDMARK_ACCENT} from './overlays/LandmarkOverlay';
import {TransitOverlay, TRANSIT_ACCENT} from './overlays/TransitOverlay';
import type {LayerKey, LayerVisibility} from './overlays/types';
import {
  CHICAGO_BOUNDS,
  CHICAGO_CENTER,
  CHICAGO_ZOOM,
  MAP_STYLE_URL,
  MAX_ZOOM,
  MIN_ZOOM,
} from '../config/map';
import type {ArterialProperties} from '../data/arterials';
import type {ExpresswayProperties} from '../data/expressways';
import type {LandmarkProperties} from '../data/landmarks';
import type {
  TransitLineProperties,
  TransitStationProperties,
} from '../data/transit';

const INITIAL_VISIBILITY: LayerVisibility = {
  expressways: true,
  arterials: true,
  transit: true,
  landmarks: true,
};

/** Zoom the camera eases to when a feature is tapped, per layer. */
const FOCUS_ZOOM: Record<LayerKey, number> = {
  expressways: 12,
  arterials: 14,
  transit: 13,
  landmarks: 14,
};

type PressEvent = NativeSyntheticEvent<PressEventWithFeatures>;

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraRef>(null);
  const [selected, setSelected] = useState<MapSelection | null>(null);
  const [visibility, setVisibility] =
    useState<LayerVisibility>(INITIAL_VISIBILITY);

  const toggleLayer = useCallback((key: LayerKey) => {
    setVisibility(current => ({...current, [key]: !current[key]}));
    // The card may be describing a feature on the layer being hidden.
    setSelected(null);
  }, []);

  /**
   * Every overlay funnels its taps through here. `describe` turns that layer's
   * feature properties into card text; the camera move is shared.
   */
  const selectFeature = useCallback(
    <T,>(
      layer: LayerKey,
      describe: (properties: T) => Omit<MapSelection, 'accent'>,
      accent: string,
    ) =>
      (event: PressEvent) => {
        const feature = event.nativeEvent.features[0];
        if (!feature) {
          return;
        }

        setSelected({...describe(feature.properties as T), accent});

        const center = centerOf(feature.geometry);
        if (center) {
          cameraRef.current?.easeTo({
            center,
            zoom: FOCUS_ZOOM[layer],
            duration: 400,
          });
        }
      },
    [],
  );

  const handleMapPress = useCallback(() => setSelected(null), []);

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={MAP_STYLE_URL}
        onPress={handleMapPress}
        compass
        compassPosition={{top: insets.top + 12, right: 12}}
        attributionPosition={{bottom: insets.bottom + 12, right: 12}}>
        <Camera
          ref={cameraRef}
          initialViewState={{center: CHICAGO_CENTER, zoom: CHICAGO_ZOOM}}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          maxBounds={CHICAGO_BOUNDS}
        />

        {/* Declaration order is draw order within each `beforeId` group:
            arterials sit under expressways, which sit under transit. */}
        <ArterialOverlay
          visible={visibility.arterials}
          onPress={selectFeature<ArterialProperties>(
            'arterials',
            p => ({title: p.name, subtitle: labelForArterial(p.kind)}),
            ARTERIAL_ACCENT,
          )}
        />
        <ExpresswayOverlay
          visible={visibility.expressways}
          onPress={selectFeature<ExpresswayProperties>(
            'expressways',
            p => ({
              title: p.localName || p.name || p.ref,
              subtitle: [p.ref, p.localName ? p.name : '']
                .filter(Boolean)
                .join(' · '),
            }),
            EXPRESSWAY_ACCENT,
          )}
        />
        <TransitOverlay
          visible={visibility.transit}
          onPress={selectFeature<
            TransitLineProperties | TransitStationProperties
          >(
            'transit',
            p =>
              'line' in p
                ? {title: `${p.line} Line`, subtitle: 'CTA rail'}
                : {
                    title: p.name,
                    subtitle: p.lines ? `CTA · ${p.lines}` : 'CTA station',
                  },
            TRANSIT_ACCENT,
          )}
        />
        <LandmarkOverlay
          visible={visibility.landmarks}
          onPress={selectFeature<LandmarkProperties>(
            'landmarks',
            p => ({title: p.name, subtitle: p.neighborhood}),
            LANDMARK_ACCENT,
          )}
        />
      </Map>

      <View
        style={[styles.toggleWrapper, {top: insets.top + 12}]}
        pointerEvents="box-none">
        <LayerToggle visibility={visibility} onToggle={toggleLayer} />
      </View>

      {selected ? (
        <View
          style={[styles.cardWrapper, {paddingBottom: insets.bottom + 16}]}
          pointerEvents="box-none">
          <FeatureCard selection={selected} onDismiss={handleMapPress} />
        </View>
      ) : null}
    </View>
  );
}

function labelForArterial(kind: ArterialProperties['kind']): string {
  return kind === 'primary' ? 'Major street' : 'Secondary street';
}

/**
 * A point to ease to for the tapped feature. For a line we take the middle
 * vertex rather than a bounding-box centre — an expressway that bends (the
 * Kennedy, the Skyway) has a centroid that can fall well off the road.
 */
function centerOf(geometry: GeoJSON.Geometry): [number, number] | null {
  if (geometry.type === 'Point') {
    const [lng, lat] = geometry.coordinates;
    return [lng, lat];
  }

  if (geometry.type === 'LineString' && geometry.coordinates.length > 0) {
    const [lng, lat] =
      geometry.coordinates[Math.floor(geometry.coordinates.length / 2)];
    return [lng, lat];
  }

  return null;
}

const styles = StyleSheet.create({
  container: {flex: 1},
  map: {flex: 1},
  toggleWrapper: {
    position: 'absolute',
    left: 12,
    // Keep clear of the compass in the top-right corner.
    right: 60,
  },
  cardWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
  },
});
