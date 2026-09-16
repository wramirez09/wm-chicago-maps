/**
 * Chicago Business Licenses.
 *
 * Dataset: https://data.cityofchicago.org/d/r5kz-chrr
 * SODA docs: https://dev.socrata.com/foundry/data.cityofchicago.org/r5kz-chrr
 *
 * Field names below were read off the live dataset, not guessed. Every value
 * Socrata returns is a string, including latitude/longitude and all dates.
 */
import {toCoordinates} from '../parse';
import {
  type BBox,
  andWhere,
  socrataQuery,
  socrataQueryAll,
  withinBox,
} from './socrata';

export const BUSINESS_LICENSES_DATASET = 'r5kz-chrr';

export type BusinessLicenseRow = {
  id: string;
  license_id?: string;
  account_number?: string;
  site_number?: string;
  legal_name?: string;
  doing_business_as_name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  ward?: string;
  precinct?: string;
  police_district?: string;
  community_area?: string;
  community_area_name?: string;
  neighborhood?: string;
  license_code?: string;
  license_description?: string;
  business_activity?: string;
  business_activity_id?: string;
  license_number?: string;
  application_type?: string;
  license_status?: string;
  license_start_date?: string;
  expiration_date?: string;
  date_issued?: string;
  latitude?: string;
  longitude?: string;
};

/** The row with its coordinates parsed, and rows lacking a location dropped. */
export type BusinessLicense = Omit<BusinessLicenseRow, 'latitude' | 'longitude'> & {
  latitude: number;
  longitude: number;
};

export type BusinessLicenseFilter = {
  bbox?: BBox;
  /** `AAI` is the general "Limited Business License"; see license_code. */
  licenseCode?: string;
  communityAreaName?: string;
  /** Free-text across the row — matches DBA and legal name. */
  search?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
};

/**
 * Currently-active licences only.
 *
 * `license_status = 'AAI'` is Socrata's code for an issued, active licence.
 * The expiration check is belt-and-braces: the status column is not always
 * updated the day a licence lapses.
 */
export async function fetchActiveBusinessLicenses(
  filter: BusinessLicenseFilter = {},
): Promise<BusinessLicense[]> {
  const rows = await socrataQuery<BusinessLicenseRow>({
    datasetId: BUSINESS_LICENSES_DATASET,
    where: activeWhere(filter),
    q: filter.search,
    order: 'license_start_date DESC',
    limit: filter.limit ?? 200,
    offset: filter.offset ?? 0,
    signal: filter.signal,
  });

  return rows.map(toBusinessLicense).filter((r): r is BusinessLicense => r !== null);
}

/** Every matching active licence, paged. For ingest, not for the UI. */
export async function fetchAllActiveBusinessLicenses(
  filter: Omit<BusinessLicenseFilter, 'limit' | 'offset'> & {maxRows?: number} = {},
): Promise<BusinessLicense[]> {
  const rows = await socrataQueryAll<BusinessLicenseRow>({
    datasetId: BUSINESS_LICENSES_DATASET,
    where: activeWhere(filter),
    q: filter.search,
    maxRows: filter.maxRows ?? 50_000,
    signal: filter.signal,
  });

  return rows.map(toBusinessLicense).filter((r): r is BusinessLicense => r !== null);
}

function activeWhere(filter: BusinessLicenseFilter): string | undefined {
  return andWhere(
    "license_status = 'AAI'",
    `expiration_date > '${new Date().toISOString().slice(0, 10)}'`,
    filter.bbox ? withinBox('location', filter.bbox) : undefined,
    filter.licenseCode ? `license_code = '${escapeLiteral(filter.licenseCode)}'` : undefined,
    filter.communityAreaName
      ? `upper(community_area_name) = upper('${escapeLiteral(filter.communityAreaName)}')`
      : undefined,
  );
}

/** SoQL string literals are single-quoted; a quote inside is doubled. */
function escapeLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function toBusinessLicense(row: BusinessLicenseRow): BusinessLicense | null {
  // Plenty of rows are licences without a mappable address, and Socrata sends
  // those as empty strings rather than omitting the field.
  const coordinates = toCoordinates(row.longitude, row.latitude);
  if (!coordinates) {
    return null;
  }

  const [longitude, latitude] = coordinates;
  return {...row, latitude, longitude};
}
