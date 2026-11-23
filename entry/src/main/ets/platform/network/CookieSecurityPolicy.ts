/**
 * Reader book-source cookies deliberately use an exact-host scope.
 *
 * HarmonyOS exposes no registrable-domain/Public-Suffix API and this target
 * has no PSL dependency that is compatible with ArkTS. Accepting only the
 * response/request host is a stricter RFC6265 policy: it prevents `Domain=com`
 * and parent-domain expansion without maintaining a partial, stale suffix
 * table. Source isolation still allows each host to establish its own jar.
 */
export function isExactCookieDomainScope(originHost: string, requestedDomain: string): boolean {
  return originHost.trim().toLowerCase() === requestedDomain.trim().toLowerCase();
}

/** HttpOnly is a transport-only credential and never crosses cookie.get or
 * an HTTP response's script-visible cookie observation channel.
 */
export function isCookieVisibleToScript(httpOnly: boolean): boolean {
  return !httpOnly;
}
