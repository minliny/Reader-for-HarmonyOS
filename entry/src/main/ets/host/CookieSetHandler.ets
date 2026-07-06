// CookieSetHandler — handles the 'cookie.set' capability.
//
// Mirrors Android `app/src/main/kotlin/com/reader/host/CookieSetHandler.kt`
// and Swift `CookieSetHandler.swift`. Core emits host.request with
// capability='cookie.set' and params {url, cookie: {name, value, domain?,
// path?, secure?, httpOnly?, expiresAt?}}; this handler persists the cookie
// via CookieStore.save and returns host.complete.params.result = {stored: true}.
//
// JSON contract (aligned with Android / iOS):
//   request  params : {url: string, cookie: {name, value, domain?, path?, secure?, httpOnly?, expiresAt?}}
//   result          : {stored: true}
//
// The host owns the cookie jar — Core never writes the platform cookie store
// directly (charter §4 / §10.2). Defaults match Android: path defaults to "/"
// when omitted, secure/httpOnly default to false, domain defaults to "" (the
// caller — typically Core's cookie store — is expected to supply it).
import { CapabilityHandler } from './CapabilityHandler';
import { CookieStore, CookieRecord } from './CookieStore';
import { HostReply, hostReplySuccess, hostReplyError } from './HostReply';

export const COOKIE_SET_CAPABILITY = 'cookie.set';

export function makeCookieSetHandler(cookieStore: CookieStore): CapabilityHandler {
  const handler: CapabilityHandler = async (params: Record<string, Object>): Promise<HostReply> => {
    const urlValue = params['url'];
    if (typeof urlValue !== 'string' || (urlValue as string).length === 0) {
      return hostReplyError('INVALID_ARGUMENT', 'cookie.set requires non-empty url', false);
    }
    const url = urlValue as string;
    const cookieObj = params['cookie'];
    if (cookieObj === null || cookieObj === undefined || typeof cookieObj !== 'object') {
      return hostReplyError('INVALID_ARGUMENT', 'cookie.set requires cookie object', false);
    }
    const cookieRecord = cookieObj as Record<string, Object>;
    const nameValue = cookieRecord['name'];
    if (typeof nameValue !== 'string' || (nameValue as string).length === 0) {
      return hostReplyError('INVALID_ARGUMENT', 'cookie.set requires non-empty cookie name', false);
    }
    const valueValue = cookieRecord['value'];
    const record: CookieRecord = {
      name: nameValue as string,
      value: typeof valueValue === 'string' ? valueValue as string : '',
      domain: readString(cookieRecord, 'domain', ''),
      path: readString(cookieRecord, 'path', '/'),
      secure: readBoolean(cookieRecord, 'secure', false),
      httpOnly: readBoolean(cookieRecord, 'httpOnly', false)
    } as CookieRecord;
    const expiresAtValue = cookieRecord['expiresAt'];
    if (typeof expiresAtValue === 'number') {
      record.expiresAt = expiresAtValue as number;
    }
    try {
      cookieStore.save(url, [record]);
    } catch (e) {
      return hostReplyError('INTERNAL', `cookie.set failed: ${e}`, true);
    }
    const result: Record<string, Object> = {} as Record<string, Object>;
    result['stored'] = true;
    return hostReplySuccess(result);
  };
  return handler;
}

function readString(record: Record<string, Object>, key: string, fallback: string): string {
  const v = record[key];
  if (typeof v === 'string' && (v as string).length > 0) {
    return v as string;
  }
  return fallback;
}

function readBoolean(record: Record<string, Object>, key: string, fallback: boolean): boolean {
  const v = record[key];
  if (typeof v === 'boolean') {
    return v as boolean;
  }
  return fallback;
}
