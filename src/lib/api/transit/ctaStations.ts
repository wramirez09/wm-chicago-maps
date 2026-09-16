/**
 * CTA 'L' stops — the bridge from a map station to Train Tracker's `mapid`.
 *
 * Dataset: https://data.cityofchicago.org/d/8pix-ypme
 *
 * The station layer on the map comes from OpenStreetMap, which does not carry
 * CTA's identifiers, and Train Tracker only accepts a `mapid`. This dataset is
 * CTA's own stop list with `map_id` and a point location, so a tapped station
 * resolves to its mapid by nearest point. Names alone would not work: there
 * are four stations called "Western" and three called "Damen".
 *
 * One row per platform direction, so a station appears several times with the
 * same map_id; they are collapsed here.
 */
import {socrataQuery} from '../places/socrata';

export const CTA_L_STOPS_DATASET = '8pix-ypme';

export type CtaLStopRow = {
  stop_id?: string;
  station_name?: string;
  station_descriptive_name?: string;
  map_id?: string;
  location?: {latitude?: string; longitude?: string};
};

export type CtaStation = {
  mapId: string;
  name: string;
  descriptiveName: string;
  latitude: number;
  longitude: number;
};

/**
 * Stations farther than this from the tap are not considered a match. 250 m
 * covers an OSM node placed at the station entrance rather than the platform,
 * without letting a tap near one station resolve to its neighbour (downtown
 * 'L' stations are ~400 m apart).
 */
const MAX_MATCH_METERS = 250;

export async function fetchCtaStations(
  options: {signal?: AbortSignal} = {},
): Promise<CtaStation[]> {
  const rows = await socrataQuery<CtaLStopRow>({
    datasetId: CTA_L_STOPS_DATASET,
    select: 'map_id, station_name, station_descriptive_name, location',
    limit: 1000,
    signal: options.signal,
  });

  const byMapId = new Map<string, CtaStation>();

  for (const row of rows) {
    const latitude = Number(row.location?.latitude);
    const longitude = Number(row.location?.longitude);

    if (!row.map_id || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }
    if (byMapId.has(row.map_id)) {
      continue;
    }

    byMapId.set(row.map_id, {
      mapId: row.map_id,
      name: row.station_name ?? '',
      descriptiveName: row.station_descriptive_name ?? row.station_name ?? '',
      latitude,
      longitude,
    });
  }

  return [...byMapId.values()];
}

/** The station nearest a point, or null if none is within MAX_MATCH_METERS. */
export function nearestStation(
  stations: CtaStation[],
  [longitude, latitude]: [number, number],
): CtaStation | null {
  let best: CtaStation | null = null;
  let bestMeters = Infinity;

  for (const station of stations) {
    const meters = distanceMeters(latitude, longitude, station.latitude, station.longitude);
    if (meters < bestMeters) {
      bestMeters = meters;
      best = station;
    }
  }

  return bestMeters <= MAX_MATCH_METERS ? best : null;
}

/** Haversine. Accurate to well under a metre at city scale. */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
