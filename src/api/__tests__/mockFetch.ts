/**
 * Replaces global fetch with a scripted sequence of responses and records the
 * requests. No test in src/api touches the network.
 */
export type ScriptedResponse = {
  status?: number;
  body?: unknown;
  /** Raw text instead of JSON, for non-JSON error pages. */
  raw?: string;
  headers?: Record<string, string>;
  /** Reject instead of responding, to simulate a network failure. */
  networkError?: boolean;
};

export type RecordedRequest = {url: string; init: RequestInit};

export function mockFetch(responses: ScriptedResponse[]) {
  const requests: RecordedRequest[] = [];
  const original = globalThis.fetch;
  let index = 0;

  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    requests.push({url: String(input), init});
    const next = responses[Math.min(index++, responses.length - 1)];
    if (next.networkError) {
      throw new TypeError('Network request failed');
    }
    const status = next.status ?? 200;
    const text = next.raw ?? (next.body === undefined ? '' : JSON.stringify(next.body));
    const headers = Object.fromEntries(
      Object.entries(next.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
    );
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: {get: (name: string) => headers[name.toLowerCase()] ?? null},
      text: async () => text,
    } as unknown as Response;
  }) as unknown as typeof fetch;

  return {
    requests,
    header: (i: number, name: string) =>
      (requests[i]?.init.headers as Record<string, string> | undefined)?.[name],
    restore: () => {
      globalThis.fetch = original;
    },
  };
}
