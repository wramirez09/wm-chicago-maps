/**
 * Chicago Business Owners — the people behind a licence account.
 *
 * Dataset: https://data.cityofchicago.org/d/ezma-pppn
 * SODA docs: https://dev.socrata.com/foundry/data.cityofchicago.org/ezma-pppn
 *
 * Joins to Business Licenses on `account_number`. One account has one row per
 * owner, so a partnership returns several rows.
 */
import {socrataQuery} from './socrata';

export const BUSINESS_OWNERS_DATASET = 'ezma-pppn';

export type BusinessOwnerRow = {
  account_number?: string;
  doing_business_as_name?: string;
  owner_first_name?: string;
  owner_middle_initial?: string;
  owner_last_name?: string;
  owner_title?: string;
};

export type BusinessOwner = BusinessOwnerRow & {
  /** First + middle + last, collapsed; '' when the row names nobody. */
  fullName: string;
};

export async function fetchBusinessOwners(
  accountNumber: string,
  options: {signal?: AbortSignal} = {},
): Promise<BusinessOwner[]> {
  const rows = await socrataQuery<BusinessOwnerRow>({
    datasetId: BUSINESS_OWNERS_DATASET,
    where: `account_number = '${accountNumber.replace(/'/g, "''")}'`,
    limit: 100,
    signal: options.signal,
  });

  return rows.map(row => ({...row, fullName: fullName(row)}));
}

function fullName(row: BusinessOwnerRow): string {
  return [row.owner_first_name, row.owner_middle_initial, row.owner_last_name]
    .map(part => part?.trim())
    .filter(Boolean)
    .join(' ');
}
