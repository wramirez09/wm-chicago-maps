import {
  Camera,
  type CameraRef,
  Map,
  type PressEventWithFeatures,
  type TrackUserLocationChangeEvent,
  UserLocation,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Independence, PlaceSummary} from '@wm/shared';

import {DirectionsAction} from './DirectionsAction';
import {FeatureCard, type MapSelection} from './FeatureCard';
import {LayerAttribution} from './LayerAttribution';
import {LayerToggle} from './LayerToggle';
import {LocateButton} from './LocateButton';
import {SEARCH_FIELD_HEIGHT, SearchBar} from './SearchBar';
import {ArterialOverlay} from './overlays/ArterialOverlay';
import {BoundaryOverlay} from './overlays/BoundaryOverlay';
import {BusOverlay} from './overlays/BusOverlay';
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
import type {GeocodeResult} from '../api/geocode';
import {type Bbox, useAreas, useLayer, usePlaces} from '../api/hooks';
import {fetchWalkingRoute} from '../api/route';
import type {
  AreaSummary,
  ArterialProperties,
  BusRouteProperties,
  BusStopProperties,
  DivvyStation,
  ExpresswayProperties,
  MetraLineProperties,
  MetraStationProperties,
  RouteResult,
  TransitLineProperties,
  TransitStationProperties,
} from '../api/types';
import {
  type Coordinates,
  getCurrentPosition,
  requestLocationPermission,
} from '../lib/device/location';
import {
  bboxMovedSignificantly,
  isInsideBounds,
  roundBbox,
} from '../lib/geo';
import {
  isPanGesture,
  type RecenterMode,
  reconcileTrackingChange,
  recenterZoom,
  toTrackUserLocation,
  type TouchPoint,
} from '../lib/recenter';
import type {SearchResult} from '../search/searchIndex';

/**
 * Inset from the screen's left and right edges, shared by every overlay control
 * so the search bar, chips, compass and buttons all line up on both sides.
 */
const EDGE = 12;

/** Vertical gap between stacked top controls; matches topWrapper's `gap`. */
const STACK_GAP = 8;

const INITIAL_VISIBILITY: LayerVisibility = {
  expressways: true,
  arterials: true,
  transit: true,
  landmarks: true,
  // Live layers start off: turning one on is what makes its first request,
  // so the map still opens instantly and works offline. Buses and Metra are
  // fetched the same way, for size rather than freshness.
  bus: false,
  metra: false,
  divvy: false,
  events: false,
  neighborhoods: false,
};

type PressEvent = NativeSyntheticEvent<PressEventWithFeatures>;

/** Places refetch this long after the camera settles, not on every event. */
const PLACES_DEBOUNCE_MS = 300;

/**
 * Card wording for each independence state. `excluded` (landmarks, parks, and
 * anything outside the independence question) shows nothing: "Excluded" on
 * Cloud Gate would read as an error.
 */
const INDEPENDENCE_LABEL: Record<Independence, string | null> = {
  verified: 'Verified independent',
  vouched: 'Vouched independent',
  unverified: 'Independence unverified',
  chain: 'Chain',
  excluded: null,
};

