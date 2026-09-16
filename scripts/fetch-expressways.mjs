#!/usr/bin/env node
/**
 * Fetches Chicago-area expressways/highways from the OpenStreetMap Overpass API
 * and writes `src/data/expressways.ts`.
 *
 * Re-runnable: `node scripts/fetch-expressways.mjs`
 *
 * Data © OpenStreetMap contributors, ODbL.
 */
import {writeFileSync, mkdirSync, statSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(HERE, '..', 'src', 'data', 'expressways.ts');

const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const BBOX = {south: 41.62, west: -87.95, north: 42.05, east: -87.5};

// Douglas-Peucker tolerance in degrees. Raise this if the generated file grows
// past the ~400 KB bundle budget. (At 0.00005 the coordinate payload is only
// ~110 KB, so the emitted module fits comfortably given the compact seed form
// below — no need to simplify harder.)
const TOLERANCE = 0.00005;
const PRECISION = 5;

// `_link` ramps are deliberately excluded — too noisy at city zoom levels.
const QUERY = `[out:json][timeout:180];
way["highway"~"^(motorway|trunk)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
out geom;`;

/** Perpendicular distance from p to the segment a-b, in degrees. */
function perpDistance(p, a, b) {
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

/** Iterative Douglas-Peucker simplification. */
function simplify(points, tolerance) {
  if (points.length < 3) {
    return points.slice();
  }
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let maxDist = 0;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const dist = perpDistance(points[i], points[first], points[last]);
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const LOCAL_NAMES = [
  'Kennedy',
  'Dan Ryan',
  'Eisenhower',
  'Stevenson',
  'Edens',
  'Bishop Ford',
  'Chicago Skyway',
  'Tri-State',
  'Jane Addams',
];

function localNameFor(osmName) {
  const match = LOCAL_NAMES.find(candidate =>
    osmName.toLowerCase().includes(candidate.toLowerCase()),
  );
  return match ?? '';
}

async function fetchOverpass() {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'wm-chicago-maps/1.0 (expressway dataset build script)',
    },
    body: new URLSearchParams({data: QUERY}).toString(),
  });
  if (!response.ok) {
    throw new Error(`Overpass HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function toFeatures(elements) {
  const features = [];
  for (const element of elements) {
    if (element.type !== 'way' || !Array.isArray(element.geometry)) {
      continue;
    }
    const tags = element.tags ?? {};
    const kind = tags.highway;
    if (kind !== 'motorway' && kind !== 'trunk') {
      continue;
    }
    const ref = (tags.ref ?? '').split(';').join(' / ').trim();
    const name = (tags.name ?? '').trim() || ref;
    if (name === '' && ref === '') {
      continue;
    }
    const points = element.geometry
      .filter(pt => pt && typeof pt.lon === 'number' && typeof pt.lat === 'number')
      .map(pt => [pt.lon, pt.lat]);
    if (points.length < 2) {
      continue;
    }
    const coordinates = simplify(points, TOLERANCE).map(([lng, lat]) => [
      Number(lng.toFixed(PRECISION)),
      Number(lat.toFixed(PRECISION)),
    ]);
    if (coordinates.length < 2) {
      continue;
    }
    features.push({
      type: 'Feature',
      properties: {name, ref, kind, localName: localNameFor(tags.name ?? '')},
      geometry: {type: 'LineString', coordinates},
    });
  }
  return features;
}

/** Single-quoted JS string literal, to match the repo's code style. */
function jsString(value) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function render(features) {
  const today = new Date().toISOString().slice(0, 10);
  const body = features
    .map(feature => {
      const {name, ref, kind, localName} = feature.properties;
      const coords = feature.geometry.coordinates
        .map(([lng, lat]) => `[${lng}, ${lat}]`)
        .join(', ');
      return `  {name: ${jsString(name)}, ref: ${jsString(ref)}, kind: ${jsString(
        kind,
      )}, localName: ${jsString(localName)}, coordinates: [${coords}]},`;
    })
    .join('\n');

  return `// GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/fetch-expressways.mjs
//
// Source: OpenStreetMap via the Overpass API (motorway + trunk ways inside the
// Chicago bbox ${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}; \`_link\` ramps excluded).
// Geometry is Douglas-Peucker simplified at ${TOLERANCE} degrees and rounded to
// ${PRECISION} decimal places to keep the bundle small.
// © OpenStreetMap contributors, ODbL. Generated ${today}.

export type ExpresswayProperties = {
  name: string;
  ref: string;
  kind: 'motorway' | 'trunk';
  localName: string;
};

export type ExpresswayCollection = GeoJSON.FeatureCollection<
  GeoJSON.LineString,
  ExpresswayProperties
>;

type ExpresswaySeed = ExpresswayProperties & {coordinates: GeoJSON.Position[]};

const SEEDS: ExpresswaySeed[] = [
${body}
];

export const EXPRESSWAYS: ExpresswayCollection = {
  type: 'FeatureCollection',
  features: SEEDS.map(({coordinates, ...properties}) => ({
    type: 'Feature',
    properties,
    geometry: {type: 'LineString', coordinates},
  })),
};
`;
}

async function main() {
  process.stdout.write('Querying Overpass...\n');
  const data = await fetchOverpass();
  const elements = data.elements ?? [];
  process.stdout.write(`Received ${elements.length} elements.\n`);
  const features = toFeatures(elements);
  mkdirSync(dirname(OUT_PATH), {recursive: true});
  writeFileSync(OUT_PATH, render(features), 'utf8');
  const bytes = statSync(OUT_PATH).size;
  process.stdout.write(
    `Wrote ${features.length} features to ${OUT_PATH}\n` +
      `File size: ${bytes} bytes (${(bytes / 1024).toFixed(1)} KB)\n`,
  );
}

main().catch(error => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exit(1);
});
