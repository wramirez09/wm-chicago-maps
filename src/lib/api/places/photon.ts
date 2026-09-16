/**
 * Photon — geocoding and reverse geocoding against a self-hosted instance.
 *
 * Docs: https://github.com/komoot/photon#api
 *
 * Photon is OSM-backed and returns GeoJSON Features whose properties carry the
 * address parts. `bbox` biases *and* restricts results, which is what keeps a
 * search for "Western" inside Chicago instead of landing in Western Australia.
 */
import {requireEnv} from '../env';
import {fetchJson} from '../http';
import type {BBox} from './socrata';

/** Matches CHICAGO_BOUNDS in src/config/map.ts. */
export const CHICAGO_BBOX: BBox = [-87.94, 41.64, -87.52, 42.03];

export type PhotonProperties = {
  osm_id?: number;
  osm_type?: string;
  osm_key?: string;
  osm_value?: string;
  type?: string;
  name?: string;
  housenumber?: string;
  street?: string;
  postcode?: string;
  city?: string;
  district?: string;
  county?: string;
  state?: string;
  country?: string;
  countrycode?: string;
  extent?: [number, number, number, number];
};

export type PhotonFeature = GeoJSON.Feature<GeoJSON.Point, PhotonProperties>;

export type PhotonResponse = {
  type: 'FeatureCollection';
  features: PhotonFeature[];
};

export type GeocodeResult = {
  label: string;
  latitude: number;
  longitude: number;
  properties: PhotonProperties;
};

function baseUrl(): string {
  return requireEnv('PHOTON_URL').replace(/\/+$/, '');
}

export async function geocode(
  query: string,
  options: {limit?: number; bbox?: BBox; signal?: AbortSignal} = {},
): Promise<GeocodeResult[]> {
  const {limit = 10, bbox = CHICAGO_BBOX, signal} = options;

  if (query.trim().length < 2) {
    return [];
  }

  const response = await fetchJson<PhotonResponse>(`${baseUrl()}/api`, {
    query: {q: query, limit, bbox: bbox.join(','), lang: 'en'},
    signal,
  });

  return response.features.map(toResult);
}

export async function reverseGeocode(
  longitude: number,
  latitude: number,
  options: {limit?: number; signal?: AbortSignal} = {},
): Promise<GeocodeResult[]> {
  const response = await fetchJson<PhotonResponse>(`${baseUrl()}/reverse`, {
    query: {lon: longitude, lat: latitude, limit: options.limit ?? 1, lang: 'en'},
    signal: options.signal,
  });

  return response.features.map(toResult);
}

function toResult(feature: PhotonFeature): GeocodeResult {
  const [longitude, latitude] = feature.geometry.coordinates;
  return {label: label(feature.properties), latitude, longitude, properties: feature.properties};
}

/**
 * Photon has no single display-name field, so the label is assembled from the
 * parts. A POI keeps its name and drops the house number; a plain address
 * leads with the number.
 */
function label(p: PhotonProperties): string {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const head = p.name ?? street;
  const tail = [p.name ? street : undefined, p.city, p.state]
    .filter(Boolean)
    .join(', ');

  return [head, tail].filter(Boolean).join(', ');
}
