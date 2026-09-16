/**
 * Overpass POI pull for Chicago — a diff source against Overture/Socrata.
 *
 * Overpass QL: https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
 * Usage policy: https://operations.osmfoundation.org/policies/api/
 *
 * Rate limits are taken seriously here: the public instance is a donated
 * resource shared by everyone. The query is split by category so each request
 * stays small, there is a delay between them, and 429/504 responses back off
 * rather than hammering.
 *
 * Run: npm run ingest:overpass
 */
import {CHICAGO_BBOX, log, serviceClient, upsertInChunks} from './_shared';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'wm-chicago-maps-ingest/1.0';

/** Split so no single query returns a multi-hundred-megabyte payload. */
const CATEGORIES: {key: string; filter: string}[] = [
  {key: 'food', filter: '["amenity"~"^(restaurant|cafe|bar|pub|fast_food|ice_cream)$"]'},
  {key: 'retail', filter: '["shop"]'},
  {key: 'culture', filter: '["amenity"~"^(theatre|cinema|library|arts_centre)$"]'},
  {key: 'services', filter: '["amenity"~"^(pharmacy|bank|post_office|clinic)$"]'},
];

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {lat: number; lon: number};
  tags?: Record<string, string>;
};

async function overpass(query: string, attempt = 1): Promise<OverpassElement[]> {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: new URLSearchParams({data: query}),
  });

  // 429 = rate limited, 504 = the query timed out server-side. Both are worth
  // retrying slowly; anything else is a real error.
  if ((response.status === 429 || response.status === 504) && attempt <= 4) {
    const wait = attempt * 30_000;
    log(`Overpass ${response.status}; waiting ${wait / 1000}s (attempt ${attempt})`);
    await sleep(wait);
    return overpass(query, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`Overpass responded ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const body = (await response.json()) as {elements?: OverpassElement[]};
  return body.elements ?? [];
}

function buildQuery(filter: string): string {
  const [west, south, east, north] = CHICAGO_BBOX;
  const bbox = `${south},${west},${north},${east}`;

  // `nwr` covers nodes, ways and relations; `out center` gives one coordinate
  // per element regardless of geometry type.
  return `[out:json][timeout:180];nwr${filter}["name"](${bbox});out center tags;`;
}

async function main(): Promise<void> {
  const client = serviceClient();
  const elements: OverpassElement[] = [];

  for (const [index, category] of CATEGORIES.entries()) {
    log(`Fetching ${category.key} (${index + 1}/${CATEGORIES.length})`);
    elements.push(...(await overpass(buildQuery(category.filter))));

    // Courtesy gap between queries; the policy asks for no more than a couple
    // of concurrent slots and no tight looping.
    if (index < CATEGORIES.length - 1) {
      await sleep(5_000);
    }
  }

  const seen = new Set<string>();
  const rows = elements
    .map(element => {
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      const tags = element.tags ?? {};

      if (lat === undefined || lon === undefined || !tags.name) {
        return null;
      }

      const sourceId = `${element.type}/${element.id}`;
      if (seen.has(sourceId)) {
        return null;
      }
      seen.add(sourceId);

      return {
        source: 'osm',
        source_id: sourceId,
        name: tags.name,
        brand: tags.brand ?? null,
        categories: [tags.amenity, tags.shop, tags.cuisine].filter(Boolean),
        latitude: lat,
        longitude: lon,
        raw: tags,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  log(`Upserting ${rows.length} OSM POIs into places_raw`);

  await upsertInChunks(rows, 500, chunk =>
    client.from('places_raw').upsert(chunk, {onConflict: 'source,source_id'}),
  );

  log('Done.');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(error => {
  console.error('[ingest] FAILED:', error);
  process.exit(1);
});
