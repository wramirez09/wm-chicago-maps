/**
 * Search over the map's own data: the API's layers and landmark places.
 *
 * No request is made per keystroke. The index is built from collections the
 * map has already loaded (and persisted), so results appear as fast as the
 * user types, including offline once layers are cached. The trade-off is
 * scope: it finds streets, expressways, CTA stations and landmarks, but *not*
 * street addresses ("1060 W Addison"), which would need a geocoding endpoint.
 */
import type {PlaceCollection} from '@wm/shared';

import type {
  ArterialCollection,
  ExpresswayCollection,
  TransitLineCollection,
  TransitStationCollection,
} from '../api/types';
import {LAYER_ACCENT, type LayerKey} from '../config/layers';
import {MAX_ZOOM, MIN_ZOOM} from '../config/map';

/** Whatever collections have loaded; a missing one just contributes nothing. */
export type SearchSources = {
  expressways?: ExpresswayCollection;
  arterials?: ArterialCollection;
  transitLines?: TransitLineCollection;
  transitStations?: TransitStationCollection;
  landmarks?: PlaceCollection;
};

export type SearchResultKind =
  | 'landmark'
  | 'station'
  | 'transit-line'
  | 'expressway'
  | 'street';

export type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  kind: SearchResultKind;
  /** Which overlay this result lives on, so the map can reveal it if hidden. */
  layer: LayerKey;
  accent: string;
  center: [number, number];
  /** Zoom that frames the whole feature — a street needs more room than a stop. */
  zoom: number;
};

/**
 * Ranking floor per kind. A landmark called "Western" should beat a street of
 * the same name; a single station beats a 20-mile arterial.
 */
const KIND_RANK: Record<SearchResultKind, number> = {
  landmark: 0,
  station: 1,
  'transit-line': 2,
  expressway: 3,
  street: 4,
};

/**
 * A result plus the two normalised forms we match against: `haystack` keeps
 * word boundaries ("o hare", "clark lake"), `compact` strips them entirely
 * ("ohare", "clarklake") so a query can disagree with the data about where the
 * punctuation goes.
 */
type Entry = {result: SearchResult; haystack: string; compact: string};

/** How many results may share one name before the rest are dropped. */
const MAX_PER_NAME = 2;

/** A built index. Opaque: build with buildSearchIndex, query with searchLocations. */
export type SearchIndex = {readonly entries: readonly Entry[]};

/**
 * Walks every feature once. ~25k features cost tens of milliseconds, so callers
 * should build lazily (on the first real query) and rebuild only when a source
 * collection changes, not per keystroke.
 */
export function buildSearchIndex(sources: SearchSources): SearchIndex {
  return {entries: buildEntries(sources)};
}

export function searchLocations(index: SearchIndex, query: string, limit = 8): SearchResult[] {
  const needle = normalize(query);
  if (needle.length < 2) {
    return [];
  }

  const scored: {entry: Entry; score: number}[] = [];

  for (const candidate of index.entries) {
    const score = scoreOf(candidate, needle);
    if (score !== null) {
      scored.push({entry: candidate, score});
    }
  }

  scored.sort(
    (a, b) =>
      a.score - b.score ||
      KIND_RANK[a.entry.result.kind] - KIND_RANK[b.entry.result.kind] ||
      a.entry.result.title.length - b.entry.result.title.length ||
      a.entry.result.title.localeCompare(b.entry.result.title),
  );

  // Cap repeats of one name. The 'L' has four stations called Western and
  // three called Damen; without this they fill the list and bury Western
  // Avenue, which is what someone typing "western" almost always wants.
  const seen = new Map<string, number>();
  const picked: SearchResult[] = [];

  for (const {entry} of scored) {
    const count = seen.get(entry.haystack) ?? 0;
    if (count >= MAX_PER_NAME) {
      continue;
    }
    seen.set(entry.haystack, count + 1);
    picked.push(entry.result);
    if (picked.length === limit) {
      break;
    }
  }

  return picked;
}

/** Lower is better; `null` means no match at all. */
function scoreOf({haystack, compact}: Entry, needle: string): number | null {
  const at = haystack.indexOf(needle);

  if (at === 0) {
    return haystack === needle ? 0 : 1;
  }
  // Matching the start of any word ("adams" in "Jane Addams") beats matching
  // the middle of one ("ada" in "Wabash").
  if (at > 0) {
    return haystack[at - 1] === ' ' ? 2 : 3;
  }

  // Last resort: ignore punctuation and spacing on both sides, so "ohare" and
  // "o hare" both reach "O'Hare", and "clark lake" reaches "Clark/Lake".
  const compactNeedle = needle.replace(/ /g, '');
  return compactNeedle && compact.includes(compactNeedle) ? 4 : null;
}

