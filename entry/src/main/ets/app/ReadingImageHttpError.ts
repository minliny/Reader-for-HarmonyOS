import xml from '@ohos.xml';
import url from '@ohos.url';

/** Response diagnostics only. Never retain an image URL, cookie or error body. */
export class ReadingImageHttpError extends Error {
  readonly status: number;
  constructor(code: string, status: number) { super(code); this.status = status; }
}

function header(headers: Record<string, string>, name: string): string {
  for (const key of Object.keys(headers)) if (key.toLowerCase() === name) return headers[key];
  return '';
}

function signedRequest(requestUrl: string): boolean {
  try {
    const query = new url.URL(requestUrl).searchParams;
    return (query.has('X-Amz-Signature') && query.has('X-Amz-Credential')) ||
      (query.has('X-Goog-Signature') && query.has('X-Goog-Credential')) ||
      (query.has('Signature') && query.has('Expires') && (query.has('Key-Pair-Id') || query.has('AWSAccessKeyId')));
  } catch (_) { return false; }
}

/** Use the platform XML parser for the documented object-storage Error envelope.
 * Bounded input, no DTD; absence/malformed/ambiguous data never permits refresh. */
function expiredEnvelope(headers: Record<string, string>, bytes: Uint8Array): boolean {
  if (bytes.length === 0 || bytes.length > 8192) return false;
  const contentType = header(headers, 'content-type').split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/xml' && contentType !== 'text/xml') return false;
  let code = ''; let message = ''; let codes = 0; let messages = 0;
  try {
    const parser = new xml.XmlPullParser(bytes.slice().buffer, 'UTF-8');
    parser.parse({ supportDoctype: false, ignoreNameSpace: false,
      tagValueCallbackFunction: (name: string, value: string): boolean => {
        if (name === 'Code') { code = value.trim(); codes++; }
        if (name === 'Message') { message = value.trim(); messages++; }
        return codes <= 1 && messages <= 1;
      } });
    return codes === 1 && messages <= 1 && (code === 'RequestExpired' || code === 'ExpiredToken' ||
      (code === 'AccessDenied' && message === 'Request has expired'));
  } catch (_) { return false; }
}

export function readingImageHttpError(status: number, headers: Record<string, string>, bytes: Uint8Array,
  requestUrl: string): ReadingImageHttpError {
  if (status === 401) return new ReadingImageHttpError('READING_IMAGE_AUTH_REQUIRED', status);
  const serviceCode = header(headers, 'x-amz-error-code');
  if ((status === 400 || status === 403) && signedRequest(requestUrl) &&
    (serviceCode === 'RequestExpired' || serviceCode === 'ExpiredToken' || expiredEnvelope(headers, bytes))) {
    return new ReadingImageHttpError('READING_IMAGE_SIGNATURE_EXPIRED', status);
  }
  if (status === 403) return new ReadingImageHttpError(header(headers, 'www-authenticate').trim().length > 0 ?
    'READING_IMAGE_AUTH_REQUIRED' : 'READING_IMAGE_ACCESS_DENIED', status);
  if (status === 429) return new ReadingImageHttpError('READING_IMAGE_RATE_LIMITED', status);
  return new ReadingImageHttpError('READING_IMAGE_HTTP_FAILED', status);
}
