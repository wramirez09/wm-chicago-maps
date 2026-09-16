import {
  Camera,
  type CameraRef,
  Map,
  type PressEventWithFeatures,
  UserLocation,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import React, {useCallback, useMemo, useRef, useState} from 'react';
import {type NativeSyntheticEvent, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {DirectionsAction} from './DirectionsAction';
import {FeatureCard, type MapSelection} from './FeatureCard';
import {LayerToggle} from './LayerToggle';
import {LocateButton} from './LocateButton';
import {SearchBar} from './SearchBar';
import {WeatherChip} from './WeatherChip';
import {ArterialOverlay} from './overlays/ArterialOverlay';
import {BoundaryOverlay} from './overlays/BoundaryOverlay';
import {BUSINESS_MIN_ZOOM, BusinessOverlay} from './overlays/BusinessOverlay';
import {
  BUS_STOP_MIN_ZOOM,
  BusStopOverlay,
  type BusStopFeatureProperties,
} from './overlays/BusStopOverlay';
import {DivvyOverlay} from './overlays/DivvyOverlay';
import {EventOverlay, type EventFeatureProperties} from './overlays/EventOverlay';
import {ExpresswayOverlay} from './overlays/ExpresswayOverlay';
import {LandmarkOverlay} from './overlays/LandmarkOverlay';
import {MetraOverlay} from './overlays/MetraOverlay';
import {RouteOverlay} from './overlays/RouteOverlay';
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
import {hasEnv} from '../lib/api/env';
import {useParkBoundaries, useWardBoundaries} from '../lib/api/neighborhoods/hooks';
import type {BusinessLicense} from '../lib/api/places/businessLicenses';
import {useCommunityAreas} from '../lib/api/places/hooks';
import type {GeocodeResult} from '../lib/api/places/photon';
import type {BBox} from '../lib/api/places/socrata';
import type {DivvyStation} from '../lib/api/transit/divvyGbfs';
import type {MetraVehiclePosition} from '../lib/api/transit/metra';
import {fetchRoute, type RouteResult} from '../lib/api/transit/valhalla';
import {
  type Coordinates,
  getCurrentPosition,
  requestLocationPermission,
} from '../lib/device/location';
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
  busStops: false,
  metra: false,
  events: false,
  neighborhoods: false,
  parks: false,
  wards: false,
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
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Boundary polygons are fetched only while their layer is on.
  const communityAreas = useCommunityAreas({enabled: visibility.neighborhoods});
  const parks = useParkBoundaries({enabled: visibility.parks});
  const wards = useWardBoundaries({enabled: visibility.wards});

  // Fires once per gesture, at rest — not per frame — so no debounce needed.
  // The bbox is snapped so small pans reuse cached viewport queries.
  const handleRegionDidChange = useCallback(
    (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      const {bounds, zoom, center} = event.nativeEvent;
      setViewport({bbox: snapBBox(bounds), zoom, center});
    },
    [],
  );

  // Rounded to ~11 km: at city scale, one weather/events lookup per session
  // instead of one per pan.
  const roundedCenter = useMemo(() => {
    const [lng, lat] = viewport?.center ?? CHICAGO_CENTER;
    return {latitude: roundCoordinate(lat), longitude: roundCoordinate(lng)};
  }, [viewport?.center]);

  const toggleLayer = useCallback((key: LayerKey) => {
    setVisibility(current => ({...current, [key]: !current[key]}));
    // The card may be describing a feature on the layer being hidden.
    setSelected(null);
    setRoute(null);
  }, []);

  const select = useCallback((selection: MapSelection | null) => {
    setSelected(selection);
    // A route belongs to the selection it was asked for.
    setRoute(null);
    setRouteError(null);
  }, []);

  /**
   * Every overlay funnels its taps through here. `describe` turns that layer's
   * feature properties into card content; the camera move is shared.
   */
  const selectFeature = useCallback(
    <T,>(
      layer: LayerKey,
      describe: (
        properties: T,
        center: [number, number] | null,
      ) => Omit<MapSelection, 'accent'>,
    ) =>
      (event: PressEvent) => {
        const feature = event.nativeEvent.features[0];
        if (!feature) {
          return;
        }

        const center = centerOf(feature.geometry);

        select({
          ...describe(feature.properties as T, center),
          accent: LAYER_ACCENT[layer],
          coordinates: center ?? undefined,
        });

        if (center) {
          cameraRef.current?.easeTo({
            center,
            zoom: FOCUS_ZOOM[layer],
            duration: 400,
          });
        }
      },
    [select],
  );

  const handleSearchSelect = useCallback(
    (result: SearchResult) => {
      // Searching for something on a hidden layer should show it, not fly to
      // blank map.
      setVisibility(current =>
        current[result.layer] ? current : {...current, [result.layer]: true},
      );

      select({
        title: result.title,
        subtitle: result.subtitle,
        accent: result.accent,
        coordinates: result.center,
      });

      cameraRef.current?.easeTo({
        center: result.center,
        zoom: result.zoom,
        duration: 600,
      });
    },
    [select],
  );

  const handleSelectAddress = useCallback(
    (result: GeocodeResult) => {
      const center: [number, number] = [result.longitude, result.latitude];
      select({
        title: result.properties.name ?? result.label.split(',')[0],
        subtitle: result.label,
        accent: '#6b7280',
        coordinates: center,
      });
      cameraRef.current?.easeTo({center, zoom: 17, duration: 600});
    },
    [select],
  );

  const handleLocated = useCallback((coordinates: Coordinates) => {
    setUserLocation(coordinates);
    cameraRef.current?.easeTo({
      center: [coordinates.longitude, coordinates.latitude],
      zoom: 15,
      duration: 600,
    });
  }, []);

  const requestDirections = useCallback(async () => {
    const destination = selected?.coordinates;
    if (!destination) {
      return;
    }

    setRouteLoading(true);
    setRouteError(null);

    try {
      let origin = userLocation;
      if (!origin) {
        const status = await requestLocationPermission();
        if (status !== 'granted') {
          setRouteError('Directions need your location.');
          return;
        }
        origin = await getCurrentPosition({timeoutMs: 12_000});
        setUserLocation(origin);
      }

      setRoute(
        await fetchRoute([origin.longitude, origin.latitude], destination, {
          mode: 'pedestrian',
        }),
      );
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : 'Could not get directions.');
    } finally {
      setRouteLoading(false);
    }
  }, [selected?.coordinates, userLocation]);

  const handleMapPress = useCallback(() => select(null), [select]);

  const zoom = viewport?.zoom ?? CHICAGO_ZOOM;
  const hints: string[] = [];
  if (visibility.businesses && zoom < BUSINESS_MIN_ZOOM) {
    hints.push('Zoom in to see businesses');
  }
  if (visibility.busStops && zoom < BUS_STOP_MIN_ZOOM) {
    hints.push('Zoom in to see bus stops');
  }
  if (visibility.metra && !hasEnv('METRA_KEY')) {
    hints.push('Metra needs METRA_KEY in .env, then a rebuild');
  }
  if (visibility.events && !hasEnv('TICKETMASTER_KEY') && !hasEnv('BANDSINTOWN_APP_ID')) {
    hints.push('Events need TICKETMASTER_KEY or BANDSINTOWN_APP_ID in .env, then a rebuild');
  }

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

        {/* Boundaries first, so every other layer draws on top of them. */}
        <BoundaryOverlay
          layer="wards"
          visible={visibility.wards}
          data={wards.data}
          labelField="ward"
          onPress={selectFeature<{ward?: string}>('wards', p => ({
            title: `Ward ${p.ward ?? ''}`.trim(),
            subtitle: 'City Council ward',
          }))}
        />
        <BoundaryOverlay
          layer="neighborhoods"
          visible={visibility.neighborhoods}
          data={communityAreas.data}
          labelField="community"
          onPress={selectFeature<{community?: string; area_numbe?: string}>(
            'neighborhoods',
            p => ({
              title: titleCase(p.community ?? 'Community area'),
              subtitle: p.area_numbe ? `Community area ${p.area_numbe}` : 'Community area',
            }),
          )}
        />
        <BoundaryOverlay
          layer="parks"
          visible={visibility.parks}
          data={parks.data}
          labelField="park"
          labelMinZoom={13}
          onPress={selectFeature<{park?: string; park_no?: string; acres?: string}>(
            'parks',
            p => ({
              title: titleCase(p.park ?? 'Park'),
              subtitle: p.acres ? `Park · ${Number(p.acres).toFixed(1)} acres` : 'Park',
              live: p.park_no ? {kind: 'park', parkNumber: p.park_no} : undefined,
            }),
          )}
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
          >('transit', (p, center) =>
            'line' in p
              ? {title: `${p.line} Line`, subtitle: 'CTA rail'}
              : {
                  title: p.name,
                  subtitle: p.lines ? `CTA · ${p.lines}` : 'CTA station',
                  live: center ? {kind: 'cta-station', coordinates: center} : undefined,
                },
          )}
        />
        <RouteOverlay route={route} />
        <BusStopOverlay
          visible={visibility.busStops}
          bbox={viewport?.bbox ?? null}
          zoom={zoom}
          onPress={selectFeature<BusStopFeatureProperties>('busStops', p => ({
            title: p.name,
            subtitle: [p.direction, p.routes ? `Routes ${p.routes}` : '']
              .filter(Boolean)
              .join(' · '),
            live: {kind: 'bus-stop', stopId: p.stopId},
          }))}
        />
        <BusinessOverlay
          visible={visibility.businesses}
          bbox={viewport?.bbox ?? null}
          zoom={zoom}
          onPress={selectFeature<BusinessLicense>('businesses', p => ({
            title: p.doing_business_as_name || p.legal_name || 'Business',
            subtitle: p.business_activity || p.license_description || '',
            details: [
              p.address,
              p.community_area_name
                ? `Community area: ${titleCase(p.community_area_name)}`
                : undefined,
              p.expiration_date
                ? `Licence valid to ${p.expiration_date.slice(0, 10)}`
                : undefined,
            ].filter((line): line is string => Boolean(line)),
            live: {kind: 'business', accountNumber: p.account_number, address: p.address},
          }))}
        />
        <DivvyOverlay
          visible={visibility.divvy}
          onPress={selectFeature<DivvyStation>('divvy', p => ({
            title: p.name,
            subtitle: p.isRenting
              ? 'Divvy station · live'
              : 'Divvy station · not renting',
            details: [
              `${p.bikesAvailable} bikes available (${p.ebikesAvailable} e-bikes)`,
              `${p.docksAvailable} open docks`,
            ],
          }))}
        />
        <MetraOverlay
          visible={visibility.metra}
          onPress={selectFeature<Omit<MetraVehiclePosition, 'reportedAt'>>('metra', p => ({
            title: p.routeId ? `Metra ${p.routeId}` : 'Metra train',
            subtitle: p.tripId ? `Trip ${p.tripId}` : 'Live position',
          }))}
        />
        <EventOverlay
          visible={visibility.events}
          center={roundedCenter}
          onPress={selectFeature<EventFeatureProperties>('events', p => ({
            title: p.title,
            subtitle: [p.venueName, p.category].filter(Boolean).join(' · '),
            details: [
              p.startsAt ? new Date(p.startsAt).toLocaleString() : undefined,
              p.address ?? undefined,
            ].filter((line): line is string => Boolean(line)),
          }))}
        />
        <LandmarkOverlay
          visible={visibility.landmarks}
          onPress={selectFeature<LandmarkProperties>('landmarks', p => ({
            title: p.name,
            subtitle: p.neighborhood,
          }))}
        />

        {userLocation ? <UserLocation animated accuracy /> : null}
      </Map>

      {/* Search sits above the chips; both clear the compass on the right. */}
      <View
        style={[styles.topWrapper, {top: insets.top + 12}]}
        pointerEvents="box-none">
        <SearchBar
          onSelect={handleSearchSelect}
          onSelectAddress={handleSelectAddress}
        />
        <LayerToggle visibility={visibility} onToggle={toggleLayer} />
        <WeatherChip coordinates={roundedCenter} />
        {hints.map(hint => (
          <View key={hint} style={styles.hint}>
            <Text style={styles.hintText}>{hint}</Text>
          </View>
        ))}
      </View>

      {/* Bottom-right, above the attribution button, and hidden behind the
          card while one is open so the two never overlap. */}
      {selected ? null : (
        <View
          style={[styles.locateWrapper, {bottom: insets.bottom + 56}]}
          pointerEvents="box-none">
          <LocateButton onLocated={handleLocated} />
        </View>
      )}

      {selected ? (
        <View
          style={[styles.cardWrapper, {paddingBottom: insets.bottom + 16}]}
          pointerEvents="box-none">
          <FeatureCard
            selection={selected}
            onDismiss={handleMapPress}
            footer={
              selected.coordinates ? (
                <DirectionsAction
                  route={route}
                  loading={routeLoading}
                  error={routeError}
                  onRequest={requestDirections}
                  onClear={() => setRoute(null)}
                />
              ) : null
            }
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * A point to ease to for the tapped feature. For a line we take the middle
 * vertex rather than a bounding-box centre — an expressway that bends (the
 * Kennedy, the Skyway) has a centroid that can fall well off the road.
 * Polygons return null: a boundary's centre is rarely where the user tapped,
 * so the camera stays put.
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

/** "ROGERS PARK" → "Rogers Park". The portal stores many names uppercased. */
function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
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
  locateWrapper: {position: 'absolute', right: 12},
  cardWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
  },
});
