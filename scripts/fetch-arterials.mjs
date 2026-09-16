#!/usr/bin/env node
/**
 * Regenerates `src/data/arterials.ts` from live OpenStreetMap data.
 *
 * Usage: node scripts/fetch-arterials.mjs
 *
 * Fetches every named `highway=primary|secondary` way inside the Chicago
 * bounding box from the Overpass API and writes one GeoJSON LineString
 * Feature per OSM way (no stitching) into a TypeScript module with the data
 * inlined as literals.
 *
 * Data © OpenStreetMap contributors, ODbL.
 */

import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'wm-chicago-maps/1.0 (scripts/fetch-arterials.mjs)';

// Chicago bounding box: south, west, north, east.
const BBOX = [41.62, -87.95, 42.05, -87.5];

const QUERY = `
[out:json][timeout:180];
way["highway"~"^(primary|secondary)$"]["name"](${BBOX.join(',')});
out geom;
`.trim();

const COORD_PRECISION = 5;
const SCALE = 10 ** COORD_PRECISION;

/**
 * Douglas-Peucker tolerance in degrees. Settled on 0.0001 (~8 m in Chicago),
 * the value we started from.
 *
 * Raising it was tried first and barely moves the needle: Overpass splits the
 * arterial grid into ~23k short named ways, and at 0.0001 those already
 * average only ~2.0 points each, so 0.0002 / 0.0003 / 0.001 all land within
 * 0.5% of the same size. Coordinate count is not what blows the 700 KB
 * budget — per-way overhead (the repeated street name and the row scaffolding)
 * is. So the tolerance stays at the accurate end and the budget is met by the
 * encoding instead: names are interned into NAMES and looked up by index, and
 * coordinates are emitted as 1e-5-scaled integers delta-encoded against the
 * previous point (rows are sorted by name, so consecutive segments of the same
 * street sit next to each other and the deltas stay small). That divides the
 * module by ~4 with no loss: every decoded coordinate is bit-identical to the
 * 5-decimal rounded value.
 */
const SIMPLIFY_TOLERANCE = 0.0001;

/** Perpendicular distance from `p` to the segment `a`-`b`, in degrees. */
function perpendicularDistance(p, a, b) {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - ax, py - ay);
  }
  const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + clamped * dx), py - (ay + clamped * dy));
}

/** Douglas-Peucker line simplification. */
function simplify(points, tolerance) {
  if (points.length < 3) {
    return points;
  }
  const first = points[0];
  const last = points[points.length - 1];
  let index = -1;
  let maxDistance = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      index = i;
      maxDistance = distance;
    }
  }
  if (maxDistance <= tolerance) {
    return [first, last];
  }
  const left = simplify(points.slice(0, index + 1), tolerance);
  const right = simplify(points.slice(index), tolerance);
  return left.slice(0, -1).concat(right);
}

const round = value => Number(value.toFixed(COORD_PRECISION));

/** Single-quoted string literal, to match the code style in src/data. */
const quote = value =>
  /['\\\r\n]/.test(value) ? JSON.stringify(value) : `'${value}'`;

/** Drops consecutive duplicates left behind by rounding. */
function dedupe(points) {
  return points.filter(
    (point, i) =>
      i === 0 || point[0] !== points[i - 1][0] || point[1] !== points[i - 1][1],
  );
}

async function fetchWays() {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({data: QUERY}),
  });
  if (!response.ok) {
    throw new Error(
      `Overpass request failed: ${response.status} ${response.statusText}`,
    );
  }
  const body = await response.json();
  return body.elements ?? [];
}

function toFeatures(ways) {
  const features = [];
  for (const way of ways) {
    const name = way.tags?.name;
    const kind = way.tags?.highway;
    if (!name || (kind !== 'primary' && kind !== 'secondary')) {
      continue;
    }
    const geometry = way.geometry ?? [];
    const rounded = dedupe(
      geometry.map(({lat, lon}) => [round(lon), round(lat)]),
    );
    if (rounded.length < 2) {
      continue;
    }
    const coordinates = dedupe(simplify(rounded, SIMPLIFY_TOLERANCE));
    if (coordinates.length < 2) {
      continue;
    }
    features.push({name, kind, coordinates});
  }
  // Stable output so re-runs produce minimal diffs — and, because the rows are
  // delta-encoded against each other, grouping a street's segments together
  // also keeps the deltas (and therefore the file) small.
  features.sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      a.kind.localeCompare(b.kind) ||
      a.coordinates[0][0] - b.coordinates[0][0] ||
      a.coordinates[0][1] - b.coordinates[0][1],
  );
  return features;
}