type Viewport = {zoom: number; center: [number, number]};

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraRef>(null);
  const [selected, setSelected] = useState<MapSelection | null>(null);
  const [visibility, setVisibility] =
    useState<LayerVisibility>(INITIAL_VISIBILITY);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [recenterMode, setRecenterMode] = useState<RecenterMode>('off');
  const [outsideChicago, setOutsideChicago] = useState(false);
  // Measured rather than assumed, so the compass stays clear of the chips at
  // any system text size.
  const [chipRowHeight, setChipRowHeight] = useState(0);
  const outsideChicagoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Follow starts once the ease to the user lands; see handleLocated.
  const followTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Where the current one-finger touch on the map began; null once handled.
  const touchStart = useRef<TouchPoint | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Overlay collections from the API. Each is persisted to disk and revalidated
  // with its ETag, so after the first launch they render from cache at once —
  // including when the API is unreachable. A failed refetch keeps `data`.
  const expressways = useLayer('expressways');
  const arterials = useLayer('arterials');
  const transitLines = useLayer('transit-lines');
  const transitStations = useLayer('transit-stations');
  // Buses and Metra are fetched only while their layer is on: together they
  // are bigger than everything else on the map put together.
  const busRoutes = useLayer('bus-routes', {enabled: visibility.bus});
  const busStops = useLayer('bus-stops', {enabled: visibility.bus});
  const metraLines = useLayer('metra-lines', {enabled: visibility.metra});
  const metraStations = useLayer('metra-stations', {enabled: visibility.metra});

  // The bbox that places are fetched for. Starts as the whole city so
  // landmarks draw before the first camera event; after that it follows the
  // viewport, debounced, and only when the view moved by more than ~10%.
  const [placesBbox, setPlacesBbox] = useState<Bbox>(CHICAGO_BOUNDS);
  const placesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (placesTimer.current) {
        clearTimeout(placesTimer.current);
      }
    },
    [],
  );
  const landmarks = usePlaces(placesBbox, 'landmark');
  // Places are keyed by viewport, so a pan starts a *new* query. React Query
  // keeps data on a failed refetch of the same key, but a new key that fails
  // (offline, API down) has no data at all, and the landmarks would vanish
  // on the first significant pan. Keep drawing the last successful collection
  // instead.
  const lastLandmarks = useRef(landmarks.data);
  if (landmarks.data) {
    lastLandmarks.current = landmarks.data;
  }
  const landmarkData = landmarks.data ?? lastLandmarks.current;

  // Boundary polygons are fetched only while their layer is on.
  const communityAreas = useAreas({enabled: visibility.neighborhoods});

  // Fires once per gesture, at rest — not per frame — so no debounce needed.
  // The bbox is snapped so small pans reuse cached viewport queries.
  const cancelPendingFollow = useCallback(() => {
    if (followTimer.current) {
      clearTimeout(followTimer.current);
      followTimer.current = null;
    }
  }, []);

  useEffect(() => cancelPendingFollow, [cancelPendingFollow]);

  /** Shows the "outside Chicago" hint for a few seconds. */
  const showOutsideChicago = useCallback(() => {
    if (outsideChicagoTimer.current) {
      clearTimeout(outsideChicagoTimer.current);
    }
    setOutsideChicago(true);
    outsideChicagoTimer.current = setTimeout(() => setOutsideChicago(false), 5000);
  }, []);

  useEffect(
    () => () => {
      if (outsideChicagoTimer.current) {
        clearTimeout(outsideChicagoTimer.current);
      }
    },
    [],
  );

  /**
   * Any camera move we start ourselves (a tapped feature, a search result) has
   * to stop following first, or the native camera snaps straight back to the
   * user on the next location update.
   */
  const stopFollowing = useCallback(() => {
    cancelPendingFollow();
    setRecenterMode('off');
  }, [cancelPendingFollow]);

  /**
   * A drag on the map stops following, as in Google Maps.
   *
   * Detected from raw touches rather than map events: onRegionWillChange's
   * `userInteraction` is also true on Android for the tracking camera's own
   * moves, so it cannot tell a drag from following. And the native camera's
   * own "tracking dismissed" event is not reliable enough to be the only way
   * out — when it was, the map snapped back to the user on every GPS fix and
   * could not be panned.
   */
  const handleMapTouchStart = useCallback((event: GestureResponderEvent) => {
    const {pageX, pageY, touches} = event.nativeEvent;
    touchStart.current = touches.length === 1 ? {x: pageX, y: pageY} : null;
  }, []);

  const handleMapTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      const start = touchStart.current;
      if (!start) {
        return;
      }
      const {pageX, pageY, touches} = event.nativeEvent;
      if (touches.length !== 1) {
        // Became a pinch: not a pan, so stop watching this touch.
        touchStart.current = null;
        return;
      }
      if (isPanGesture(start, {x: pageX, y: pageY}, touches.length)) {
        touchStart.current = null;
        stopFollowing();
      }
    },
    [stopFollowing],
  );

  // Native may only step tracking down (e.g. rotating out of compass mode);
  // see reconcileTrackingChange for why it never turns tracking back on.
  const handleTrackUserLocationChange = useCallback(
    (event: NativeSyntheticEvent<TrackUserLocationChangeEvent>) => {
      const reported = event.nativeEvent.trackUserLocation;
      setRecenterMode(current => reconcileTrackingChange(current, reported));
    },
    [],
  );

  const handleRegionDidChange = useCallback(
    (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      const {bounds, zoom, center} = event.nativeEvent;
      setViewport({zoom, center});

      if (placesTimer.current) {
        clearTimeout(placesTimer.current);
      }
      placesTimer.current = setTimeout(() => {
        placesTimer.current = null;
        setPlacesBbox(current =>
          bboxMovedSignificantly(current, bounds) ? roundBbox(bounds) : current,
        );
      }, PLACES_DEBOUNCE_MS);
    },
    [],
  );


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

        stopFollowing();
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
    [select, stopFollowing],
  );

  const handleSearchSelect = useCallback(
    (result: SearchResult) => {
      // Searching for something on a hidden layer should show it, not fly to
      // blank map.
      setVisibility(current =>
        current[result.layer] ? current : {...current, [result.layer]: true},
      );

      stopFollowing();
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
    [select, stopFollowing],
  );

  const handleSelectAddress = useCallback(
    (result: GeocodeResult) => {
      stopFollowing();
      select({
        title: result.title,
        subtitle: result.subtitle,
        accent: '#6b7280',
        coordinates: result.center,
      });
      cameraRef.current?.easeTo({center: result.center, zoom: 17, duration: 600});
    },
    [select, stopFollowing],
  );

  /**
   * Off → follow. Ease in first, then hand the camera to native tracking.
   * Tracking keeps whatever zoom the map has and jumps rather than animates,
   * so enabling it straight away would cancel the ease and leave the user
   * zoomed out at city scale. A drag during the ease cancels the handover.
   */
  const handleLocated = useCallback(
    (coordinates: Coordinates) => {
      const duration = 600;
      setUserLocation(coordinates);
      cancelPendingFollow();

      // Native tracking ignores the Camera's maxBounds, so following a user
      // outside the city drags the Chicago map to wherever they are — on the
      // simulator's default location, downtown San Francisco. Stay on the
      // city and say why instead.
      if (!isInsideBounds([coordinates.longitude, coordinates.latitude], CHICAGO_BOUNDS)) {
        setRecenterMode('off');
        showOutsideChicago();
        return;
      }

      cameraRef.current?.easeTo({
        center: [coordinates.longitude, coordinates.latitude],
        zoom: recenterZoom(viewport?.zoom ?? CHICAGO_ZOOM),
        bearing: 0,
        duration,
      });
      followTimer.current = setTimeout(() => {
        followTimer.current = null;
        setRecenterMode('follow');
      }, duration + 50);
    },
    [cancelPendingFollow, showOutsideChicago, viewport?.zoom],
  );

  const handleRecenterModeChange = useCallback((mode: RecenterMode) => {
    setRecenterMode(mode);
    if (mode === 'follow') {
      // Leaving compass mode: back to north up, as Google Maps does.
      cameraRef.current?.setStop({bearing: 0, duration: 300});
    }
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

      // Routes start from the user. Outside Chicago that is a request the
      // routing server rejects (walking routes are distance-capped), and not a
      // route this app has any business drawing.
      if (!isInsideBounds([origin.longitude, origin.latitude], CHICAGO_BOUNDS)) {
        setRouteError(
          "Walking directions start from your location, and you're outside Chicago.",
        );
        return;
      }

      setRoute(
        await fetchWalkingRoute([origin.longitude, origin.latitude], destination),
      );
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : 'Could not get directions.');
    } finally {
      setRouteLoading(false);
    }
  }, [selected?.coordinates, userLocation]);

  const handleMapPress = useCallback(() => select(null), [select]);

  const handleChipRowLayout = useCallback((event: LayoutChangeEvent) => {
    setChipRowHeight(event.nativeEvent.layout.height);
  }, []);

  const hints: string[] = [];
  if (outsideChicago) {
    hints.push("You're outside Chicago, so the map stays on the city");
  }

  return (
    <View style={styles.container}>
      {/* Observes touches without claiming them, so the map still gets every
          gesture; see handleMapTouchStart. */}
      <View
        style={styles.map}
        onTouchStart={handleMapTouchStart}
        onTouchMove={handleMapTouchMove}>
        <Map
          style={styles.map}
          mapStyle={MAP_STYLE_URL}
          onPress={handleMapPress}
          onRegionDidChange={handleRegionDidChange}
          compass
          // The search bar spans the full width, so the compass sits just below
          // the search field and chip row instead of underneath them.
          compassPosition={{
            top:
              insets.top +
              EDGE +
              SEARCH_FIELD_HEIGHT +
              STACK_GAP +
              chipRowHeight +
              STACK_GAP,
            right: EDGE,
          }}
          attributionPosition={{bottom: insets.bottom + EDGE, right: EDGE}}>
          <Camera
            ref={cameraRef}
            initialViewState={{center: CHICAGO_CENTER, zoom: CHICAGO_ZOOM}}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            maxBounds={CHICAGO_BOUNDS}
            trackUserLocation={toTrackUserLocation(recenterMode)}
            onTrackUserLocationChange={handleTrackUserLocationChange}
          />

          {/* Boundaries first, so every other layer draws on top of them. */}
          <BoundaryOverlay
            layer="neighborhoods"
            visible={visibility.neighborhoods}
            data={communityAreas.data}
            labelField="name"
            onPress={selectFeature<AreaSummary>('neighborhoods', p => ({
              title: p.name,
              subtitle: `Community area ${p.number}`,
            }))}
          />

          {/* Declaration order is draw order within each `beforeId` group:
              arterials sit under expressways, which sit under transit. */}
          <ArterialOverlay
            visible={visibility.arterials}
            data={arterials.data}
            onPress={selectFeature<ArterialProperties>('arterials', p => ({
              title: p.name,
              subtitle: p.kind === 'primary' ? 'Major street' : 'Street',
            }))}
          />
          <ExpresswayOverlay
            visible={visibility.expressways}
            data={expressways.data}
            onPress={selectFeature<ExpresswayProperties>('expressways', p => ({
              title: p.localName || p.name || p.ref,
              subtitle: [p.ref, p.localName ? p.name : '']
                .filter(Boolean)
                .join(' · '),
            }))}
          />
          <TransitOverlay
            visible={visibility.transit}
            lines={transitLines.data}
            stations={transitStations.data}
            onPress={selectFeature<TransitLineProperties | TransitStationProperties>(
              'transit',
              p =>
                'line' in p
                  ? {title: `${p.line} Line`, subtitle: 'CTA rail'}
                  : {
                      title: p.name,
                      subtitle: p.lines ? `CTA · ${p.lines}` : 'CTA station',
                      // A station whose upstream stop id is unknown carries
                      // null, and simply offers no arrivals.
                      live: p.stopId
                        ? {kind: 'arrivals', stop: p.stopId, mode: 'rail'}
                        : undefined,
                    },
            )}
          />
          <BusOverlay
            visible={visibility.bus}
            routes={busRoutes.data}
            stops={busStops.data}
            onPress={selectFeature<BusRouteProperties | BusStopProperties>('bus', p =>
              'route' in p
                ? {title: `Route ${p.route}`, subtitle: p.name || 'CTA bus'}
                : {
                    title: p.name,
                    subtitle: p.routes ? `Bus stop · ${p.routes}` : 'Bus stop',
                    live: p.stopId
                      ? {kind: 'arrivals', stop: p.stopId, mode: 'bus'}
                      : undefined,
                  },
            )}
          />
          <MetraOverlay
            visible={visibility.metra}
            lines={metraLines.data}
            stations={metraStations.data}
            onPress={selectFeature<MetraLineProperties | MetraStationProperties>(
              'metra',
              p =>
                'line' in p
                  ? {title: `${p.line} Line`, subtitle: 'Metra'}
                  : {
                      title: p.name,
                      subtitle: p.lines ? `Metra · ${p.lines}` : 'Metra station',
                      live: p.stopId
                        ? {kind: 'arrivals', stop: p.stopId, mode: 'metra'}
                        : undefined,
                    },
            )}
          />
          <RouteOverlay route={route} />
          <DivvyOverlay
            visible={visibility.divvy}
            onPress={selectFeature<DivvyStation>('divvy', p => ({
              title: p.name,
              subtitle: p.renting
                ? 'Divvy station · live'
                : 'Divvy station · not renting',
              details: [
                `${p.bikes} bikes available (${p.ebikes} e-bikes)`,
                `${p.docks} open docks`,
              ],
            }))}
          />
          <EventOverlay
            visible={visibility.events}
            bbox={placesBbox}
            onPress={selectFeature<EventFeatureProperties>('events', p => ({
              title: p.title,
              subtitle: [p.venueName, sourceLabel(p.source)].filter(Boolean).join(' · '),
              details: [
                p.startsAt ? new Date(p.startsAt).toLocaleString() : undefined,
                p.free ? 'Free' : undefined,
              ].filter((line): line is string => Boolean(line)),
            }))}
          />
          <LandmarkOverlay
            visible={visibility.landmarks}
            data={landmarkData}
            onPress={selectFeature<PlaceSummary>('landmarks', p => ({
              title: p.name,
              // Native feature properties drop null values, so a missing
              // communityArea arrives as undefined; filter(Boolean) covers both.
              subtitle: [p.communityArea, INDEPENDENCE_LABEL[p.independence]]
                .filter(Boolean)
                .join(' · '),
              live: {kind: 'place', id: p.id},
            }))}
          />

          {userLocation ? <UserLocation animated accuracy heading={recenterMode === 'heading'} /> : null}
        </Map>
      </View>

      {/* Search sits above the chips; both clear the compass on the right. */}
      <View
        style={[styles.topWrapper, {top: insets.top + EDGE}]}
        pointerEvents="box-none">
        <SearchBar onSelect={handleSearchSelect} onSelectAddress={handleSelectAddress} />
        <View onLayout={handleChipRowLayout}>
          <LayerToggle visibility={visibility} onToggle={toggleLayer} />
        </View>
        {hints.map(hint => (
          <View key={hint} style={styles.hint}>
            <Text style={styles.hintText}>{hint}</Text>
          </View>
        ))}
      </View>

      {/* Bottom-left: credits for the overlay data, which differ per layer and
          come from the layer index. Hidden behind the card, like the locate
          button, so nothing sits under an open card. */}
      {selected ? null : (
        <View
          style={[styles.attributionWrapper, {bottom: insets.bottom + EDGE}]}
          pointerEvents="box-none">
          <LayerAttribution visibility={visibility} />
        </View>
      )}

      {/* Bottom-right, above the basemap's own attribution button, and hidden
          behind the card while one is open so the two never overlap. */}
      {selected ? null : (
        <View
          style={[styles.locateWrapper, {bottom: insets.bottom + 56}]}
          pointerEvents="box-none">
          <LocateButton
            mode={recenterMode}
            onLocated={handleLocated}
            onModeChange={handleRecenterModeChange}
          />
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

/**
 * "park_district" → "Park district". Derived from the value rather than a
 * lookup table, so the app never spells out partner names and a new backend
 * source still gets a sensible label.
 */
function sourceLabel(source: string): string {
  const words = source.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const styles = StyleSheet.create({
  container: {flex: 1},
  map: {flex: 1},
  topWrapper: {
    position: 'absolute',
    left: EDGE,
    right: EDGE,
    gap: STACK_GAP,
  },
  hint: {
    alignSelf: 'flex-start',
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  hintText: {fontSize: 12, color: '#ffffff', fontWeight: '500'},
  locateWrapper: {position: 'absolute', right: EDGE},
  attributionWrapper: {position: 'absolute', left: EDGE, right: 56},
  cardWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
  },
});
