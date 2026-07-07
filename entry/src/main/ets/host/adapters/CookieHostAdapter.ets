// CookieHostAdapter — scoped in-memory cookie jar for Host cookie.get / cookie.set.
// Source of truth: Reader-Core-Native docs/host-app-contracts/01-network-session.md §3.4.
// Phase 5 implementation.
//
// Cookies are partitioned by sessionId (default 'default'). Each session owns an
// independent jar (a plain array of HostCookieRecord). Same name/domain/path
// triples overwrite the previous record on set.
//
// Domain matching:
//   - exact match (cookieDomain === requestDomain)
//   - dot-prefix match: '.example.com' matches 'sub.example.com' and 'example.com'
//
// URL → domain extraction uses the regex /^https?:\/\/([^/]+)/ to capture the host.
import {
  HostCookieGetRequest,
  HostCookieGetResponse,
  HostCookieSetRequest,
  HostCookieSetResponse,
  HostCookieRecord,
  HostCookieEntry,
} from '../types';

const DEFAULT_SESSION_ID: string = 'default';
const URL_HOST_PATTERN: RegExp = /^https?:\/\/([^/]+)/;

export class CookieHostAdapter {
  private jars: Map<string, HostCookieRecord[]> = new Map<string, HostCookieRecord[]>();

  async get(event: HostCookieGetRequest): Promise<HostCookieGetResponse> {
    const sessionId = event.sessionId ?? DEFAULT_SESSION_ID;
    const jar = this.jars.get(sessionId);
    if (jar === undefined) {
      return { cookies: [] };
    }

    const requestDomain = this.resolveDomain(event);
    const result: HostCookieEntry[] = [];
    for (let i = 0; i < jar.length; i++) {
      const c = jar[i];
      if (event.name !== undefined && c.name !== event.name) {
        continue;
      }
      if (requestDomain !== undefined && !this.domainMatches(c.domain, requestDomain)) {
        continue;
      }
      const entry: HostCookieEntry = {
        name: c.name,
        value: c.value,
      };
      if (c.domain !== undefined) {
        entry.domain = c.domain;
      }
      if (c.path !== undefined) {
        entry.path = c.path;
      }
      result.push(entry);
    }
    return { cookies: result };
  }

  async set(event: HostCookieSetRequest): Promise<HostCookieSetResponse> {
    const sessionId = event.sessionId ?? DEFAULT_SESSION_ID;
    let jar = this.jars.get(sessionId);
    if (jar === undefined) {
      jar = [];
      this.jars.set(sessionId, jar);
    }

    const cookie = event.cookie;
    const idx = this.findIndexExact(jar, cookie);
    if (idx >= 0) {
      jar[idx] = cookie;
    } else {
      jar.push(cookie);
    }
    return { stored: true };
  }

  clearSession(sessionId: string): void {
    this.jars.delete(sessionId);
  }

  clearAll(): void {
    this.jars.clear();
  }

  // ── internal ──

  private resolveDomain(event: HostCookieGetRequest): string | undefined {
    if (event.domain !== undefined) {
      return event.domain;
    }
    if (event.url !== undefined) {
      const match = event.url.match(URL_HOST_PATTERN);
      if (match !== null && match.length >= 2) {
        return match[1];
      }
    }
    return undefined;
  }

  private domainMatches(cookieDomain: string | undefined, requestDomain: string): boolean {
    if (cookieDomain === undefined) {
      return true;
    }
    if (cookieDomain === requestDomain) {
      return true;
    }
    // Dot-prefix: '.example.com' matches 'sub.example.com' and 'example.com'.
    if (cookieDomain.startsWith('.')) {
      const trimmed = cookieDomain.substring(1);
      if (trimmed === requestDomain) {
        return true;
      }
      return requestDomain.endsWith('.' + trimmed);
    }
    return false;
  }

  private findIndexExact(jar: HostCookieRecord[], cookie: HostCookieRecord): number {
    for (let i = 0; i < jar.length; i++) {
      const c = jar[i];
      const nameMatch = c.name === cookie.name;
      const domainMatch = (c.domain ?? '') === (cookie.domain ?? '');
      const pathMatch = (c.path ?? '') === (cookie.path ?? '');
      if (nameMatch && domainMatch && pathMatch) {
        return i;
      }
    }
    return -1;
  }
}