function render(features) {
  const date = new Date().toISOString().slice(0, 10);
  const names = [...new Set(features.map(feature => feature.name))];
  const nameIndex = new Map(names.map((name, i) => [name, i]));

  let prevLng = 0;
  let prevLat = 0;
  const rows = features.map(feature => {
    const numbers = [];
    for (const [lng, lat] of feature.coordinates) {
      const x = Math.round(lng * SCALE);
      const y = Math.round(lat * SCALE);
      numbers.push(x - prevLng, y - prevLat);
      prevLng = x;
      prevLat = y;
    }
    const kind = feature.kind === 'primary' ? 0 : 1;
    return `  [${nameIndex.get(feature.name)},${kind},${numbers.join(',')}],`;
  });

  const nameRows = names.map(name => `  ${quote(name)},`);

  return `// GENERATED FILE — do not edit by hand. Run \`scripts/fetch-arterials.mjs\`.
//
// Generated by \`scripts/fetch-arterials.mjs\` on ${date}.
// Source: OpenStreetMap via the Overpass API — named \`highway=primary\` and
// \`highway=secondary\` ways inside the Chicago bounding box, one LineString
// Feature per OSM way (no stitching).
// Coordinates are rounded to ${COORD_PRECISION} decimals and simplified with
// Douglas-Peucker at a tolerance of ${SIMPLIFY_TOLERANCE} degrees.
// Data © OpenStreetMap contributors, ODbL.

export type ArterialProperties = {
  name: string;
  kind: 'primary' | 'secondary';
};

export type ArterialCollection = GeoJSON.FeatureCollection<
  GeoJSON.LineString,
  ArterialProperties
>;

/** Street names, interned: the same ~${names.length} names cover every segment. */
const NAMES: string[] = [
${nameRows.join('\n')}
];

const KINDS: ArterialProperties['kind'][] = ['primary', 'secondary'];

/**
 * One row per OSM way: \`[nameIndex, kindIndex, ...coords]\`, where coords are
 * longitude/latitude pairs scaled by ${SCALE} and delta-encoded against the
 * previous point in the file. Decoding divides by ${SCALE}, which reproduces the
 * ${COORD_PRECISION}-decimal values exactly.
 */
type ArterialSeed = [nameIndex: number, kindIndex: number, ...coords: number[]];

const SEEDS: ArterialSeed[] = [
${rows.join('\n')}
];

function decode(): GeoJSON.Feature<GeoJSON.LineString, ArterialProperties>[] {
  let prevLng = 0;
  let prevLat = 0;
  return SEEDS.map(([nameIndex, kindIndex, ...deltas]) => {
    const coordinates: GeoJSON.Position[] = [];
    for (let i = 0; i < deltas.length; i += 2) {
      prevLng += deltas[i];
      prevLat += deltas[i + 1];
      coordinates.push([prevLng / ${SCALE}, prevLat / ${SCALE}]);
    }
    return {
      type: 'Feature',
      properties: {name: NAMES[nameIndex], kind: KINDS[kindIndex]},
      geometry: {type: 'LineString', coordinates},
    };
  });
}

export const ARTERIALS: ArterialCollection = {
  type: 'FeatureCollection',
  features: decode(),
};
`;
}

const outPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/data/arterials.ts',
);

const ways = await fetchWays();
const features = toFeatures(ways);
const source = render(features);
await writeFile(outPath, source, 'utf8');

const kb = Buffer.byteLength(source, 'utf8') / 1024;
console.log(
  `Wrote ${features.length} features from ${ways.length} OSM ways ` +
    `to ${outPath} (${kb.toFixed(1)} KB, tolerance ${SIMPLIFY_TOLERANCE}).`,
);
if (kb >= 700) {
  console.error('WARNING: output exceeds the 700 KB budget.');
  process.exitCode = 1;
}
