import {retryDelayMs, shouldRetry} from './retry';
import {CmsSettings, loadCmsSettings} from './settings';
import {tokenCacheKey} from './tokenKey';

/** A problem the UI can explain to the editor (bad config, CMS refused the call...). */
export class CmsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 502
  ) {
    super(message);
  }
}

interface CachedToken {
  token: string;
  expiresAt: number;
  cacheKey: string;
}

// CMS tokens live ~300 s. Cache per warm container to save a round trip on every call.
let cached: CachedToken | null = null;

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Client-credentials token from the CMS (SaaS) REST API:
 *   POST {base}/oauth/token  (Basic clientId:clientSecret, grant_type=client_credentials)
 */
export async function requestToken(settings: CmsSettings): Promise<{token: string; expiresIn: number}> {
  if (!settings.clientId || !settings.clientSecret) {
    throw new CmsError('not_configured', 'Add the CMS API Client ID and Secret in the app settings (OCP App Directory).', 503);
  }
  const basic = Buffer.from(`${settings.clientId}:${settings.clientSecret}`).toString('base64');
  const response = await fetch(`${settings.baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic}`,
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json'
    },
    body: new URLSearchParams({grant_type: 'client_credentials'}).toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new CmsError(
      response.status === 400 || response.status === 401 ? 'bad_credentials' : 'token_failed',
      `Token request returned HTTP ${response.status}: ${text.slice(0, 300)}`
    );
  }
  const json = JSON.parse(text) as Record<string, unknown>;
  const token = typeof json.access_token === 'string' ? json.access_token : '';
  if (!token) throw new CmsError('token_failed', 'Token response had no access_token.');
  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : 300;
  return {token, expiresIn};
}

async function getToken(settings: CmsSettings): Promise<string> {
  const cacheKey = tokenCacheKey(settings.baseUrl, settings.clientId, settings.clientSecret);
  if (cached && cached.cacheKey === cacheKey && cached.expiresAt - 30_000 > Date.now()) {
    return cached.token;
  }
  const {token, expiresIn} = await requestToken(settings);
  cached = {token, expiresAt: Date.now() + expiresIn * 1000, cacheKey};
  return token;
}

export interface CmsResponse<T> {
  status: number;
  body: T | null;
  text: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Calls the CMS REST API. Returns non-2xx responses instead of throwing, so callers decide. */
export async function cmsFetch<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<CmsResponse<T>> {
  const settings = await loadCmsSettings();
  let response: Response;
  for (let attempt = 0; ; attempt++) {
    const token = await getToken(settings);
    const headers: Record<string, string> = {authorization: `Bearer ${token}`, accept: 'application/json'};
    const init: RequestInit = {method, headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)};
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    response = await fetch(`${settings.baseUrl}${path}`, init);
    if (response.status === 401) cached = null; // force a fresh token next time
    // The CMS rate-limits (HTTP 429): retry with backoff, honouring Retry-After (see retry.ts).
    if (!shouldRetry(response.status, attempt)) break;
    await response.text().catch(() => ''); // drain before retrying
    await sleep(retryDelayMs(response.headers.get('retry-after'), attempt));
  }
  const text = await response.text();
  let parsed: T | null = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as T;
    } catch {
      parsed = null;
    }
  }
  return {status: response.status, body: parsed, text};
}

export async function cmsGet<T>(path: string): Promise<T> {
  const res = await cmsFetch<T>('GET', path);
  if (res.status === 429) {
    throw new CmsError('rate_limited', 'The CMS API is rate limiting requests. Wait a few seconds and try again.', 429);
  }
  if (res.status < 200 || res.status >= 300 || res.body === null) {
    throw new CmsError(
      res.status === 401 || res.status === 403 ? 'forbidden' : 'cms_request_failed',
      `GET ${path} returned HTTP ${res.status}: ${res.text.slice(0, 300)}`,
      res.status === 404 ? 404 : 502
    );
  }
  return res.body;
}

/** Runs `fn` over `items` with at most `limit` in flight. Keeps result order. */
export async function mapLimit<I, O>(items: I[], limit: number, fn: (item: I) => Promise<O>): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({length: Math.min(limit, items.length)}, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return out;
}
