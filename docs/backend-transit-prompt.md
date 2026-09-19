# Backend prompt: transit data

Paste the block below into a Claude Code session opened in `wm-chicago-maps-backend`.

It is written against that repo as of `9e2c168`, and against the app's provisional
contracts in `src/api/transitLayers.ts`. The app side is already built: buses and
Metra draw nothing until these layers exist, and stations offer no arrivals until
they carry stop ids.

Two things the endpoint needs beyond the code: `CTA_TRAIN_KEY` and `CTA_BUS_KEY` in
the backend env, or `/v1/transit/arrivals` returns 502 even once stop ids land.

---

````
Add the transit data the mobile app is already built against: CTA stop ids on rail
stations, a bus routes+stops layer, and Metra lines+stations. The app parses all of
this with zod, so match the contracts exactly.

## 1. Stop ids on transit-stations

The app calls GET /v1/transit/arrivals?stop=&mode= when a tapped station carries an
id. Today TransitStationProperties is {name, lines} and nothing can be called.

- Add `stopId: string | null` to TransitStationProperties (packages/shared/src/layers.ts:20).
  Make it nullable, not required: already-ingested runs must keep validating.
- It must be the CTA Train Tracker **mapid** (4xxxx), which is what
  upstream/cta.ts:10 branches on (`stop.startsWith('4') ? 'mapid' : 'stpid'`).
- OSM's `railway=station` nodes do not reliably carry it. The better source is
  Chicago's "CTA - 'L' (Rail) Stations" Socrata dataset, which has map_id, stop_id
  and coordinates. There's already a Socrata client at apps/api/src/upstream/socrata.ts,
  but its DATASETS map has no CTA L-stops entry — add one, and match to the OSM
  station by nearest point (the 120 m proximity logic in ingest/layers.ts:157 is the
  pattern to follow). If you find a cleaner join, take it and say why.
- No DB migration needed: properties is jsonb.
- Re-ingest: pnpm --filter @wm/api job:run ingest.layers '{"only":["transit-stations"]}'

## 2. Bus layer — two new keys

GET /v1/layers/bus-routes → LineString features, properties:
  {route: string, name: string, color: string}
  `route` is the public number as posted ("22", "X9"); `color` is a hex string,
  since the app paints from ['get','color'] with no fallback.

GET /v1/layers/bus-stops → Point features, properties:
  {name: string, stopId: string | null, routes: string}
  `stopId` is the CTA Bus Tracker **stpid**, which upstream/cta.ts:32 takes.
  `routes` is comma-joined, like `lines` on rail stations; the app draws it as
  the stop's label.

Source: OSM bus coverage is inconsistent, so prefer the CTA GTFS static feed
(https://www.transitchicago.com/downloads/sch_data/google_transit.zip) or the CTA
bus stops Socrata dataset for authoritative stpids. A zip/CSV reader is a new
dependency; Socrata needs only a DATASETS entry. Pick one and note the tradeoff.

Scale warning: ~10k bus stops. writeLayer batches 500 per insert inside one
transaction, and GET /v1/layers/:key builds the whole FeatureCollection in memory
with a 6 h LRU entry, against a 900 MB heap limit (server.ts:35). If the response
is very large, say so rather than quietly shipping it.

## 3. Metra layer — two new keys

GET /v1/layers/metra-lines → LineString features {line: string, color: string}
GET /v1/layers/metra-stations → Point features {name, stopId: string | null, lines: string}
  `stopId` is the Metra GTFS stop_id (alphanumeric, e.g. "RAVENSWOOD"). ArrivalsQuery
  already accepts up to 40 chars, so no schema change there.

Lowest-friction source for the geometry is Overpass, reusing fetchTransit verbatim:
relation[type=route][route=train][operator~Metra] plus railway=station nodes. That
needs no API key. CTA_LINE_COLORS is CTA-only — add METRA_LINE_COLORS (UP-N, UP-NW,
UP-W, BNSF, MD-N, MD-W, NCS, HC, RI, ME, SWS), and note lineNameFor
(ingest/layers.ts:105) is hardcoded to CTA names.

Metra arrivals are optional in this change. transit.ts:15 throws 400 "not
implemented yet", and the app degrades to "Arrivals unavailable" — that's fine for
now. If you do implement it: Metra's GTFS API uses HTTP Basic auth, so env.ts:28's
single METRA_API_KEY needs a second var, and fetchJson supports custom headers.

## Things that will bite you

- **routes/v1/layers.ts:46 is `const isPoint = req.params.key === 'transit-stations'`.**
  Every new point layer (bus-stops, metra-stations) returns null geometry until this
  becomes a set of point-geometry keys.
- **layerKeyEnum** (packages/db/src/schema/enums.ts:13) needs the four new values, which
  means a generated migration with ALTER TYPE ... ADD VALUE. Follow
  packages/db/drizzle/README.md: two hand edits are required after every db:generate,
  and never use drizzle-kit push. ALTER TYPE ADD VALUE cannot run inside a transaction
  on older PG.
- **ATTRIBUTION** (ingest/layers.ts:9) is hardcoded to OpenStreetMap. A CTA- or
  Metra-GTFS-sourced layer needs its own, so make it per-layer.
- Follow the existing writeLayer "new run, then flip current" convention, and extend the
  default `wanted` set at ingest/layers.ts:22.
- ingest.layers is scheduled weekly (jobs/names.ts SCHEDULES). Decide whether buses
  belong on that cadence or their own.

## Done means

1. Tests in the existing style: unit tests for the new fetch/parse functions, and
   integration tests following src/test/integration.test.ts (it mocks upstream/overpass.js
   and skips without DATABASE_URL; add your own afterAll cleanup like lines 58-59).
   Never hit the network — src/upstream/__fixtures__/ is the documented convention and
   doesn't exist yet, so you'd be creating it.
2. The CLAUDE.md gate passes: pnpm -r typecheck && pnpm -r lint && pnpm -r test
3. Rebuild, because a restart reuses the old image:
   cd infra && docker compose up -d --build api
4. These all return 200 with features:
   curl "http://localhost:3000/v1/layers/bus-routes" | head -c 300
   curl "http://localhost:3000/v1/layers/bus-stops" | head -c 300
   curl "http://localhost:3000/v1/layers/metra-lines" | head -c 300
   curl "http://localhost:3000/v1/layers/metra-stations" | head -c 300
   curl "http://localhost:3000/v1/layers/transit-stations" | grep -o '"stopId":"4[0-9]*"' | head
   And arrivals answer for an id from that last one:
   curl "http://localhost:3000/v1/transit/arrivals?stop=40850&mode=rail"
5. Update README's layer table and apps/api/.env.example for any new keys.
6. Commit on a branch, and give the commit SHA in the summary so the app can re-vendor
   packages/shared/src/layers.ts. The app's copy is src/api/schema/, where relative
   imports drop the ".js" suffix.
````

---

## When it's done

Send me the commit SHA. I'll re-vendor `packages/shared/src/layers.ts` into
`src/api/schema/`, delete `src/api/transitLayers.ts`, and point the overlays at the
shared schemas.
