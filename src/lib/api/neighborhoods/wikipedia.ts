/**
 * Wikipedia + Wikidata — a summary and lead image for each of the 77 community
 * areas.
 *
 * Page summary: https://en.wikipedia.org/api/rest_v1/#/Page%20content/get_page_summary__title_
 * Wikidata entities: https://www.wikidata.org/w/api.php?action=help&modules=wbgetentities
 *
 * Licensing: article text is CC BY-SA 4.0 and must be attributed with a link
 * back to the page. `attribution` on the result carries what has to be shown;
 * do not render `extract` without it.
 *
 * The Wikimedia REST API asks clients to send a descriptive User-Agent so they
 * can contact you about traffic: https://meta.wikimedia.org/wiki/User-Agent_policy
 */
import {fetchJson} from '../http';

const WIKIPEDIA_REST = 'https://en.wikipedia.org/api/rest_v1';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

const USER_AGENT = 'wm-chicago-maps/1.0 (https://github.com/; contact via repo issues)';

export type WikipediaSummaryResponse = {
  type?: string;
  title?: string;
  displaytitle?: string;
  pageid?: number;
  description?: string;
  extract?: string;
  extract_html?: string;
  thumbnail?: {source: string; width: number; height: number};
  originalimage?: {source: string; width: number; height: number};
  content_urls?: {desktop?: {page?: string}; mobile?: {page?: string}};
  wikibase_item?: string;
  timestamp?: string;
};

export type NeighborhoodSummary = {
  title: string;
  description: string | null;
  extract: string;
  imageUrl: string | null;
  pageUrl: string | null;
  wikidataId: string | null;
  /** Ready-to-render licence line. Show this wherever `extract` is shown. */
  attribution: string;
};

/**
 * Community-area names do not always match their article titles — "Lincoln
 * Park" needs the ", Chicago" qualifier, "The Loop" is "Chicago Loop". Callers
 * can pass an explicit title; otherwise the Chicago qualifier is added.
 */
export function communityAreaTitle(name: string): string {
  return `${name.trim().replace(/\s+/g, '_')},_Chicago`;
}

export async function fetchWikipediaSummary(
  title: string,
  options: {signal?: AbortSignal} = {},
): Promise<NeighborhoodSummary | null> {
  const response = await fetchJson<WikipediaSummaryResponse>(
    `${WIKIPEDIA_REST}/page/summary/${encodeURIComponent(title)}`,
    {headers: {'Api-User-Agent': USER_AGENT}, signal: options.signal},
  );

  // Disambiguation pages have no usable summary.
  if (!response.extract || response.type === 'disambiguation') {
    return null;
  }

  const pageUrl = response.content_urls?.desktop?.page ?? null;

  return {
    title: response.title ?? title,
    description: response.description ?? null,
    extract: response.extract,
    imageUrl: response.originalimage?.source ?? response.thumbnail?.source ?? null,
    pageUrl,
    wikidataId: response.wikibase_item ?? null,
    attribution: pageUrl
      ? `From Wikipedia (CC BY-SA 4.0): ${pageUrl}`
      : 'From Wikipedia, CC BY-SA 4.0',
  };
}

export type WikidataEntity = {
  id?: string;
  labels?: Record<string, {value?: string}>;
  descriptions?: Record<string, {value?: string}>;
  claims?: Record<string, {mainsnak?: {datavalue?: {value?: unknown}}}[]>;
};

export type WikidataClaimsResponse = {
  entities?: Record<string, WikidataEntity>;
};

/**
 * Structured facts for an entity — population (P1082), inception (P571), etc.
 * Returned raw because the useful claim differs per caller.
 */
export async function fetchWikidataEntity(
  entityId: string,
  options: {signal?: AbortSignal} = {},
): Promise<WikidataEntity | null> {
  const response = await fetchJson<WikidataClaimsResponse>(WIKIDATA_API, {
    query: {
      action: 'wbgetentities',
      ids: entityId,
      props: 'labels|descriptions|claims',
      languages: 'en',
      format: 'json',
      origin: '*',
    },
    headers: {'Api-User-Agent': USER_AGENT},
    signal: options.signal,
  });

  return response.entities?.[entityId] ?? null;
}
