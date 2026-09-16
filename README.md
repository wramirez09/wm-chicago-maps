# wm-chicago-maps

A bare React Native app (no Expo) rendering a MapLibre map of Chicago.

- **Map:** [`@maplibre/maplibre-react-native`](https://github.com/maplibre/maplibre-react-native) v11
- **Basemap:** [OpenFreeMap](https://openfreemap.org) "Liberty" — a full
  OpenMapTiles/OSM basemap with street, highway and place detail. Free, no API
  key. See [Swapping the basemap](#swapping-the-basemap).
- **Overlays:** Chicago expressways, arterial streets and the CTA 'L' network,
  each toggleable and tappable. See [Map data](#map-data).
- **Search:** offline search over that data — no geocoder, no API key. See
  [Search](#search).

## Requirements

- Node **22.11+** (`package.json` declares this engine; the repo currently
  installs fine on Node 20 but React Native 0.87 does not support it)
- Ruby + Bundler, Xcode, and a JDK **17** for Android
  (`JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home` —
  newer JDKs are not supported by the Gradle/AGP versions here)

## Setup

```sh
npm install
(cd ios && bundle install && bundle exec pod install)
```

`ios/Podfile` calls `$MLRN.post_install(installer)`. That hook is what pulls
in the MapLibre native SDK as a Swift Package; without it the pod's sources
fail with `'MapLibre/MapLibre.h' file not found`. Keep it if you regenerate
the Podfile.

## Run

```sh
npm start          # Metro
npm run ios
npm run android
```

## Checks

```sh
npm run lint
npm run typecheck
npm test
```

Note: this project uses **npm** (`package-lock.json`), not yarn or pnpm.

## Layout

| Path | What it is |
| --- | --- |
| `App.tsx` | Root component: safe-area provider + `MapScreen` |
| `src/config/map.ts` | Style URL, fontstacks, label anchor, center/bounds, zoom limits |
| `src/data/landmarks.ts` | Hand-written GeoJSON points |
| `src/data/expressways.ts` | **Generated** — motorway/trunk lines from OSM |
| `src/data/arterials.ts` | **Generated** — named primary/secondary streets from OSM |
| `src/data/transit.ts` | **Generated** — CTA 'L' lines and stations from OSM |
| `scripts/fetch-*.mjs` | Regenerate the three datasets from the Overpass API |
| `src/components/MapScreen.tsx` | Map, camera, overlay wiring, tap handling |
| `src/components/overlays/` | One component per data layer (source + style layers) |
| `src/components/LayerToggle.tsx` | Chips that show/hide each overlay |
| `src/components/SearchBar.tsx` | Search field + results list |
| `src/search/searchIndex.ts` | Builds and queries the offline search index |
| `src/config/layers.ts` | Layer keys, accent colours, labels, focus zooms |
| `src/components/FeatureCard.tsx` | Bottom card shown when a feature is tapped |
| `src/lib/api/` | API clients, one file per service, grouped |
| `src/lib/api/http.ts` | The only `fetch` wrapper: timeout, retry, typed errors |
| `src/lib/device/` | Location and push wrappers |
| `supabase/functions/` | Edge Functions for credentials that can't ship |
| `scripts/ingest/` | Bulk data loaders, run with tsx |
| `__mocks__/@maplibre/` | Jest mock — MapLibre is native and can't render in Jest |
| `__mocks__/react-native-config.js` | Jest mock — env is inlined at native build time |

## Map data

The three overlay datasets are generated, not hand-maintained. Each script
queries the [Overpass API](https://overpass-api.de) for the Chicago bounding
box, simplifies the geometry (Douglas-Peucker) and writes a typed TS module:

```sh
node scripts/fetch-expressways.mjs
node scripts/fetch-arterials.mjs
node scripts/fetch-transit.mjs
```

The output is committed so the app needs no network at build time. Re-run a
script when the data goes stale; do not edit `src/data/*.ts` by hand.

Overlay data is © OpenStreetMap contributors, licensed
[ODbL](https://opendatacommons.org/licenses/odbl/). The app surfaces this
through MapLibre's built-in attribution control — keep it visible.

### Adding an overlay

1. Write (or generate) `src/data/<thing>.ts` exporting a typed
   `FeatureCollection`.
2. Add `src/components/overlays/<Thing>Overlay.tsx`: a `GeoJSONSource` plus its
   style `Layer`s, exporting a `<THING>_ACCENT` colour.
3. Register it in `LayerToggle.tsx`'s `LAYERS` array and render it in
   `MapScreen.tsx` with a `selectFeature` describer.

Overlay layers pass `beforeId={LABEL_ANCHOR_LAYER_ID}` so they draw above the
basemap's roads but below its labels. Landmarks deliberately omit it and sit on
top of everything.

## Search

`src/search/searchIndex.ts` indexes the committed datasets — landmark names,
CTA station names, 'L' line names, expressway names and every distinct arterial
street name — and matches them as the user types. It needs no network and no
API key, and a warm query takes well under a millisecond.

The index is built lazily on the first keystroke (~25 ms to walk ~25k
features), not at startup. Lines sharing a name are collapsed into one result,
whose camera target is the real vertex nearest the group's bounding-box centre
— a street that bends or is split around a park has a box centre that can sit
blocks off the pavement.

Three behaviours worth knowing before changing the ranking:

- Punctuation is a word break, so `O'Hare` indexes as `o hare`; a compact
  fallback (`ohare`) also matches, letting the query disagree with the data
  about spacing.
- At most two results may share a name (`MAX_PER_NAME`). The 'L' has four
  stations called Western; without the cap they bury Western Avenue.
- Stations with the same name *and* the same serving lines are collapsed —
  that pattern means one platform split across two OSM records.

**It does not do street addresses.** "1060 W Addison" finds nothing. Adding
that means a geocoder (Nominatim and Photon are free; both have usage policies,
and Nominatim requires a real User-Agent). Wire one in as a second result
source behind `searchLocations`, merging its hits into the same `SearchResult`
shape — the UI needs no change.

## API integrations

Clients live in `src/lib/api/<group>/<service>.ts`, one file per service, named
exports only. Every one of them goes through `src/lib/api/http.ts` — a single
`fetchJson` with an AbortController timeout, one retry on 5xx/network, JSON
parsing and a typed `ApiError`. Read-only calls are wrapped in TanStack Query
hooks in each group's `hooks.ts`.

| Service | Purpose | Key from | Runs |
| --- | --- | --- | --- |
| Chicago Data Portal (Socrata) | Business licences, owners, community areas | `SOCRATA_APP_TOKEN` (optional, public) | On-device |
| Cook County Assessor | Parcel lookup by PIN/address; owner-occupancy signal | none | On-device |
| Photon | Geocode / reverse geocode, bbox-locked to Chicago | `PHOTON_URL` (self-hosted) | On-device |
| Overture Maps Places | Bulk POI extract → `places_raw` | none | Ingest script |
| OpenStreetMap Overpass | POI diff source | none | Ingest script |
| Google Business Profile | Owner-consented listing sync | `GBP_CLIENT_ID`/`GBP_CLIENT_SECRET` | **Edge Function** |
| Chicago boundaries | Wards, parks, landmarks, ZIPs (GeoJSON) | reuses Socrata | On-device |
| Chicago Park District | Outdoor event permits, park facilities | reuses Socrata | On-device |
| CTA Train Tracker | 'L' arrivals by mapid/stpid | `CTA_TRAIN_KEY` | On-device |
| CTA Bus Tracker v2 | Bus predictions, live vehicles | `CTA_BUS_KEY` | On-device |
| CTA GTFS static | Stops/routes → `transit_stops` | none | Ingest script |
| Divvy GBFS | Station information + live status | none | On-device |
| Metra GTFS-RT | Vehicle positions, trip updates (protobuf) | `METRA_KEY`/`METRA_SECRET` | On-device |
| Valhalla | Routing + isochrones | `VALHALLA_URL` (self-hosted) | On-device |
| Ticketmaster Discovery | Events by lat/long + radius | `TICKETMASTER_KEY` | On-device |
| Bandsintown | Concerts by location | `BANDSINTOWN_APP_ID` | On-device |
| Eventbrite | Organiser-owned events only | `EVENTBRITE_TOKEN` | **Edge Function** |
| Open-Meteo | Current conditions for the events feed | none | On-device |
| Sentry / PostHog | Crash reporting, product analytics | `SENTRY_DSN`, `POSTHOG_API_KEY` | On-device (not installed) |

### Where keys live

`react-native-config` inlines `.env` at **native build** time, so changing a
value needs a rebuild — a Metro reload will not pick it up. Everything in
`.env` ships inside the app bundle and must be treated as public.

Three things never go there:

- `EVENTBRITE_TOKEN`, `GBP_CLIENT_SECRET` → `supabase secrets set …`. The app
  calls the Edge Function; the function calls the vendor.
- `SUPABASE_SERVICE_ROLE_KEY` → `scripts/.env` (gitignored). It bypasses RLS
  and is only used by the ingest scripts.

The Socrata app token is the deliberate exception: it is a public throttling
identifier, not a credential, and Socrata expects it in client requests.

### Cache policy

`staleTime` is set per data class in `src/lib/query.ts`: static datasets 24h,
live arrivals 30s, GBFS 60s, weather 10m. `fetchJson` already retries once, so
the QueryClient sets `retry: false` — otherwise one failure becomes four
requests.

### Ingest scripts

Bulk downloads run under `tsx` on a workstation, not in the app:

```sh
npm run ingest:overture     # needs `pipx install overturemaps`
npm run ingest:overpass
npm run ingest:gtfs-cta
```

### Tests

One Jest test per client, each replaying a fixture from
`src/lib/api/__fixtures__/` against a mocked `fetch`. No test touches the
network. Fixtures for the keyless APIs are recorded from live responses; those
for key-gated APIs (CTA, Ticketmaster, Bandsintown, Eventbrite) are built from
the published response shapes.

## Swapping the basemap

`MAP_STYLE_URL` in `src/config/map.ts` points at OpenFreeMap Liberty. To use
another provider (MapTiler, Stadia, a self-hosted Protomaps basemap), two other
constants in that file have to move with it:

- `FONT_REGULAR` / `FONT_BOLD` — the style's glyph server only serves the
  fontstacks it was built with. Liberty serves **Noto Sans** only; a symbol
  layer asking for anything else (including the style-spec default,
  `Open Sans Regular`) renders **no text at all, with no error**.
- `LABEL_ANCHOR_LAYER_ID` — the basemap layer our overlays insert themselves
  before. Wrong id and the overlays paint over the place names.

For a keyed provider, read the key from the environment (e.g. via
`react-native-config`) rather than committing it.

## Showing the user's location

`UserLocation` / `Camera trackUserLocation` are not wired up yet. They need
platform permissions first:

- iOS — `NSLocationWhenInUseUsageDescription` in `ios/WmChicagoMaps/Info.plist`
- Android — `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` in
  `android/app/src/main/AndroidManifest.xml`, requested at runtime
