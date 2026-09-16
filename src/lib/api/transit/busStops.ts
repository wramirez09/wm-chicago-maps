/**
 * CTA bus stops, for the visible viewport.
 *
 * Dataset: https://data.cityofchicago.org/d/qs84-j7wh
 *
 * Two quirks of this dataset, both verified against live rows:
 *
 * - `the_geom` is a GeoJSON point ({type, coordinates: [lon, lat]}), unlike
 *   the CTA 'L' stops dataset, whose `location` is {latitude, longitude}.
 *   Same portal, same agency, different shape.
 * - `systemstop` — the id Bus Tracker's `stpid` wants — is stored as a float
 *   string, "15189.0". Passed through raw, Bus Tracker finds no such stop and
 *   returns no predictions rather than an error, so it is normalised here.
 */
import {type BBox, socrataQuery, withinBox} from '../places/socrata';

export const CTA_BUS_STOPS_DATASET = 'qs84-j7wh';

export type CtaBusStopRow = {
  the_geom?: {type?: string; coordinates?: [number, number]};
  systemstop?: string;
  street?: string;
  cross_st?: string;
  dir?: string;
  pos?: string;
  routesstpg?: string;
  public_nam?: string;
};

export type BusStop = {
  stopId: string;
  name: string;
  direction: string;
  routes: string[];
  latitude: number;
  longitude: number;
};

export async function fetchBusStops(
  bbox: BBox,
  options: {limit?: number; signal?: AbortSignal} = {},
): Promise<BusStop[]> {
  const rows = await socrataQuery<CtaBusStopRow>({
    datasetId: CTA_BUS_STOPS_DATASET,
    where: withinBox('the_geom', bbox),
    limit: options.limit ?? 500,
    signal: options.signal,
  });

  return rows.map(toBusStop).filter((stop): stop is BusStop => stop !== null);
}

/** "15189.0" → "15189". Leaves an already-integer id untouched. */
export function normalizeStopId(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? String(parsed) : null;
}

function toBusStop(row: CtaBusStopRow): BusStop | null {
  const stopId = normalizeStopId(row.systemstop);
  const coordinates = row.the_geom?.coordinates;

  if (!stopId || !coordinates || coordinates.length < 2) {
    return null;
  }

  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }

  return {
    stopId,
    name: row.public_nam || [row.street, row.cross_st].filter(Boolean).join(' & '),
    direction: row.dir ?? '',
    routes: (row.routesstpg ?? '')
      .split(',')
      .map(route => route.trim())
      .filter(Boolean),
    latitude,
    longitude,
  };
}
