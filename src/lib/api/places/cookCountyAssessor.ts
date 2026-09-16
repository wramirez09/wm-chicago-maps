/**
 * Cook County Assessor — parcel lookup, used to work out whether a business
 * owns the building it operates from.
 *
 * Parcel Addresses: https://datacatalog.cookcountyil.gov/d/3723-97qp
 * Parcel Universe (current year): https://datacatalog.cookcountyil.gov/d/pabr-t5kh
 * SODA docs: https://dev.socrata.com/docs/endpoints.html
 *
 * A PIN (Property Index Number) is 14 digits, usually written with dashes
 * (17-09-123-045-0000). The datasets store it undashed.
 */
import {COOK_COUNTY_DOMAIN, socrataQuery} from './socrata';

export const PARCEL_ADDRESSES_DATASET = '3723-97qp';
export const PARCEL_UNIVERSE_DATASET = 'pabr-t5kh';

export type ParcelAddressRow = {
  pin?: string;
  pin10?: string;
  year?: string;
  prop_address_full?: string;
  prop_address_city_name?: string;
  prop_address_state?: string;
  prop_address_zipcode_1?: string;
  mail_address_name?: string;
  mail_address_full?: string;
  mail_address_city_name?: string;
  mail_address_state?: string;
  mail_address_zipcode_1?: string;
  owner_address_name?: string;
  owner_address_full?: string;
  owner_address_city_name?: string;
  owner_address_state?: string;
  owner_address_zipcode_1?: string;
};

export type ParcelClassRow = {
  pin?: string;
  pin10?: string;
  year?: string;
  class?: string;
  township_name?: string;
  nbhd_code?: string;
  tax_code?: string;
  zip_code?: string;
};

export type Parcel = ParcelAddressRow & {
  /**
   * True when the owner's mailing address matches the property address.
   *
   * This is a heuristic, not a legal determination: an owner who collects post
   * at the property reads as owner-occupied, and one who uses an accountant's
   * address does not, even though they own the building. Treat it as a signal
   * to show, never as a fact to assert.
   */
  likelyOwnerOccupied: boolean;
};

export function normalizePin(pin: string): string {
  return pin.replace(/\D/g, '');
}

export async function fetchParcelByPin(
  pin: string,
  options: {signal?: AbortSignal} = {},
): Promise<Parcel | null> {
  const rows = await socrataQuery<ParcelAddressRow>({
    domain: COOK_COUNTY_DOMAIN,
    datasetId: PARCEL_ADDRESSES_DATASET,
    where: `pin = '${normalizePin(pin)}'`,
    // The dataset holds one row per PIN per tax year; newest first.
    order: 'year DESC',
    limit: 1,
    signal: options.signal,
  });

  const row = rows[0];
  return row ? toParcel(row) : null;
}

/**
 * Address search. Socrata has no fuzzy matching, so this is an uppercased
 * prefix match on the full property address — "1060 W ADDISON" works,
 * "1060 West Addison St" may not.
 */
export async function fetchParcelsByAddress(
  address: string,
  options: {limit?: number; signal?: AbortSignal} = {},
): Promise<Parcel[]> {
  const needle = address.trim().toUpperCase().replace(/'/g, "''");

  const rows = await socrataQuery<ParcelAddressRow>({
    domain: COOK_COUNTY_DOMAIN,
    datasetId: PARCEL_ADDRESSES_DATASET,
    where: `starts_with(upper(prop_address_full), '${needle}')`,
    order: 'year DESC',
    limit: options.limit ?? 25,
    signal: options.signal,
  });

  return rows.map(toParcel);
}

/** Property class and township for a PIN, from the current-year universe. */
export async function fetchParcelClass(
  pin: string,
  options: {signal?: AbortSignal} = {},
): Promise<ParcelClassRow | null> {
  const rows = await socrataQuery<ParcelClassRow>({
    domain: COOK_COUNTY_DOMAIN,
    datasetId: PARCEL_UNIVERSE_DATASET,
    where: `pin = '${normalizePin(pin)}'`,
    order: 'year DESC',
    limit: 1,
    signal: options.signal,
  });

  return rows[0] ?? null;
}

function toParcel(row: ParcelAddressRow): Parcel {
  return {...row, likelyOwnerOccupied: sameAddress(row)};
}

function sameAddress(row: ParcelAddressRow): boolean {
  const property = canonical(row.prop_address_full);
  const mail = canonical(row.mail_address_full);
  return property.length > 0 && property === mail;
}

function canonical(value: string | undefined): string {
  return (value ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}