/**
 * Lowercase, and treat every punctuation mark as a word break: "O'Hare"
 * becomes "o hare", "95th/Dan Ryan" becomes "95th dan ryan". Without this, an
 * apostrophe or slash in the data is unmatchable by anything the user types.
 */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildEntries(sources: SearchSources): Entry[] {
  const built: Entry[] = [];

  for (const {properties, geometry} of sources.landmarks?.features ?? []) {
    built.push(
      makeEntry({
        id: `landmark:${properties.id}`,
        title: properties.name,
        subtitle: properties.communityArea ?? 'Landmark',
        kind: 'landmark',
        layer: 'landmarks',
        center: [geometry.coordinates[0], geometry.coordinates[1]],
        zoom: 15,
      }),
    );
  }

  // Station names repeat across the system (there are several "Western"s), so
  // the serving lines go in the subtitle to tell them apart. A name serving
  // the exact same lines twice is one platform split across two OSM records,
  // not two stations — collapse those.
  const seenStations = new Set<string>();

  (sources.transitStations?.features ?? []).forEach(({properties, geometry}, index) => {
    const key = `${properties.name}|${properties.lines}`;
    if (seenStations.has(key)) {
      return;
    }
    seenStations.add(key);

    built.push(
      makeEntry({
        id: `station:${index}`,
        title: properties.name,
        subtitle: properties.lines
          ? `CTA station · ${properties.lines}`
          : 'CTA station',
        kind: 'station',
        layer: 'transit',
        center: [geometry.coordinates[0], geometry.coordinates[1]],
        zoom: 15,
      }),
    );
  });

  for (const group of groupLines(
    sources.transitLines?.features ?? [],
    f => f.properties.line,
  )) {
    built.push(
      makeEntry({
        id: `transit-line:${group.key}`,
        title: `${group.key} Line`,
        subtitle: 'CTA rail line',
        kind: 'transit-line',
        layer: 'transit',
        center: group.center,
        zoom: group.zoom,
      }),
    );
  }

  // Expressways are grouped by the name people use, so the Kennedy's many
  // separate OSM ways collapse into one result.
  for (const group of groupLines(
    sources.expressways?.features ?? [],
    f => f.properties.localName || f.properties.name || f.properties.ref,
  )) {
    const refs = new Set(
      group.features.map(f => f.properties.ref).filter(Boolean),
    );
    built.push(
      makeEntry({
        id: `expressway:${group.key}`,
        title: group.key,
        subtitle: ['Expressway', [...refs][0]].filter(Boolean).join(' · '),
        kind: 'expressway',
        layer: 'expressways',
        center: group.center,
        zoom: group.zoom,
      }),
    );
  }

  for (const group of groupLines(sources.arterials?.features ?? [], f => f.properties.name)) {
    built.push(
      makeEntry({
        id: `street:${group.key}`,
        title: group.key,
        subtitle:
          group.features[0].properties.kind === 'primary'
            ? 'Major street'
            : 'Street',
        kind: 'street',
        layer: 'arterials',
        center: group.center,
        zoom: group.zoom,
      }),
    );
  }

  return built;
}

function makeEntry(result: Omit<SearchResult, 'accent'>): Entry {
  const haystack = normalize(result.title);
  return {
    result: {...result, accent: LAYER_ACCENT[result.layer]},
    haystack,
    compact: haystack.replace(/ /g, ''),
  };
}

type LineFeature<P> = GeoJSON.Feature<GeoJSON.LineString, P>;

type LineGroup<P> = {
  key: string;
  features: LineFeature<P>[];
  center: [number, number];
  zoom: number;
};

/**
 * Collapse many line segments sharing a name into one searchable place.
 *
 * The representative point is the real vertex nearest the group's bounding-box
 * centre rather than the centre itself: a street that bends, or one split
 * around a park, has a box centre that can sit blocks off the pavement.
 */
function groupLines<P>(
  features: LineFeature<P>[],
  keyOf: (feature: LineFeature<P>) => string,
): LineGroup<P>[] {
  const byKey = new Map<string, LineFeature<P>[]>();

  for (const feature of features) {
    const key = keyOf(feature).trim();
    if (!key) {
      continue;
    }
    const bucket = byKey.get(key);
    if (bucket) {
      bucket.push(feature);
    } else {
      byKey.set(key, [feature]);
    }
  }

  const groups: LineGroup<P>[] = [];

  for (const [key, bucket] of byKey) {
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;

    for (const feature of bucket) {
      for (const [lng, lat] of feature.geometry.coordinates) {
        west = Math.min(west, lng);
        east = Math.max(east, lng);
        south = Math.min(south, lat);
        north = Math.max(north, lat);
      }
    }

    const midLng = (west + east) / 2;
    const midLat = (south + north) / 2;

    let center: [number, number] = [midLng, midLat];
    let best = Infinity;

    for (const feature of bucket) {
      for (const [lng, lat] of feature.geometry.coordinates) {
        const distance = (lng - midLng) ** 2 + (lat - midLat) ** 2;
        if (distance < best) {
          best = distance;
          center = [lng, lat];
        }
      }
    }

    groups.push({
      key,
      features: bucket,
      center,
      zoom: zoomForSpan(Math.max(east - west, north - south)),
    });
  }

  return groups;
}

/**
 * Zoom at which a feature spanning `span` degrees roughly fills the viewport.
 * Each zoom level halves the visible extent, so this is a log2 of the world's
 * 360 degrees over the span, backed off by one level for margin.
 */
function zoomForSpan(span: number): number {
  if (!(span > 0)) {
    return 15;
  }
  const zoom = Math.log2(360 / span) - 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}
