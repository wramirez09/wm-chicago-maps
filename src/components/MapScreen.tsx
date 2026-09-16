import {
  Camera,
  type CameraRef,
  Map,
  type PressEventWithFeatures,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import React, {useCallback, useMemo, useRef, useState} from 'react';
import {type NativeSyntheticEvent, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {FeatureCard, type MapSelection} from './FeatureCard';
import {LayerToggle} from './LayerToggle';
import {SearchBar} from './SearchBar';
import {WeatherChip} from './WeatherChip';
import {ArterialOverlay} from './overlays/ArterialOverlay';
import {BUSINESS_MIN_ZOOM, BusinessOverlay} from './overlays/BusinessOverlay';
import {DivvyOverlay} from './overlays/DivvyOverlay';
import {ExpresswayOverlay} from './overlays/ExpresswayOverlay';
import {LandmarkOverlay} from './overlays/LandmarkOverlay';
import {TransitOverlay} from './overlays/TransitOverlay';
import {
  FOCUS_ZOOM,
  LAYER_ACCENT,
  type LayerKey,
  type LayerVisibility,
} from '../config/layers';
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
import type {BusinessLicense} from '../lib/api/places/businessLicenses';
import type {BBox} from '../lib/api/places/socrata';
import type {DivvyStation} from '../lib/api/transit/divvyGbfs';
import {roundCoordinate, snapBBox} from '../lib/geo';
import type {SearchResult} from '../search/searchIndex';

const INITIAL_VISIBILITY: LayerVisibility = {
  expressways: true,
  arterials: true,
  transit: true,
  landmarks: true,
  // Live layers start off: turning one on is what makes its first request,
  // so the map still opens instantly and works offline.
  divvy: false,
  businesses: false,
};

type PressEvent = NativeSyntheticEvent<PressEventWithFeatures>;

type Viewport = {bbox: BBox; zoom: number; center: [number, number]};

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraRef>(null);
  const [selected, setSelected] = useState<MapSelection | null>(null);
  const [visibility, setVisibility] =
    useState<LayerVisibility>(INITIAL_VISIBILITY);
  const [viewport, setViewport] = useState<Viewport | null>(null);

  // Fires once per gesture, at rest — not per frame — so no debounce needed.
  // The bbox is snapped so small pans reuse the cached business query.
  const handleRegionDidChange = useCallback(
    (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      const {bounds, zoom, center} = event.nativeEvent;
      setViewport({bbox: snapBBox(bounds), zoom, center});
    },
    [],
  );

  // Weather for the map centre, rounded to ~11 km. At city scale that is one
  // lookup for the whole session instead of one per pan.
  const weatherAt = useMemo(() => {
    const [lng, lat] = viewport?.center ?? CHICAGO_CENTER;
    return {latitude: roundCoordinate(lat), longitude: roundCoordinate(lng)};
  }, [viewport?.center]);

  const toggleLayer = useCallback((key: LayerKey) => {
    setVisibility(current => ({...current, [key]: !current[key]}));
    // The card may be describing a feature on the layer being hidden.
    setSelected(null);
  }, []);

  /**
   * Every overlay funnels its taps through here. `describe` turns that layer's
   * feature properties into card content; the camera move is shared.
   */
  const selectFeature = useCallback(
    <T,>(
      layer: LayerKey,
      describe: (properties: T) => Omit<MapSelection, 'accent'>,
    ) =>
      (event: PressEvent) => {
        const feature = event.nativeEvent.features[0];
        if (!feature) {
          return;
        }

        setSelected({
          ...describe(feature.properties as T),
          accent: LAYER_ACCENT[layer],
        });

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

  const handleSearchSelect = useCallback((result: SearchResult) => {
    // Searching for something on a hidden layer should show it, not fly to
    // blank map.
    setVisibility(current =>
      current[result.layer] ? current : {...current, [result.layer]: true},
    );

    setSelected({
      title: result.title,
      subtitle: result.subtitle,
      accent: result.accent,
    });

    cameraRef.current?.easeTo({
      center: result.center,
      zoom: result.zoom,
      duration: 600,
    });
  }, []);

  const handleMapPress = useCallback(() => setSelected(null), []);

  const businessesNeedZoom =
    visibility.businesses &&
    viewport !== null &&
    viewport.zoom < BUSINESS_MIN_ZOOM;

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={MAP_STYLE_URL}
        onPress={handleMapPress}
        onRegionDidChange={handleRegionDidChange}
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
          onPress={selectFeature<ArterialProperties>('arterials', p => ({
            title: p.name,
            subtitle: p.kind === 'primary' ? 'Major street' : 'Street',
          }))}
        />
        <ExpresswayOverlay
          visible={visibility.expressways}
          onPress={selectFeature<ExpresswayProperties>('expressways', p => ({
            title: p.localName || p.name || p.ref,
            subtitle: [p.ref, p.localName ? p.name : '']
              .filter(Boolean)
              .join(' · '),
          }))}
        />
        <TransitOverlay
          visible={visibility.transit}
          onPress={selectFeature<
            TransitLineProperties | TransitStationProperties
          >('transit', p =>
            'line' in p
              ? {title: `${p.line} Line`, subtitle: 'CTA rail'}
              : {
                  title: p.name,
                  subtitle: p.lines ? `CTA · ${p.lines}` : 'CTA station',
                },
          )}
        />
        <BusinessOverlay
          visible={visibility.businesses}
          bbox={viewport?.bbox ?? null}
          zoom={viewport?.zoom ?? CHICAGO_ZOOM}
          onPress={selectFeature<BusinessLicense>('businesses', p => ({
            title: p.doing_business_as_name || p.legal_name || 'Business',
            subtitle: p.business_activity || p.license_description || '',
            details: [
              p.address,
              p.community_area_name ? `Community area: ${p.community_area_name}` : undefined,
              p.expiration_date ? `Licence valid to ${p.expiration_date.slice(0, 10)}` : undefined,
            ].filter((line): line is string => Boolean(line)),
          }))}
        />
        <DivvyOverlay
          visible={visibility.divvy}
          onPress={selectFeature<DivvyStation>('divvy', p => ({
            title: p.name,
            subtitle: p.isRenting ? 'Divvy station · live' : 'Divvy station · not renting',
            details: [
              `${p.bikesAvailable} bikes available (${p.ebikesAvailable} e-bikes)`,
              `${p.docksAvailable} open docks`,
            ],
          }))}
        />
        <LandmarkOverlay
          visible={visibility.landmarks}
          onPress={selectFeature<LandmarkProperties>('landmarks', p => ({
            title: p.name,
            subtitle: p.neighborhood,
            neighborhood: p.neighborhood,
          }))}
        />
      </Map>

      {/* Search sits above the chips; both clear the compass on the right. */}
      <View
        style={[styles.topWrapper, {top: insets.top + 12}]}
        pointerEvents="box-none">
        <SearchBar onSelect={handleSearchSelect} />
        <LayerToggle visibility={visibility} onToggle={toggleLayer} />
        <WeatherChip coordinates={weatherAt} />
        {businessesNeedZoom ? (
          <View style={styles.hint}>
            <Text style={styles.hintText}>Zoom in to see businesses</Text>
          </View>
        ) : null}
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
  topWrapper: {
    position: 'absolute',
    left: 12,
    // Keep clear of the compass in the top-right corner.
    right: 60,
    gap: 8,
  },
  hint: {
    alignSelf: 'flex-start',
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  hintText: {fontSize: 12, color: '#ffffff', fontWeight: '500'},
  cardWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
  },
});
