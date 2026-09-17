/**
 * The one HTTP client for the app. Every request goes to API_URL.
 *
 * Responses are validated with the backend's own zod schemas (@wm/shared).
 * `schema.parse` throws on any mismatch, so if the backend's contract drifts
 * from the vendored copy, the app fails loudly at the boundary instead of
 * rendering undefined fields three components later.
 */
import {ErrorResponse, TokenPair} from '@wm/shared';
import type {z} from 'zod';

import {API_URL, REQUEST_TIMEOUT_MS} from './config';
import {clearTokens, getAccessToken, getRefreshToken, setTokens} from './tokens';

export class ApiError extends Error {
  /** HTTP status, or 0 when no response arrived (timeout, offline). */
  readonly statusCode: number;
  readonly url: string;

  constructor(statusCode: number, message: string, url: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.url = url;
  }

  get isNetworkError(): boolean {
    return this.statusCode === 0;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  /** Sent as If-None-Match. A 304 then resolves as `notModified`. */
  etag?: string;
  /** Skip the Authorization header, e.g. for the token refresh itself. */
  anonymous?: boolean;
};

export type RawResponse = {
  status: number;
  etag: string | undefined;
  /** Parsed JSON, or undefined for an empty body (204, 304). */
  json: unknown;
};

export function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return `${API_URL}${path}${qs ? `?${qs}` : ''}`;
}

/**
 * Sends a request and returns the raw outcome. Non-2xx responses (other than
 * 304) throw ApiError carrying the backend's statusCode and message.
 *
 * A 401 on an authenticated request refreshes the session once and retries
 * the request once. If the retry is also 401, or the refresh fails, the error
 * propagates: one retry, then it gives up.
 */
export async function apiFetch(path: string, options: RequestOptions = {}): Promise<RawResponse> {
  try {
    return await send(path, options);
  } catch (error) {
    const unauthorized = error instanceof ApiError && error.statusCode === 401;
    if (unauthorized && !options.anonymous && getRefreshToken() && (await refreshSession())) {
      return send(path, options);
    }
    throw error;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchanges the refresh token for a new pair. Resolves true on success.
 *
 * Single-flight, and it has to be: the backend ROTATES refresh tokens, revoking
 * the old one on use. If two requests hit 401 together and each refreshed, the
 * first would rotate the token and the second would present a revoked one,
 * fail, and sign the user out for no reason. Concurrent callers share one
 * refresh instead.
 */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function performRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  try {
    const {json} = await send('/v1/auth/refresh', {
      method: 'POST',
      body: {refreshToken},
      anonymous: true,
    });
    setTokens(TokenPair.parse(json));
    return true;
  } catch (error) {
    // A 4xx means the refresh token is revoked, expired or unknown: the
    // session is over, so drop it. A network failure or 5xx is transient;
    // keep the tokens so a later request can try again.
    if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
      clearTokens();
    }
    return false;
  }
}

/** One attempt, no refresh. */
async function send(path: string, options: RequestOptions): Promise<RawResponse> {
  const url = buildUrl(path, options.query);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onCallerAbort);

  const headers: Record<string, string> = {Accept: 'application/json'};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.etag) {
    headers['If-None-Match'] = options.etag;
  }
  const token = options.anonymous ? undefined : getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = (error as {name?: string})?.name === 'AbortError';
    throw new ApiError(
      0,
      aborted
        ? options.signal?.aborted
          ? 'Request cancelled'
          : `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
        : `Could not reach the API at ${API_URL}`,
      url,
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onCallerAbort);
  }

  const text = await response.text();
  let json: unknown;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new ApiError(response.status, `Response was not JSON (HTTP ${response.status})`, url);
    }
  }

  if (response.status === 304 || response.ok) {
    return {status: response.status, etag: response.headers.get('etag') ?? undefined, json};
  }

  // The backend's error shape is {statusCode, error, message}. Anything else
  // (a proxy's HTML page, a crash) still becomes an ApiError with the status.
  const parsed = ErrorResponse.safeParse(json);
  throw new ApiError(
    response.status,
    parsed.success ? parsed.data.message : `HTTP ${response.status}`,
    url,
  );
}

/** A request whose response body is validated against `schema`. */
export async function apiRequest<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  options: RequestOptions = {},
): Promise<z.output<S>> {
  const {json} = await apiFetch(path, options);
  return schema.parse(json);
}
