// CookieGetHandler — handles the 'cookie.get' capability.
//
// Mirrors Android `app/src/main/kotlin/com/reader/host/CookieGetHandler.kt`
// and Swift `CookieGetHandler.swift`. Core emits host.request with
// capability='cookie.get' and params {url}; this handler reads cookies for
// that URL from the host-owned CookieStore and returns them as
// host.complete.params.result = {cookies: [{name, value, domain, path, ...}]}.
//
// JSON contract (aligned with Android / iOS):
//   request  params : {url: string}
//   result          : {cookies: [{name, value, domain, path, secure?, httpOnly?, expiresAt?}]}
//
// The host owns the cookie jar — Core never touches the platform cookie store
// directly (charter §4 / §10.2). CookieStore is synchronous on HarmonyOS
// (InMemoryCookieStore); the CapabilityHandler surface is async to match the
// Android suspend CookieStore contract.
import { CapabilityHandler } from './CapabilityHandler';
import { CookieStore, CookieScope, CookieRecord } from './CookieStore';
import { HostReply, hostReplySuccess, hostReplyError } from './HostReply';

export const COOKIE_GET_CAPABILITY = 'cookie.get';

export function makeCookieGetHandler(cookieStore: CookieStore): CapabilityHandler {
  const handler: CapabilityHandler = async (params: Record<string, Object>): Promise<HostReply> => {
    const urlValue = params['url'];
    if (typeof urlValue !== 'string' || (urlValue as string).length === 0) {
      return hostReplyError('INVALID_ARGUMENT', 'cookie.get requires non-empty url', false);
    }
    const url = urlValue as string;
    let scope: CookieScope;
    try {
      scope = cookieStore.get(url);
    } catch (e) {
      return hostReplyError('INTERNAL', `cookie.get failed: ${e}`, true);
    }
    // SDK-COMPAT: build cookies array via typed records to satisfy
    // arkts-no-untyped-obj-literals.
    const cookies: Record<string, Object>[] = [];
    for (let i = 0; i < scope.cookies.length; i++) {
      const record: CookieRecord = scope.cookies[i];
      const cookie: Record<string, Object> = {} as Record<string, Object>;
      cookie['name'] = record.name;
      cookie['value'] = record.value;
      cookie['domain'] = record.domain;
      cookie['path'] = record.path;
      if (record.secure) {
        cookie['secure'] = true;
      }
      if (record.httpOnly) {
        cookie['httpOnly'] = true;
      }
      if (record.expiresAt !== undefined && record.expiresAt !== null) {
        cookie['expiresAt'] = record.expiresAt;
      }
      cookies.push(cookie);
    }
    const result: Record<string, Object> = {} as Record<string, Object>;
    result['cookies'] = cookies;
    return hostReplySuccess(result);
  };
  return handler;
}
