/**
 * The single HTTP entry point for every API client in `src/lib/api`.
 *
 * Clients never call `fetch` directly: timeout, retry and error shape have to
 * be the same everywhere or the TanStack Query hooks on top of them can't
 * reason about failures consistently.
 */

/** Requests give up after this unless the caller says otherwise. */
const DEFAULT_TIMEOUT_MS = 10_000;

/** One retry only, and only for faults that a retry can plausibly fix. */
const RETRY_DELAY_MS = 600;

export class ApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly body: string;

  constructor(message: string, options: {status: number; url: string; body?: string}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.url = options.url;
    this.body = options.body ?? '';
  }

  /** 0 means the request never got a response: timeout, DNS, offline. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isTimeout(): boolean {
    return this.status === 0 && this.message.includes('timed out');
  }
}

export type FetchJsonOptions = {
  method?: 'GET' | 'POST';
  /** Appended to the URL. `undefined` and `null` values are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  /** Opt out of the retry for non-idempotent calls. */
  retry?: boolean;
  signal?: AbortSignal;
};

export function buildUrl(
  base: string,
  query?: FetchJsonOptions['query'],
): string {
  if (!query) {
    return base;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  }

  const qs = params.toString();
  if (!qs) {
    return base;
  }
  return base.includes('?') ? `${base}&${qs}` : `${base}?${qs}`;
}

/**
 * GET/POST JSON with a timeout, one retry on 5xx or network failure, and a
 * typed error. The response is cast to `T` — these are external APIs, so the
 * type is a claim about the contract, not a runtime guarantee.
 */
export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  const {
    method = 'GET',
    query,
    headers = {},
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retry = true,
    signal,
  } = options;

  const target = buildUrl(url, query);

  let lastError: ApiError | undefined;
  const attempts = retry ? 2 : 1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      await delay(RETRY_DELAY_MS);
    }

    try {
      return await once<T>(target, {method, headers, body, timeoutMs, signal});
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError(errorMessage(error), {status: 0, url: target});

      // A 4xx is the caller's fault and will fail identically next time; an
      // abort was deliberate. Neither is worth a second round trip.
      if (!isRetryable(apiError) || signal?.aborted) {
        throw apiError;
      }
      lastError = apiError;
    }
  }

  throw lastError ?? new ApiError('Request failed', {status: 0, url: target});
}

function isRetryable(error: ApiError): boolean {
  return error.status === 0 || error.status >= 500;
}

async function once<T>(
  url: string,
  options: {
    method: string;
    headers: Record<string, string>;
    body: unknown;
    timeoutMs: number;
    signal?: AbortSignal;
  },
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  // Honour a caller's cancellation as well as our own timeout.
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);

  const headers: Record<string, string> = {Accept: 'application/json', ...options.headers};
  let payload: string | undefined;

  if (options.body !== undefined) {
    payload = JSON.stringify(options.body);
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  try {
    const response = await fetch(url, {
      method: options.method,
      headers,
      body: payload,
      signal: controller.signal,
    });

    const text = await response.text();

    if (!response.ok) {
      throw new ApiError(`HTTP ${response.status} for ${url}`, {
        status: response.status,
        url,
        body: text.slice(0, 500),
      });
    }

    // A 204, or an endpoint that answers with an empty body on success.
    if (!text) {
      return undefined as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError(`Response was not JSON: ${text.slice(0, 120)}`, {
        status: response.status,
        url,
        body: text.slice(0, 500),
      });
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (isAbort(error)) {
      throw new ApiError(
        options.signal?.aborted
          ? `Request cancelled: ${url}`
          : `Request timed out after ${options.timeoutMs}ms: ${url}`,
        {status: 0, url},
      );
    }
    throw new ApiError(errorMessage(error), {status: 0, url});
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as {name?: string}).name === 'AbortError'
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
