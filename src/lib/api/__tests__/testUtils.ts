/**
 * Test helpers for the API clients. Not a test suite itself — `jest.config.js`
 * restricts testMatch to `*.test.ts(x)` so this file is not collected.
 *
 * Every client test mocks `global.fetch` and replays a fixture. Nothing here
 * touches the network — a client test that hits a live API is a flaky test and
 * a rate-limit problem for whoever runs CI.
 */

export type MockResponse = {
  status?: number;
  body: unknown;
  /** Serve raw text instead of JSON, to exercise the parse failure path. */
  raw?: string;
};

export type FetchCall = {url: string; init: RequestInit | undefined};

/**
 * Installs a fetch mock that serves the given responses in order, and returns
 * the recorded calls so a test can assert on the URL that was built.
 */
export function mockFetchSequence(responses: MockResponse[]): {
  calls: FetchCall[];
  restore: () => void;
} {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;
  let index = 0;

  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({url: String(input), init});

    const response = responses[Math.min(index, responses.length - 1)];
    index++;

    const text = response.raw ?? JSON.stringify(response.body);
    const status = response.status ?? 200;

    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
      arrayBuffer: async () => toArrayBuffer(text),
      json: async () => JSON.parse(text),
    } as unknown as Response;
  }) as unknown as typeof fetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

/** Single-response convenience wrapper. */
export function mockFetchOnce(body: unknown, status = 200) {
  return mockFetchSequence([{body, status}]);
}

/**
 * Latin-1 only, which is all the fixtures need. Avoids depending on
 * `TextEncoder`, which is not in React Native's type environment.
 */
function toArrayBuffer(text: string): ArrayBuffer {
  const buffer = new ArrayBuffer(text.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < text.length; i++) {
    // eslint-disable-next-line no-bitwise -- masking to a byte is the point
    view[i] = text.charCodeAt(i) & 0xff;
  }
  return buffer;
}

/** The query string of a recorded call, as a plain object. */
export function queryOf(url: string): Record<string, string> {
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  return Object.fromEntries(new URLSearchParams(query));
}
