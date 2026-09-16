#!/usr/bin/env node
/**
 * Regenerates src/data/transit.ts from live OpenStreetMap data.
 *
 * Usage: node scripts/fetch-transit.mjs
 *
 * Data © OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright).
 */
import { writeFileSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = resolve(ROOT, 'src/data/transit.ts');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'wm-chicago-maps/1.0 (transit dataset generator)';

// Chicago bounding box: south, west, north, east.
const BBOX = [41.62, -87.95, 42.05, -87.5];

/** Official CTA line colours; preferred over OSM's `colour` tag. */
const LINE_COLORS = {
  Red: '#c60c30',
  Blue: '#00a1de',
  Brown: '#62361b',
  Green: '#009b3a',
  Orange: '#f9461c',
  Pink: '#e27ea6',
  Purple: '#522398',
  Yellow: '#f9e300',
};
const LINE_ORDER = Object.keys(LINE_COLORS);

const COORD_PRECISION = 5;
const SIMPLIFY_TOLERANCE = 0.00005; // degrees
const STATION_SNAP_METERS = 120; // how close a line must pass to serve a station
const MAX_BYTES = 300 * 1024;

const ROUTE_QUERY = `[out:json][timeout:180];
(
  relation["type"="route"]["route"~"^(subway|light_rail)$"]["operator"~"CTA|Chicago Transit",i](${BBOX});
  relation["type"="route"]["route"~"^(subway|light_rail)$"]["network"~"CTA|Chicago Transit",i](${BBOX});
)->.r;
.r out body geom;`;

const STATION_QUERY = `[out:json][timeout:180];
(
  node["railway"="station"]["station"="subway"](${BBOX});
  way["railway"="station"]["station"="subway"](${BBOX});
);
out center tags;`;

async function overpass(query, label) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    process.stdout.write(`Fetching ${label} (attempt ${attempt})... `);
    try {
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ data: query }).toString(),
      });
      const text = await res.text();
      if (res.ok && text.trimStart().startsWith('{')) {
        const json = JSON.parse(text);
        console.log(`ok (${json.elements.length} elements)`);
        return json.elements;
      }
      console.log(`failed (HTTP ${res.status})`);
    } catch (err) {
      console.log(`failed (${err.message})`);
    }
    await new Promise(r => setTimeout(r, 15000 * attempt));
  }
  throw new Error(`Overpass request for ${label} failed after 5 attempts`);
}

/** Maps a route relation's name/colour onto one of the eight CTA line names. */
function lineNameFor(tags = {}) {
  const haystack = [tags.name, tags.ref, tags.colour, tags.color]
    .filter(Boolean)
    .join(' ');
  for (const name of LINE_ORDER) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(haystack)) {
      return name;
    }
    if (haystack.toLowerCase().includes(LINE_COLORS[name])) {
      return name;
    }
  }
  return null;
}

const round = n => Number(n.toFixed(COORD_PRECISION));

/** Perpendicular distance from `p` to the segment `a`–`b`, in degrees. */
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
  let maxDist = 0;
  let index = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[last]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }
  if (maxDist <= tolerance) {
    return [points[0], points[last]];
  }
  return [
    ...simplify(points.slice(0, index + 1), tolerance),
    ...simplify(points.slice(index), tolerance).slice(1),
  ];
}

function dedupeConsecutive(points) {
  return points.filter(
    (p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1],
  );
}

const METERS_PER_DEG_LAT = 111320;

/**
 * Distance in metres from `point` to the segment `a`-`b`, using a local
 * equirectangular projection centred on `point` (fine at city scale).
 */
