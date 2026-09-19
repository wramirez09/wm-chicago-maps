# wm-chicago-maps

A bare React Native app (no Expo) rendering a MapLibre map of Chicago.

- **Map:** [`@maplibre/maplibre-react-native`](https://github.com/maplibre/maplibre-react-native) v11
- **Basemap:** [OpenFreeMap](https://openfreemap.org) "Liberty" — a full
  OpenMapTiles/OSM basemap with street, highway and place detail. Free, no API
  key. See [Swapping the basemap](#swapping-the-basemap).
- **Data:** every overlay, place and live feed comes from
  [wm-chicago-maps-backend](https://github.com/wramirez09/wm-chicago-maps-backend).
  The app calls exactly one host — the API — plus OpenFreeMap for basemap
  tiles. See [Backend API](#backend-api).
- **Overlays:** expressways, arterial streets, the CTA 'L' network, landmarks,
  Divvy, events and neighbourhoods, each toggleable and tappable. Layers are
  cached on disk, so the map draws offline after the first launch. See
  [Map data](#map-data).
- **Search:** over the map's own loaded data, no request per keystroke. See
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

That is enough to run: the app ships pointing at the deployed backend,
`https://chicago-api.fly.dev`, and needs no API key of its own — every upstream
credential lives on the server.

To run against a backend on your own machine instead, copy `.env.example` to
`.env` and set `API_URL` (`http://localhost:3000` for the iOS simulator,
`http://10.0.2.2:3000` for the Android emulator, and your Mac's LAN IP for a
physical device, where `localhost` means the phone). `react-native-config`
inlines it at **native build** time, so changing it needs
`npm run ios`/`android`, not a Metro reload.

To run the backend locally, in the backend repo:

```sh
docker compose -f infra/docker-compose.yml up --build -d
docker compose -f infra/docker-compose.yml exec api node dist/jobs/run.js ingest.areas
docker compose -f infra/docker-compose.yml exec api node dist/jobs/run.js ingest.layers
# The landmark seed runs from source (it is not in the container build):
pnpm install && pnpm --filter @wm/shared --filter @wm/db build
DATABASE_URL=postgres://postgres:postgres@localhost:5432/chicago \
  JWT_SECRET=local-dev-only-secret-local-dev-only-secret \
  pnpm --filter @wm/api seed
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
| `App.tsx` | Root: persisted query client, safe-area provider, `MapScreen` |
| `src/api/client.ts` | The only HTTP client: `API_URL`, 10 s timeout, zod-validated responses, `ApiError` |
| `src/api/hooks.ts` | TanStack Query hooks: layers, places, areas, events, Divvy, arrivals |
| `src/api/queryClient.ts` | Stale times and on-disk persistence of layers and areas |
| `src/api/storage.ts` | MMKV stores (auth, cache) |
| `src/api/auth.ts`, `src/api/tokens.ts` | Session: native sign-in, refresh, sign-out; tokens in MMKV (no UI yet) |
| `src/api/route.ts` | Walking directions from `/v1/route` |
| `src/api/schema/` | **Vendored** `@wm/shared` — the backend's zod contract; do not edit |
| `src/api/types.ts` | TypeScript types inferred from the contract |
| `src/config/map.ts` | Style URL, fontstacks, label anchor, zoom limits |
| `src/config/layers.ts` | Layer keys, accent colours, labels, focus zooms |
| `src/components/MapScreen.tsx` | Map, camera, overlay wiring, tap handling |
| `src/components/overlays/` | One component per layer (source + style layers) |
| `src/components/LayerToggle.tsx` | Chips that show/hide each overlay |
| `src/components/SearchBar.tsx` | Search field + results list |
| `src/components/FeatureCard.tsx` | Bottom card shown when a feature is tapped |
| `src/search/searchIndex.ts` | Builds and queries the search index from loaded data |
| `src/lib/device/` | Location and push wrappers |
| `docs/openapi.json` | The backend's OpenAPI, for reference |
| `__mocks__/` | Jest mocks for native modules (MapLibre, MMKV, config, permissions, geolocation) |

## Map data

Overlay data lives in the backend. A weekly job ingests it and serves it as
GeoJSON; the app no longer bundles or generates any of it. Sources vary by
layer — some OpenStreetMap, some the CTA's published data — so each layer
carries its own `attribution` in `GET /v1/layers`, and the map credits the
sources for the layers actually switched on (`LayerAttribution`).

| Overlay | Endpoint |
| --- | --- |
| Expressways | `GET /v1/layers/expressways` |
| Arterial streets | `GET /v1/layers/arterials` |
| CTA 'L' lines / stations | `GET /v1/layers/transit-lines`, `GET /v1/layers/transit-stations` |
| CTA bus routes / stops | `GET /v1/layers/bus-routes`, `GET /v1/layers/bus-stops` |
| Metra lines / stations | `GET /v1/layers/metra-lines`, `GET /v1/layers/metra-stations` |
| Landmarks | `GET /v1/places?bbox=…&category=landmark` |
| Neighbourhoods | `GET /v1/areas` |
| Divvy | `GET /v1/transit/divvy` |
| Events | `GET /v1/events?bbox=…` |

Layers are fetched once, persisted to disk (MMKV), and revalidated with their
ETag (`If-None-Match`); a `304` keeps the cached body. So after the first
successful launch the overlays draw immediately, including with the API down.
The bus and Metra layers are fetched only while their chip is on: bus-stops
alone is 10,556 points (1.6 MB uncompressed), drawn as one clustered symbol
source gated to zoom 15+ rather than a component per stop. A `404` from
`/v1/layers/:key` means that layer has never been ingested, which the client
raises as `MissingLayerError` — not the same as a collection with no features.
Landmarks and events follow the viewport: the camera's region is debounced
300 ms and only refetched when the view moves by more than ~10%.

While a layer is still loading its source mounts with an empty collection
rather than not at all. Layers are inserted below `LABEL_ANCHOR_LAYER_ID` at
mount time, so mount order is draw order; mounting empty keeps arterials under
expressways under transit regardless of which request finishes first.

Overlay data is © OpenStreetMap contributors, licensed
[ODbL](https://opendatacommons.org/licenses/odbl/). The app surfaces this
through MapLibre's built-in attribution control — keep it visible.

### Adding an overlay

1. Serve it from the backend and add its schema to `@wm/shared`, then
   re-vendor `src/api/schema/`.
2. Add a hook in `src/api/hooks.ts` (for a layer, extend `LAYER_SCHEMAS`).
3. Add `src/components/overlays/<Thing>Overlay.tsx` taking the collection as a
   `data` prop, mounting with `EMPTY_COLLECTION` while it loads.
4. Add the key to `src/config/layers.ts` and render the overlay in
   `MapScreen.tsx` with a `selectFeature` describer.

Overlay layers pass `beforeId={LABEL_ANCHOR_LAYER_ID}` so they draw above the
basemap's roads but below its labels. Landmarks deliberately omit it and sit on
top of everything.

## Search

`src/search/searchIndex.ts` indexes the collections the map has already
loaded — landmark names, CTA station names, 'L' line names, expressway names
and every distinct arterial street name — and matches them as the user types.
`SearchBar` reads the same cached queries as the map, so searching makes no
request, works offline once layers are cached, and a warm query takes well
under a millisecond.

The index is built lazily on the first real query (~50 ms to walk ~25k
features in Node), not at startup, and rebuilt only when a collection is
replaced. Lines sharing a name are collapsed into one result,
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

Street addresses come from the backend instead of the local index: `SearchBar`
debounces the query into `GET /v1/geocode` (minimum 3 characters) and shows its
hits alongside the local ones, so "1060 W Addison" resolves. A failed or
unreachable geocoder degrades to the local index rather than an error.

## Backend API

`src/api/client.ts` is the only thing in the app that makes HTTP requests. It
prefixes `API_URL`, times out after 10 s (30 s for the first request of a
session, which may be waking Fly's suspended machines), validates every
response with the
backend's zod schemas (`schema.parse`, so contract drift fails loudly instead
of rendering undefined fields), sends the Bearer token when signed in, and
throws one `ApiError` carrying the backend's `statusCode` and `message`.

### The contract (`@wm/shared`)

The schemas are **vendored** into `src/api/schema/` from the backend's
`packages/shared/src` — the commit is recorded in each file's header. They are
not installed as a package: npm cannot install a subdirectory of a git repo (it
ignores `&path:` and installs the whole monorepo under another name), and the
package depends on pnpm `workspace:` packages. An `@wm/shared` alias in
`metro.config.js`, `tsconfig.json` and `jest.config.js` keeps imports reading as
the package name.

**Restart Metro after pulling this change** (or any `metro.config.js` change).
Metro reads its config only at startup; a dev server started before the alias
existed fails with `Unable to resolve module @wm/shared` even though
`npx react-native bundle` (which starts a fresh Metro) builds fine. To update: copy the files again, drop the `.js` suffix from
relative imports (Metro does not map `./common.js` to `common.ts`), and bump
`CACHE_BUSTER` in `src/api/queryClient.ts` so old cached data is discarded.

### Cache policy

Set in `src/api/queryClient.ts`: layers and areas 24 h, places and Divvy 60 s,
arrivals 30 s, events 5 min. Only layers and areas are persisted, for 30 days —
live data restored from disk would show stale times as current. The persister
skips writes when no persisted query changed: the cache is ~5.5 MB of JSON, and
without that every Divvy refresh would re-serialise it.

### Not available yet

These were removed when the app moved onto the API, because they called
third parties directly and the API has no equivalent yet. Each comes back when
its endpoint exists.

| Feature | Needs |
| --- | --- |
| Live arrivals | `CTA_TRAIN_KEY` / `CTA_BUS_KEY` set as Fly secrets — until then rail and bus arrivals answer `502` and the card says so. Stop ids are on the features, so nothing else is missing |
| Metra arrivals | Metra support in the backend (`/v1/transit/arrivals?mode=metra` answers `400`, "not implemented yet") |
| Weather chip | A weather endpoint |
| Parks, wards layers | Boundary layers |
| Businesses, ownership | Places ingested from licences |

### Auth

The backend owns auth. `src/api/auth.ts` sends a provider identity token to
`POST /v1/auth/native` and stores the returned JWT pair; the client attaches
the access token and, on a 401, refreshes once and retries once. Refresh is
single-flight because the backend rotates refresh tokens — two concurrent
refreshes would present a revoked token and sign the user out. There is no
sign-in UI yet; obtaining an identity token needs
`@invertase/react-native-apple-authentication` or
`@react-native-google-signin/google-signin`.

### Tests

Client tests mock `fetch`; nothing in the suite touches the network.

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

The recenter button (bottom right) asks for location permission on first tap,
then follows the user; tapping again switches to compass heading. It refuses to
follow a user outside Chicago, since native tracking ignores `maxBounds` and
would drag the city map to wherever they are. Permissions are declared in
`ios/WmChicagoMaps/Info.plist` (`NSLocationWhenInUseUsageDescription`) and
`android/app/src/main/AndroidManifest.xml` (fine + coarse location).
