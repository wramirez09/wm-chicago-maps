import {
  communityAreaTitle,
  fetchWikipediaSummary,
} from '../neighborhoods/wikipedia';
import summary from '../__fixtures__/wikipediaSummary.json';
import {mockFetchOnce} from './testUtils';

describe('communityAreaTitle', () => {
  it('adds the Chicago qualifier and underscores the spaces', () => {
    expect(communityAreaTitle('Hyde Park')).toBe('Hyde_Park,_Chicago');
  });
});

describe('fetchWikipediaSummary', () => {
  it('maps the summary and always produces an attribution line', async () => {
    const {restore} = mockFetchOnce(summary);

    const result = await fetchWikipediaSummary('Hyde_Park,_Chicago');

    expect(result).not.toBeNull();
    expect(result!.extract.length).toBeGreaterThan(0);
    // The CC BY-SA licence requires attribution wherever the extract is shown.
    expect(result!.attribution).toMatch(/CC BY-SA/);
    restore();
  });

  it('sends a descriptive user agent, per the Wikimedia policy', async () => {
    const {calls, restore} = mockFetchOnce(summary);

    await fetchWikipediaSummary('Hyde_Park,_Chicago');

    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers['Api-User-Agent']).toContain('wm-chicago-maps');
    restore();
  });

  it('returns null for a disambiguation page', async () => {
    const {restore} = mockFetchOnce({type: 'disambiguation', extract: 'May refer to:'});
    await expect(fetchWikipediaSummary('Western')).resolves.toBeNull();
    restore();
  });

  it('encodes the separators in a title', async () => {
    const {calls, restore} = mockFetchOnce(summary);

    await fetchWikipediaSummary("O'Hare, Chicago");

    // The comma and space must be escaped. The apostrophe deliberately is not:
    // encodeURIComponent leaves ! ' ( ) * alone, and they are legal in a path
    // segment, so asserting on %27 here would be asserting a bug.
    expect(calls[0].url).toContain("O'Hare%2C%20Chicago");
    restore();
  });
});
