/**
 * CTA GTFS static → transit_stops.
 *
 * Feed: https://www.transitchicago.com/developers/gtfs/
 * GTFS reference: https://gtfs.org/documentation/schedule/reference/
 *
 * The feed is a ~70 MB zip. Rather than add a zip library, this shells out to
 * the `unzip` that ships with macOS and Linux, then parses the two CSVs it
 * needs. GTFS CSV is RFC 4180, so quoted fields containing commas are real and
 * a naive `split(',')` gets stop names wrong — hence the parser below.
 *
 * Run: npm run ingest:gtfs-cta
 */
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {log, serviceClient, upsertInChunks} from './_shared';

const FEED_URL = 'https://www.transitchicago.com/downloads/sch_data/google_transit.zip';
const CACHE_DIR = resolve(process.cwd(), '.cache/gtfs-cta');
const ZIP_PATH = resolve(CACHE_DIR, 'google_transit.zip');

/** RFC 4180 CSV: quoted fields, embedded commas, doubled quotes. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows;
  if (!header) {
    return [];
  }

  return body
    .filter(cells => cells.length === header.length)
    .map(cells =>
      Object.fromEntries(header.map((key, index) => [key.trim(), cells[index]])),
    );
}

function download(): void {
  mkdirSync(CACHE_DIR, {recursive: true});

  if (!existsSync(ZIP_PATH)) {
    log(`Downloading ${FEED_URL} (~70 MB)`);
    execFileSync('curl', ['-fSL', '-o', ZIP_PATH, FEED_URL], {stdio: 'inherit'});
  } else {
    log('Reusing cached feed (delete .cache/gtfs-cta to refetch)');
  }

  execFileSync('unzip', ['-o', '-q', ZIP_PATH, 'stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt', '-d', CACHE_DIR], {
    stdio: 'inherit',
  });
}

async function main(): Promise<void> {
  download();

  const client = serviceClient();
  const stops = parseCsv(readFileSync(resolve(CACHE_DIR, 'stops.txt'), 'utf8'));
  log(`Parsed ${stops.length} stops`);

  /**
   * Which routes serve each stop is not in stops.txt — it is only derivable
   * through trips.txt → stop_times.txt, which is the large file. Built as a
   * lookup once rather than per stop.
   */
  const trips = parseCsv(readFileSync(resolve(CACHE_DIR, 'trips.txt'), 'utf8'));
  const routeByTrip = new Map(trips.map(t => [t.trip_id, t.route_id]));

  const stopTimes = parseCsv(readFileSync(resolve(CACHE_DIR, 'stop_times.txt'), 'utf8'));
  const routesByStop = new Map<string, Set<string>>();

  for (const stopTime of stopTimes) {
    const routeId = routeByTrip.get(stopTime.trip_id);
    if (!routeId) {
      continue;
    }
    const existing = routesByStop.get(stopTime.stop_id);
    if (existing) {
      existing.add(routeId);
    } else {
      routesByStop.set(stopTime.stop_id, new Set([routeId]));
    }
  }

  const rows = stops
    .map(stop => {
      const latitude = Number(stop.stop_lat);
      const longitude = Number(stop.stop_lon);

      if (!stop.stop_id || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }

      return {
        agency: 'cta' as const,
        stop_id: stop.stop_id,
        stop_name: stop.stop_name ?? '',
        latitude,
        longitude,
        route_ids: [...(routesByStop.get(stop.stop_id) ?? [])].sort(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  log(`Upserting ${rows.length} CTA stops`);

  await upsertInChunks(rows, 500, chunk =>
    client.from('transit_stops').upsert(chunk, {onConflict: 'agency,stop_id'}),
  );

  log('Done.');
}

main().catch(error => {
  console.error('[ingest] FAILED:', error);
  process.exit(1);
});
