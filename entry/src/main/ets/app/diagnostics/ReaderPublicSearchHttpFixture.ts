import type { JsonObject } from '@reader/core-harmony';

export type ReaderPublicSearchHttpFixture = 'delayed' | 'http-503' | 'http-503-body' | 'vm-journeys';

export const READER_PUBLIC_SEARCH_DELAYED_URL = 'https://httpbingo.org/delay/5';
export const READER_PUBLIC_SEARCH_HTTP_503_URL = 'https://httpbingo.org/status/503';
export const READER_PUBLIC_SEARCH_HTTP_503_BODY_URL =
  'https://httpbingo.org/drip?code=503&numbytes=1&duration=0s&delay=0s';

/** Maps fixed cold-start storage scopes to their exact request policy. */
export function readerPublicSearchHttpFixtureMode(id?: string): ReaderPublicSearchHttpFixture | undefined {
  if (id === 'vm-journeys') return 'vm-journeys';
  if (id === 'search-delayed') return 'delayed';
  if (id === 'search-http-503') return 'http-503';
  if (id === 'search-http-503-body') return 'http-503-body';
  return undefined;
}

// The pinned Core supplies this header even for a source with no custom headers.
const CORE_DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FIXTURE_REQUEST_KEYS = new Set<string>([
  'url', 'method', 'headers', 'body', 'charset', 'followRedirects', 'maxRedirects',
  'usePlatformCookieJar', 'session', 'timeoutMs',
]);

function absent(value: unknown): boolean {
  return value === undefined || value === null;
}

/** The caller must independently verify the current isolated DEBUG fixture scope. */
export function admitReaderPublicSearchHttpFixtureRequest(fixture: ReaderPublicSearchHttpFixture,
  params: JsonObject): JsonObject | undefined {
  if (fixture === 'vm-journeys') return undefined;
  const expectedUrl = fixture === 'delayed' ? READER_PUBLIC_SEARCH_DELAYED_URL :
    fixture === 'http-503' ? READER_PUBLIC_SEARCH_HTTP_503_URL :
      fixture === 'http-503-body' ? READER_PUBLIC_SEARCH_HTTP_503_BODY_URL : undefined;
  if (expectedUrl === undefined || params === null || typeof params !== 'object' || Array.isArray(params) ||
    Object.keys(params).some(key => !FIXTURE_REQUEST_KEYS.has(key))) return undefined;

  if (params['url'] !== expectedUrl || params['method'] !== 'GET' || !absent(params['body']) ||
    params['charset'] !== 'utf-8' || params['usePlatformCookieJar'] !== false || !absent(params['session']) ||
    (!absent(params['followRedirects']) && params['followRedirects'] !== false) ||
    (!absent(params['maxRedirects']) && params['maxRedirects'] !== 0)) return undefined;

  const headers = params['headers'];
  if (headers === null || typeof headers !== 'object' || Array.isArray(headers)) return undefined;
  const headerNames = Object.keys(headers);
  if (headerNames.length !== 1 || headerNames[0] !== 'User-Agent' ||
    (headers as JsonObject)['User-Agent'] !== CORE_DEFAULT_USER_AGENT) return undefined;

  const timeout = params['timeoutMs'];
  if (timeout !== undefined && (typeof timeout !== 'number' || !Number.isSafeInteger(timeout) || timeout <= 0)) return undefined;

  const request: JsonObject = {
    url: expectedUrl,
    method: 'GET',
    headers: { 'User-Agent': CORE_DEFAULT_USER_AGENT },
    body: null,
    charset: 'utf-8',
    usePlatformCookieJar: false,
    httpsOnly: true,
    followRedirects: false,
    maxRedirects: 0,
  };
  if (timeout !== undefined) request['timeoutMs'] = timeout;
  return request;
}
