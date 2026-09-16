import {ApiError, buildUrl, fetchJson} from '../http';
import {mockFetchSequence} from './testUtils';

describe('buildUrl', () => {
  it('drops undefined, null and empty values', () => {
    const url = buildUrl('https://x.test/a', {
      keep: 'yes',
      zero: 0,
      nope: undefined,
      alsoNope: null,
      empty: '',
    });

    expect(url).toBe('https://x.test/a?keep=yes&zero=0');
  });

  it('appends with & when the base already has a query', () => {
    expect(buildUrl('https://x.test/a?one=1', {two: 2})).toBe(
      'https://x.test/a?one=1&two=2',
    );
  });
});

describe('fetchJson', () => {
  it('parses a JSON body', async () => {
    const {restore} = mockFetchSequence([{body: {ok: true}}]);
    await expect(fetchJson('https://x.test')).resolves.toEqual({ok: true});
    restore();
  });

  it('retries once on 5xx and succeeds on the second attempt', async () => {
    const {calls, restore} = mockFetchSequence([
      {status: 500, body: {error: 'boom'}},
      {status: 200, body: {ok: true}},
    ]);

    await expect(fetchJson('https://x.test')).resolves.toEqual({ok: true});
    expect(calls).toHaveLength(2);
    restore();
  });

  it('does not retry a 4xx', async () => {
    const {calls, restore} = mockFetchSequence([{status: 404, body: {}}]);

    await expect(fetchJson('https://x.test')).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(1);
    restore();
  });

  it('gives up after one retry and throws the last error', async () => {
    const {calls, restore} = mockFetchSequence([
      {status: 503, body: {}},
      {status: 503, body: {}},
    ]);

    await expect(fetchJson('https://x.test')).rejects.toMatchObject({status: 503});
    expect(calls).toHaveLength(2);
    restore();
  });

  it('reports a non-JSON body as an ApiError rather than throwing SyntaxError', async () => {
    const {restore} = mockFetchSequence([{status: 200, body: null, raw: '<html>nope</html>'}]);

    await expect(fetchJson('https://x.test')).rejects.toThrow(/was not JSON/);
    restore();
  });

  it('treats an empty body as undefined', async () => {
    const {restore} = mockFetchSequence([{status: 204, body: null, raw: ''}]);
    await expect(fetchJson('https://x.test')).resolves.toBeUndefined();
    restore();
  });

  it('honours retry: false', async () => {
    const {calls, restore} = mockFetchSequence([{status: 500, body: {}}]);

    await expect(fetchJson('https://x.test', {retry: false})).rejects.toMatchObject({
      status: 500,
    });
    expect(calls).toHaveLength(1);
    restore();
  });
});
