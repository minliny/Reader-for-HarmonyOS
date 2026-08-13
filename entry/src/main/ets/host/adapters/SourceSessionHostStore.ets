import { HostCookieGetRequest, HostCookieRecord } from '../types';

const DEFAULT_SESSION_ID: string = 'default';
const URL_HOST_PATTERN: RegExp = /^https?:\/\/([^/:]+)(?::\d+)?(?:\/|$)/;

export interface SourceLoginHeaderState {
  found: boolean;
  headers: Record<string, string>;
}

export class SourceSessionHostStore {
  private static sharedInstance: SourceSessionHostStore | null = null;

  private cookieJars: Map<string, HostCookieRecord[]> = new Map<string, HostCookieRecord[]>();
  private sourceVariables: Map<string, Map<string, string>> = new Map<string, Map<string, string>>();
  private sourceLoginHeaders: Map<string, Record<string, string>> = new Map<string, Record<string, string>>();

  static shared(): SourceSessionHostStore {
    if (SourceSessionHostStore.sharedInstance === null) {
      SourceSessionHostStore.sharedInstance = new SourceSessionHostStore();
    }
    return SourceSessionHostStore.sharedInstance;
  }

  static resetForTest(): void {
    SourceSessionHostStore.sharedInstance = new SourceSessionHostStore();
  }

  getCookies(request: HostCookieGetRequest): HostCookieRecord[] {
    const sessionId = this.normalizeSessionId(request.sessionId);
    const jar = this.cookieJars.get(sessionId);
    if (jar === undefined) {
      return [];
    }
    const requestDomain = this.resolveDomain(request);
    const now = Date.now();
    const result: HostCookieRecord[] = [];
    const retained: HostCookieRecord[] = [];
    for (let i = 0; i < jar.length; i++) {
      const cookie = jar[i];
      if (cookie.expires !== undefined && cookie.expires <= now) {
        continue;
      }
      retained.push(cookie);
      if (request.name !== undefined && cookie.name !== request.name) {
        continue;
      }
      if (requestDomain !== undefined && !this.domainMatches(cookie.domain, requestDomain)) {
        continue;
      }
      result.push(cookie);
    }
    if (retained.length !== jar.length) {
      this.cookieJars.set(sessionId, retained);
    }
    return result;
  }

  setCookie(cookie: HostCookieRecord, sessionId?: string): void {
    const normalizedSessionId = this.normalizeSessionId(sessionId);
    let jar = this.cookieJars.get(normalizedSessionId);
    if (jar === undefined) {
      jar = [];
      this.cookieJars.set(normalizedSessionId, jar);
    }
    const idx = this.findCookieIndex(jar, cookie);
    if (idx >= 0) {
      jar[idx] = cookie;
    } else {
      jar.push(cookie);
    }
  }

  clearCookieSession(sessionId?: string): void {
    this.cookieJars.delete(this.normalizeSessionId(sessionId));
  }

  clearAllCookies(): void {
    this.cookieJars.clear();
  }

  buildCookieHeader(url: string, sessionId?: string): string {
    const cookies = this.getCookies({ url, sessionId });
    const pairs: string[] = [];
    for (let i = 0; i < cookies.length; i++) {
      pairs.push(`${cookies[i].name}=${cookies[i].value}`);
    }
    return pairs.join('; ');
  }

  setSourceVariable(sourceId: string, key: string, value: string, sessionId?: string): void {
    const storeKey = this.sourceStateKey(sourceId, sessionId);
    let vars = this.sourceVariables.get(storeKey);
    if (vars === undefined) {
      vars = new Map<string, string>();
      this.sourceVariables.set(storeKey, vars);
    }
    vars.set(key, value);
  }

  getSourceVariable(sourceId: string, key: string, sessionId?: string): string | undefined {
    const vars = this.sourceVariables.get(this.sourceStateKey(sourceId, sessionId));
    return vars?.get(key);
  }

  getSourceVariables(sourceId: string, sessionId?: string): Record<string, string> {
    const vars = this.sourceVariables.get(this.sourceStateKey(sourceId, sessionId));
    const result: Record<string, string> = {};
    if (vars === undefined) {
      return result;
    }
    vars.forEach((value: string, key: string) => {
      result[key] = value;
    });
    return result;
  }

  clearSourceVariables(sourceId: string, sessionId?: string): void {
    this.sourceVariables.delete(this.sourceStateKey(sourceId, sessionId));
  }

  setLoginHeaderMap(sourceId: string, headers: Record<string, string>, sessionId?: string): void {
    this.sourceLoginHeaders.set(this.sourceStateKey(sourceId, sessionId), this.cloneHeaders(headers));
  }

  getLoginHeaderMap(sourceId: string, sessionId?: string): SourceLoginHeaderState {
    const headers = this.sourceLoginHeaders.get(this.sourceStateKey(sourceId, sessionId));
    if (headers === undefined) {
      return { found: false, headers: {} };
    }
    return { found: true, headers: this.cloneHeaders(headers) };
  }

  clearLoginHeaderMap(sourceId: string, sessionId?: string): void {
    this.sourceLoginHeaders.delete(this.sourceStateKey(sourceId, sessionId));
  }

  clearAll(): void {
    this.cookieJars.clear();
    this.sourceVariables.clear();
    this.sourceLoginHeaders.clear();
  }

  private normalizeSessionId(sessionId?: string): string {
    if (sessionId === undefined || sessionId.length === 0) {
      return DEFAULT_SESSION_ID;
    }
    return sessionId;
  }

  private sourceStateKey(sourceId: string, sessionId?: string): string {
    return `${this.normalizeSessionId(sessionId)}:${sourceId}`;
  }

  private resolveDomain(request: HostCookieGetRequest): string | undefined {
    if (request.domain !== undefined && request.domain.length > 0) {
      return request.domain;
    }
    if (request.url !== undefined) {
      const match = request.url.match(URL_HOST_PATTERN);
      if (match !== null && match.length >= 2) {
        return match[1];
      }
    }
    return undefined;
  }

  private domainMatches(cookieDomain: string | undefined, requestDomain: string): boolean {
    if (cookieDomain === undefined || cookieDomain.length === 0) {
      return true;
    }
    if (cookieDomain === requestDomain) {
      return true;
    }
    if (cookieDomain.startsWith('.')) {
      const trimmed = cookieDomain.substring(1);
      return trimmed === requestDomain || requestDomain.endsWith('.' + trimmed);
    }
    return false;
  }

  private findCookieIndex(jar: HostCookieRecord[], cookie: HostCookieRecord): number {
    for (let i = 0; i < jar.length; i++) {
      const current = jar[i];
      if (
        current.name === cookie.name &&
        (current.domain ?? '') === (cookie.domain ?? '') &&
        (current.path ?? '') === (cookie.path ?? '')
      ) {
        return i;
      }
    }
    return -1;
  }

  private cloneHeaders(headers: Record<string, string>): Record<string, string> {
    const clone: Record<string, string> = {};
    const keys = Object.keys(headers);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      clone[key] = headers[key];
    }
    return clone;
  }
}
