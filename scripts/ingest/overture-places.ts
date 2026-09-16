/**
 * Overture Maps Places → places_raw.
 *
 * Docs: https://docs.overturemaps.org/getting-data/
 * Places schema: https://docs.overturemaps.org/schema/reference/places/place/
 *
 * Overture is not an API. It is a set of GeoParquet files on S3/Azure, and the
 * supported way to pull a bbox extract is the `overturemaps` CLI (Python) or
 * DuckDB with the spatial + httpfs extensions. Reimplementing a GeoParquet
 * reader in Node to avoid that would be a bad trade, so this script shells out
 * to whichever tool is available and ingests the GeoJSON it produces.
 *
 * Prerequisite, one of:
 *     pipx install overturemaps          # recommended
 *     brew install duckdb                # then the DuckDB path below
 *
 * Run: npm run ingest:overture
 *
 * Independence heuristic: Overture carries a `brands` field populated for
 * chains. A null brand is treated as a *candidate* independent business, not a
 * confirmed one — absence of a brand record is weak evidence, so the flag is
 * named accordingly and left for a human or a later pass to confirm.
 */
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

import {CHICAGO_BBOX, log, serviceClient, upsertInChunks} from './_shared';

const OUT_DIR = resolve(process.cwd(), '.cache/overture');
const OUT_FILE = resolve(OUT_DIR, 'chicago-places.geojson');

type OverturePlace = {
  type: 'Feature';
  geometry: {type: 'Point'; coordinates: [number, number]};
  properties: {
    id?: string;
    names?: {primary?: string};
    categories?: {primary?: string; alternate?: string[]};
    brand?: {names?: {primary?: string}};
    confidence?: number;
    addresses?: {
      freeform?: string;
      locality?: string;
      region?: string;
      postcode?: string;
    }[];
  };
};

function download(): void {
  if (existsSync(OUT_FILE)) {
    log(`Reusing cached extract at ${OUT_FILE} (delete it to refetch)`);
    return;
  }

  mkdirSync(OUT_DIR, {recursive: true});
  const [west, south, east, north] = CHICAGO_BBOX;

  log('Downloading Overture places for the Chicago bbox — this takes minutes');

  try {
    execFileSync(
      'overturemaps',
      [
        'download',
        '--bbox', `${west},${south},${east},${north}`,
        '-f', 'geojson',
        '--type', 'place',
        '-o', OUT_FILE,
      ],
      {stdio: 'inherit'},
    );
  } catch (error) {
    throw new Error(
      'The `overturemaps` CLI is required to download the extract and either ' +
        'is not installed or failed.\n' +
        '  pipx install overturemaps\n' +
        'Alternatively, produce the same GeoJSON with DuckDB:\n' +
        "  INSTALL spatial; INSTALL httpfs; LOAD spatial; LOAD httpfs;\n" +
        "  COPY (SELECT * FROM read_parquet('s3://overturemaps-us-west-2/release/<RELEASE>/theme=places/*/*', hive_partitioning=1)\n" +
        `         WHERE bbox.xmin > ${west} AND bbox.xmax < ${east} AND bbox.ymin > ${south} AND bbox.ymax < ${north})\n` +
        `  TO '${OUT_FILE}' WITH (FORMAT GDAL, DRIVER 'GeoJSON');\n` +
        `Original error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function main(): Promise<void> {
  download();

  const client = serviceClient();
  const contents = readFileSync(OUT_FILE, 'utf8');

  // `overturemaps -f geojson` emits a FeatureCollection; some versions emit
  // newline-delimited features instead. Both are handled.
  const features: OverturePlace[] = contents.trimStart().startsWith('{"type":"FeatureCollection"')
    ? (JSON.parse(contents).features as OverturePlace[])
    : contents
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as OverturePlace);

  log(`Parsed ${features.length} Overture places`);

  const rows = features
    .map(feature => {
      const {properties, geometry} = feature;
      const name = properties.names?.primary;
      const id = properties.id;

      if (!name || !id || geometry?.type !== 'Point') {
        return null;
      }

      const brand = properties.brand?.names?.primary ?? null;
      const [longitude, latitude] = geometry.coordinates;

      return {
        source: 'overture',
        source_id: id,
        name,
        brand,
        categories: [
          properties.categories?.primary,
          ...(properties.categories?.alternate ?? []),
        ].filter(Boolean),
        latitude,
        longitude,
        raw: {
          ...properties,
          // Recorded rather than asserted: a missing brand is weak evidence of
          // independence, not proof of it.
          independent_candidate: brand === null,
        },
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const candidates = rows.filter(r => r.brand === null).length;
  log(`${rows.length} usable rows — ${candidates} independent candidates, ${rows.length - candidates} branded`);

  await upsertInChunks(rows, 500, chunk =>
    client.from('places_raw').upsert(chunk, {onConflict: 'source,source_id'}),
  );

  log('Done.');
}

main().catch(error => {
  console.error('[ingest] FAILED:', error);
  process.exit(1);
});
