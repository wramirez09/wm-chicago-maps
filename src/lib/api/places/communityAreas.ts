/**
 * Chicago community-area boundaries — the 77 official neighbourhoods.
 *
 * Dataset: https://data.cityofchicago.org/d/igwz-8jzy
 * GeoJSON export: https://dev.socrata.com/docs/formats/geojson.html
 *
 * The column is spelled `area_numbe` in the source data (sic) — a truncation
 * from the original shapefile, not a typo here.
 */
import {socrataGeoJson, socrataQuery} from './socrata';

export const COMMUNITY_AREAS_DATASET = 'igwz-8jzy';

export type CommunityAreaProperties = {
  community?: string;
  area_numbe?: string;
  area_num_1?: string;
  shape_area?: string;
  shape_len?: string;
};

export type CommunityAreaCollection = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  CommunityAreaProperties
>;

/** All 77 boundaries. Roughly 2 MB — cache it, don't refetch per screen. */
export async function fetchCommunityAreas(
  options: {signal?: AbortSignal} = {},
): Promise<CommunityAreaCollection> {
  return socrataGeoJson<CommunityAreaProperties>(COMMUNITY_AREAS_DATASET, {
    limit: 100,
    signal: options.signal,
  });
}

/** Names and numbers only — cheap enough for a picker or a filter list. */
export async function fetchCommunityAreaNames(
  options: {signal?: AbortSignal} = {},
): Promise<{number: string; name: string}[]> {
  const rows = await socrataQuery<CommunityAreaProperties>({
    datasetId: COMMUNITY_AREAS_DATASET,
    select: 'area_numbe, community',
    order: 'community',
    limit: 100,
    signal: options.signal,
  });

  return rows
    .filter(row => row.community && row.area_numbe)
    .map(row => ({number: row.area_numbe as string, name: row.community as string}));
}
