/**
 * Shared Socrata SODA 2.1 client, used by every Chicago Data Portal and Cook
 * County dataset in this app.
 *
 * Docs: https://dev.socrata.com/docs/endpoints.html
 * SoQL: https://dev.socrata.com/docs/queries/
 * Paging: https://dev.socrata.com/docs/paging.html
 *
 * On the app token: a Socrata app token is not a secret — it is a public
 * throttling identifier that Socrata expects in client-side requests, and it
 * grants no access beyond what anonymous requests already have. It therefore
 * ships on-device rather than going through an Edge Function. Requests work
 * without one; they are just pooled into a stricter shared rate limit.
 */
import {env} from '../env';
import {fetchJson, type FetchJsonOptions} from '../http';

export const CHICAGO_DOMAIN = 'https://data.cityofchicago.org';
export const COOK_COUNTY_DOMAIN = 'https://datacatalog.cookcountyil.gov';

/** [west, south, east, north] — the same order as CHICAGO_BOUNDS. */
export type BBox = [number, number, number, number];

export type SocrataQuery = {
  /** Raw SoQL `$where`. Combined with AND if a bbox is also given. */
  where?: string;
  select?: string;
  order?: string;
  limit?: number;
  offset?: number;
  /** Free-text search across the whole row (`$q`). */
  q?: string;
};

export type SocrataRequest = SocrataQuery & {
  domain?: string;
  datasetId: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

/**
 * SoQL's `within_box` takes the north-west corner then the south-east corner,
 * as (lat, lon) pairs — not the [west, south, east, north] order used
 * everywhere else in this app. Getting this backwards silently returns zero
 * rows rather than erroring, so it lives in one place.
 */
export function withinBox(column: string, [west, south, east, north]: BBox): string {
  return `within_box(${column}, ${north}, ${west}, ${south}, ${east})`;
}

export function andWhere(...clauses: (string | undefined)[]): string | undefined {
  const present = clauses.filter((c): c is string => Boolean(c && c.trim()));
  if (present.length === 0) {
    return undefined;
  }
  return present.map(c => `(${c})`).join(' AND ');
}

export async function socrataQuery<T>({
  domain = CHICAGO_DOMAIN,
  datasetId,
  where,
  select,
  order,
  limit = 200,
  offset = 0,
  q,
  signal,
  timeoutMs,
}: SocrataRequest): Promise<T[]> {
  const token = env('SOCRATA_APP_TOKEN');
  const headers: FetchJsonOptions['headers'] = token
    ? {'X-App-Token': token}
    : undefined;

  return fetchJson<T[]>(`${domain}/resource/${datasetId}.json`, {
    query: {
      $where: where,
      $select: select,
      $order: order,
      $limit: limit,
      $offset: offset,
      $q: q,
    },
    headers,
    signal,
    timeoutMs,
  });
}

/**
 * Walks `$limit`/`$offset` until the dataset runs out or `maxRows` is reached.
 *
 * Socrata pages without a stable sort return rows in an arbitrary order, which
 * can duplicate or skip across pages, so an `$order` is forced when the caller
 * does not supply one. `:id` is a system column present on every dataset.
 */
export async function socrataQueryAll<T>(
  request: SocrataRequest & {pageSize?: number; maxRows?: number},
): Promise<T[]> {
  const {pageSize = 1000, maxRows = 50_000, order = ':id', ...rest} = request;
  const rows: T[] = [];

  for (let offset = 0; rows.length < maxRows; offset += pageSize) {
    const page = await socrataQuery<T>({
      ...rest,
      order,
      limit: Math.min(pageSize, maxRows - rows.length),
      offset,
    });

    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return rows;
}

/** Socrata's GeoJSON export, for the boundary datasets. */
export async function socrataGeoJson<P>(
  datasetId: string,
  options: {domain?: string; where?: string; limit?: number; signal?: AbortSignal} = {},
): Promise<GeoJSON.FeatureCollection<GeoJSON.Geometry, P>> {
  const {domain = CHICAGO_DOMAIN, where, limit = 500, signal} = options;

  return fetchJson<GeoJSON.FeatureCollection<GeoJSON.Geometry, P>>(
    `${domain}/resource/${datasetId}.geojson`,
    {query: {$where: where, $limit: limit}, signal, timeoutMs: 20_000},
  );
}