function metersToSegment(point, a, b) {
  const scale = Math.cos((point[1] * Math.PI) / 180) * METERS_PER_DEG_LAT;
  const px = (a[0] - point[0]) * scale;
  const py = (a[1] - point[1]) * METERS_PER_DEG_LAT;
  const qx = (b[0] - point[0]) * scale;
  const qy = (b[1] - point[1]) * METERS_PER_DEG_LAT;
  const dx = qx - px;
  const dy = qy - py;
  if (dx === 0 && dy === 0) {
    return Math.hypot(px, py);
  }
  const t = Math.max(
    0,
    Math.min(1, -(px * dx + py * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(px + t * dx, py + t * dy);
}

function buildLines(relations, tolerance) {
  const seen = new Set();
  const features = [];
  for (const relation of relations) {
    const line = lineNameFor(relation.tags);
    if (!line || !relation.members) {
      continue;
    }
    for (const member of relation.members) {
      // Role '' is the running rail; platform/stop members are not the route path.
      if (member.type !== 'way' || member.role !== '' || !member.geometry) {
        continue;
      }
      const key = `${member.ref}:${line}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const raw = dedupeConsecutive(
        member.geometry
          .filter(Boolean)
          .map(pt => [round(pt.lon), round(pt.lat)]),
      );
      if (raw.length < 2) {
        continue;
      }
      features.push({
        type: 'Feature',
        properties: { line, color: LINE_COLORS[line] },
        geometry: {
          type: 'LineString',
          coordinates: dedupeConsecutive(simplify(raw, tolerance)),
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

function buildStations(stationElements, lineFeatures) {
  const seen = new Set();
  const features = [];
  for (const element of stationElements) {
    const tags = element.tags ?? {};
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (lat === undefined || lon === undefined) {
      continue;
    }
    const name = tags.name ?? tags['name:en'] ?? '';
    if (!name) {
      continue;
    }
    const coordinates = [round(lon), round(lat)];
    const key = `${name}@${lat.toFixed(3)},${lon.toFixed(3)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const lines = new Set();
    for (const feature of lineFeatures) {
      if (lines.has(feature.properties.line)) {
        continue;
      }
      const path = feature.geometry.coordinates;
      for (let i = 1; i < path.length; i++) {
        if (
          metersToSegment(coordinates, path[i - 1], path[i]) <=
          STATION_SNAP_METERS
        ) {
          lines.add(feature.properties.line);
          break;
        }
      }
    }
    features.push({
      type: 'Feature',
      properties: {
        name,
        lines: LINE_ORDER.filter(l => lines.has(l)).join(', '),
      },
      geometry: { type: 'Point', coordinates },
    });
  }
  features.sort((a, b) => a.properties.name.localeCompare(b.properties.name));
  return { type: 'FeatureCollection', features };
}

function renderModule(lines, stations) {
  const today = new Date().toISOString().slice(0, 10);
  const quote = value =>
    `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const props = properties =>
    `{${Object.entries(properties)
      .map(([key, value]) => `${key}: ${quote(value)}`)
      .join(', ')}}`;
  const feature = f =>
    `  {\n    type: 'Feature',\n    properties: ${props(
      f.properties,
    )},\n    geometry: {type: '${
      f.geometry.type
    }', coordinates: ${JSON.stringify(f.geometry.coordinates)}},\n  },`;
  return `// Generated by scripts/fetch-transit.mjs — do not edit by hand.
// CTA 'L' rapid transit network, derived from OpenStreetMap.
// Data © OpenStreetMap contributors, ODbL. Generated ${today}.

export type TransitLineProperties = {
  line: string;
  color: string;
};

export type TransitStationProperties = {
  name: string;
  lines: string;
};

export type TransitLineCollection = GeoJSON.FeatureCollection<
  GeoJSON.LineString,
  TransitLineProperties
>;

export type TransitStationCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  TransitStationProperties
>;

export const TRANSIT_LINES: TransitLineCollection = {
  type: 'FeatureCollection',
  features: [
${lines.features.map(feature).join('\n')}
  ],
};

export const TRANSIT_STATIONS: TransitStationCollection = {
  type: 'FeatureCollection',
  features: [
${stations.features.map(feature).join('\n')}
  ],
};
`;
}

async function main() {
  const relations = await overpass(ROUTE_QUERY, 'CTA route relations');
  const stationElements = await overpass(STATION_QUERY, 'CTA stations');

  const named = relations.filter(r => lineNameFor(r.tags));
  console.log(`Matched ${named.length}/${relations.length} route relations.`);

  let tolerance = SIMPLIFY_TOLERANCE;
  let lines = buildLines(relations, tolerance);
  let stations = buildStations(stationElements, lines.features);
  let source = renderModule(lines, stations);

  // Keep the generated module comfortably small; coarsen geometry if needed.
  while (Buffer.byteLength(source) > MAX_BYTES && tolerance < 0.01) {
    tolerance *= 2;
    console.log(
      `Output too large (${Buffer.byteLength(
        source,
      )} bytes); retrying at tolerance ${tolerance}.`,
    );
    lines = buildLines(relations, tolerance);
    source = renderModule(lines, stations);
  }

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, source);

  const byLine = {};
  for (const f of lines.features) {
    byLine[f.properties.line] = (byLine[f.properties.line] ?? 0) + 1;
  }
  console.log('\nWrote src/data/transit.ts');
  console.log(`  simplify tolerance: ${tolerance}`);
  console.log(`  line features:      ${lines.features.length}`);
  for (const name of LINE_ORDER) {
    console.log(`    ${name.padEnd(7)} ${byLine[name] ?? 0}`);
  }
  console.log(`  station features:   ${stations.features.length}`);
  console.log(
    `  file size:          ${statSync(OUT_FILE).size} bytes (${(
      statSync(OUT_FILE).size / 1024
    ).toFixed(1)} KB)`,
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
