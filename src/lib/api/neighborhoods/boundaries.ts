/**
 * Chicago boundary datasets — wards, parks, landmarks, ZIP codes.
 *
 * Wards (2023-):   https://data.cityofchicago.org/d/p293-wvbd
 * Parks:           https://data.cityofchicago.org/d/ejsh-fztr
 * Landmarks:       https://data.cityofchicago.org/d/uct4-hrvh
 * ZIP codes:       https://data.cityofchicago.org/d/unjd-c2ca
 *
 * All four are served through the shared Socrata client. Dataset ids were
 * checked against the live portal — note the landmarks dataset that most
 * older code references (`tdab-kixi`) was deprecated in January 2024, and
 * `uct4-hrvh` replaces it.
 */
import {socrataGeoJson, socrataQuery} from '../places/socrata';

export const WARDS_DATASET = 'p293-wvbd';
export const PARKS_DATASET = 'ejsh-fztr';
export const LANDMARKS_DATASET = 'uct4-hrvh';
export const ZIP_CODES_DATASET = 'unjd-c2ca';

export type WardProperties = {ward?: string; ward_id?: string; objectid?: string};

export type ParkProperties = {
  park?: string;
  park_no?: string;
  park_class?: string;
  acres?: string;
  ward?: string;
  zip?: string;
  location?: string;
};

export type LandmarkRow = {
  id?: string;
  name?: string;
  address?: string;
  date_built?: string;
  architect?: string;
  landmark?: string;
  valid_date?: string;
};

export type ZipProperties = {zip?: string; objectid?: string; shape_area?: string};

export function fetchWardBoundaries(options: {signal?: AbortSignal} = {}) {
  return socrataGeoJson<WardProperties>(WARDS_DATASET, {limit: 60, ...options});
}

export function fetchParkBoundaries(options: {signal?: AbortSignal} = {}) {
  return socrataGeoJson<ParkProperties>(PARKS_DATASET, {limit: 700, ...options});
}

export function fetchZipBoundaries(options: {signal?: AbortSignal} = {}) {
  return socrataGeoJson<ZipProperties>(ZIP_CODES_DATASET, {limit: 100, ...options});
}

/**
 * Individual landmarks. The dataset carries `the_geom` but is more useful as
 * rows than as a FeatureCollection, since the interesting fields (architect,
 * date built) are attributes rather than geometry.
 */
export function fetchLandmarks(options: {limit?: number; signal?: AbortSignal} = {}) {
  return socrataQuery<LandmarkRow>({
    datasetId: LANDMARKS_DATASET,
    select: 'id, name, address, date_built, architect, landmark, valid_date',
    order: 'name',
    limit: options.limit ?? 500,
    signal: options.signal,
  });
}
