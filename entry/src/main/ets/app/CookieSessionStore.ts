import asset from '@ohos.security.asset';
import url from '@ohos.url';
import util from '@ohos.util';
import type { JsonObject } from '@reader/core-harmony';

const ASSET_ALIAS = 'reader.cookie.sessions.v1';
const FORMAT_VERSION = 1;
const MAX_SESSION_ID_LENGTH = 2048;
const MAX_PERSISTED_COOKIES = 4096;
const MAX_PERSISTED_BYTES = 512 * 1024;

type SameSiteValue = 'Strict' | 'Lax' | 'None' | null;

type StoredCookie = {
  sessionId: string;
  name: string;
  value: string;
  domain: string;
  path: string;
  expiresAtMs: number | null;
  secure: boolean;
  httpOnly: boolean;
  sameSite: SameSiteValue;
  hostOnly: boolean;
  createdAt: number;
};

type PersistedCookieEnvelope = {
  formatVersion: number;
  cookies: StoredCookie[];
};

/**
 * Host-owned cookie/session boundary shared by HTTP and the later ArkWeb
 * executor. Core supplies only an opaque session id; ArkUI never sees or
 * persists credential plaintext.
 *
 * Session cookies stay in memory. Cookies with Expires/Max-Age are stored in
 * AssetStore, encrypted by the platform and removed with the application.
 * `Tag.IS_PERSISTENT` is deliberately not used: that tag means surviving an
 * uninstall and would be wrong for source credentials.
 */
export class CookieSessionStore {
  static readonly instance: CookieSessionStore = new CookieSessionStore();

  private readonly cookies: StoredCookie[] = [];
  private loadPromise: Promise<void> | null = null;
  private writeTail: Promise<void> = Promise.resolve();
  private creationSequence: number = Date.now();

  async cookieHeader(sessionId: string, requestUrl: string): Promise<string> {
    await this.ensureLoaded();
    const normalizedSessionId = this.requireSessionId(sessionId);
    const parsed = this.parseHttpUrl(requestUrl);
    const now = Date.now();
    await this.removeExpiredAndPersist(now);
    const matched = this.cookies.filter((cookie: StoredCookie): boolean => {
      return cookie.sessionId === normalizedSessionId &&
        this.cookieMatchesUrl(cookie, parsed, now);
    });
    matched.sort((left: StoredCookie, right: StoredCookie): number => {
      const pathDifference = right.path.length - left.path.length;
      return pathDifference !== 0 ? pathDifference : left.createdAt - right.createdAt;
    });
    return matched.map((cookie: StoredCookie): string => {
      return `${cookie.name}=${cookie.value}`;
    }).join('; ');
  }

  async storeResponseCookies(
    sessionId: string,
    requestUrl: string,
    setCookieHeaders: string[],
  ): Promise<JsonObject[]> {
    await this.ensureLoaded();
    const normalizedSessionId = this.requireSessionId(sessionId);
    const parsedUrl = this.parseHttpUrl(requestUrl);
    const observed: JsonObject[] = [];
    let persistentChanged = false;
    for (const header of setCookieHeaders) {
      const parsed = this.parseSetCookie(normalizedSessionId, parsedUrl, header);
      if (parsed === null) {
        continue;
      }
      persistentChanged = this.upsert(parsed) || persistentChanged;
      observed.push(this.toWireCookie(parsed));
    }
    if (persistentChanged) {
      await this.schedulePersist();
    }
    return observed;
  }

  async getCapability(params: JsonObject): Promise<JsonObject> {
    await this.ensureLoaded();
    const requestUrl = typeof params['url'] === 'string' ? params['url'] : null;
    const domain = typeof params['domain'] === 'string' ? params['domain'] : null;
    const requestedName = typeof params['name'] === 'string' ? params['name'] : null;
    const sessionId = this.capabilitySessionId(params['sessionId'], requestUrl, domain);
    const now = Date.now();
    await this.removeExpiredAndPersist(now);
    let parsedUrl: url.URL | null = null;
    if (requestUrl !== null) {
      parsedUrl = this.parseHttpUrl(requestUrl);
    }
    const normalizedDomain = domain === null ? null : this.normalizeDomain(domain);
    const matched = this.cookies.filter((cookie: StoredCookie): boolean => {
      if (cookie.sessionId !== sessionId || cookie.expiresAtMs !== null && cookie.expiresAtMs <= now) {
        return false;
      }
      if (requestedName !== null && cookie.name !== requestedName) {
        return false;
      }
      if (parsedUrl !== null) {
        return this.cookieMatchesUrl(cookie, parsedUrl, now);
      }
      return normalizedDomain === null || this.domainMatches(normalizedDomain, cookie.domain);
    });
    matched.sort((left: StoredCookie, right: StoredCookie): number => left.createdAt - right.createdAt);
    return { cookies: matched.map((cookie: StoredCookie): JsonObject => this.toWireCookie(cookie)) };
  }

  async setCapability(params: JsonObject): Promise<JsonObject> {
    await this.ensureLoaded();
    const wire = params['cookie'];
    if (wire === null || typeof wire !== 'object' || Array.isArray(wire)) {
      throw new Error('cookie.set requires cookie object');
    }
    const requestUrl = typeof params['url'] === 'string' ? params['url'] : null;
    const sessionId = this.capabilitySessionId(params['sessionId'], requestUrl, null);
    const parsedUrl = requestUrl === null ? null : this.parseHttpUrl(requestUrl);
    const record = wire as Record<string, unknown>;
    const name = this.requireCookieName(record['name']);
    const value = typeof record['value'] === 'string' ? record['value'] : '';
    const rawDomain = typeof record['domain'] === 'string' ? record['domain'] : null;
    if (parsedUrl === null && rawDomain === null) {
      throw new Error('cookie.set requires url or cookie.domain');
    }
    const domain = rawDomain === null ? parsedUrl!.hostname.toLowerCase() : this.normalizeDomain(rawDomain);
    if (parsedUrl !== null && !this.domainMatches(parsedUrl.hostname.toLowerCase(), domain)) {
      throw new Error('cookie.set domain does not match url host');
    }
    const rawPath = typeof record['path'] === 'string' ? record['path'] : null;
    const path = rawPath === null ? this.defaultPath(parsedUrl?.pathname ?? '/') : this.normalizePath(rawPath);
    const expiresAtMs = this.parseWireExpiry(record['expiresAt']);
    const secure = record['secure'] === true;
    const sameSite = this.normalizeSameSite(record['sameSite']);
    const hostOnly = rawDomain === null;
    if (sameSite === 'None' && !secure) {
      throw new Error('cookie.set rejects SameSite=None without Secure');
    }
    if (name.startsWith('__Secure-') && !secure) {
      throw new Error('cookie.set rejects __Secure- cookie without Secure');
    }
    if (name.startsWith('__Host-') && (!secure || !hostOnly || path !== '/')) {
      throw new Error('cookie.set rejects invalid __Host- cookie scope');
    }
    const cookie: StoredCookie = {
      sessionId,
      name,
      value,
      domain,
      path,
      expiresAtMs,
      secure,
      httpOnly: record['httpOnly'] === true,
      sameSite,
      hostOnly,
      createdAt: this.nextCreationSequence(),
    };
    const persistentChanged = this.upsert(cookie);
    if (persistentChanged) {
      await this.schedulePersist();
    }
    return { stored: true };
  }

  async clearSession(sessionId: string): Promise<void> {
    await this.ensureLoaded();
    const normalized = this.requireSessionId(sessionId);
    let persistentChanged = false;
    for (let index = this.cookies.length - 1; index >= 0; index -= 1) {
      if (this.cookies[index].sessionId !== normalized) {
        continue;
      }
      persistentChanged = persistentChanged || this.cookies[index].expiresAtMs !== null;
      this.cookies.splice(index, 1);
    }
    if (persistentChanged) {
      await this.schedulePersist();
    }
  }

  private ensureLoaded(): Promise<void> {
    if (this.loadPromise === null) {
      this.loadPromise = this.loadFromAssetStore();
    }
    return this.loadPromise;
  }

  private async loadFromAssetStore(): Promise<void> {
    const query = new Map<asset.Tag, asset.Value>();
    query.set(asset.Tag.ALIAS, this.utf8(ASSET_ALIAS));
    query.set(asset.Tag.RETURN_TYPE, asset.ReturnType.ALL);
    let records: Array<asset.AssetMap>;
    try {
      records = await asset.query(query);
    } catch (error) {
      const code = this.errorCode(error);
      if (code === asset.ErrorCode.NOT_FOUND) {
        return;
      }
      throw new Error(`cookie store cannot read secure AssetStore: ${this.errorMessage(error)}`);
    }
    if (records.length === 0) {
      return;
    }
    const secret = records[0].get(asset.Tag.SECRET);
    if (!(secret instanceof Uint8Array)) {
      throw new Error('cookie store AssetStore record has no secret payload');
    }
    let parsed: PersistedCookieEnvelope;
    try {
      parsed = JSON.parse(util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(secret)) as
        PersistedCookieEnvelope;
    } catch (error) {
      throw new Error(`cookie store secure payload is invalid: ${this.errorMessage(error)}`);
    }
    if (parsed.formatVersion !== FORMAT_VERSION || !Array.isArray(parsed.cookies)) {
      throw new Error('cookie store secure payload has unsupported format');
    }
    const now = Date.now();
    for (const candidate of parsed.cookies) {
      if (this.isStoredCookie(candidate) && candidate.expiresAtMs !== null && candidate.expiresAtMs > now) {
        this.cookies.push(candidate);
        this.creationSequence = Math.max(this.creationSequence, candidate.createdAt);
      }
    }
  }

  private schedulePersist(): Promise<void> {
    this.writeTail = this.writeTail.then((): Promise<void> => this.persist());
    return this.writeTail;
  }

  private async persist(): Promise<void> {
    const now = Date.now();
    const persistent = this.cookies.filter((cookie: StoredCookie): boolean => {
      return cookie.expiresAtMs !== null && cookie.expiresAtMs > now;
    });
    if (persistent.length > MAX_PERSISTED_COOKIES) {
      throw new Error(`cookie store exceeds ${MAX_PERSISTED_COOKIES} persistent cookie limit`);
    }
    const payload = this.utf8(JSON.stringify({ formatVersion: FORMAT_VERSION, cookies: persistent }));
    if (payload.length > MAX_PERSISTED_BYTES) {
      throw new Error(`cookie store exceeds ${MAX_PERSISTED_BYTES} secure-byte limit`);
    }
    if (persistent.length === 0) {
      const query = new Map<asset.Tag, asset.Value>();
      query.set(asset.Tag.ALIAS, this.utf8(ASSET_ALIAS));
      try {
        await asset.remove(query);
      } catch (error) {
        if (this.errorCode(error) !== asset.ErrorCode.NOT_FOUND) {
          throw new Error(`cookie store cannot clear secure AssetStore: ${this.errorMessage(error)}`);
        }
      }
      return;
    }
    const attributes = new Map<asset.Tag, asset.Value>();
    attributes.set(asset.Tag.ALIAS, this.utf8(ASSET_ALIAS));
    attributes.set(asset.Tag.SECRET, payload);
    attributes.set(asset.Tag.ACCESSIBILITY, asset.Accessibility.DEVICE_POWERED_ON);
    attributes.set(asset.Tag.CONFLICT_RESOLUTION, asset.ConflictResolution.OVERWRITE);
    try {
      await asset.add(attributes);
    } catch (error) {
      throw new Error(`cookie store cannot write secure AssetStore: ${this.errorMessage(error)}`);
    }
  }

  private parseSetCookie(sessionId: string, requestUrl: url.URL, header: string): StoredCookie | null {
    const sections = header.split(';');
    const first = sections.shift()?.trim() ?? '';
    const separator = first.indexOf('=');
    if (separator <= 0) {
      return null;
    }
    const name = this.requireCookieName(first.substring(0, separator).trim());
    const value = first.substring(separator + 1).trim();
    let domain = requestUrl.hostname.toLowerCase();
    let hostOnly = true;
    let path = this.defaultPath(requestUrl.pathname);
    let expiresAtMs: number | null = null;
    let maxAge: number | null = null;
    let secure = false;
    let httpOnly = false;
    let sameSite: SameSiteValue = null;
    for (const section of sections) {
      const trimmed = section.trim();
      if (trimmed.length === 0) {
        continue;
      }
      const equals = trimmed.indexOf('=');
      const attributeName = (equals < 0 ? trimmed : trimmed.substring(0, equals)).trim().toLowerCase();
      const attributeValue = equals < 0 ? '' : trimmed.substring(equals + 1).trim();
      if (attributeName === 'domain' && attributeValue.length > 0) {
        const requestedDomain = this.normalizeDomain(attributeValue);
        if (!this.domainMatches(requestUrl.hostname.toLowerCase(), requestedDomain)) {
          return null;
        }
        domain = requestedDomain;
        hostOnly = false;
      } else if (attributeName === 'path' && attributeValue.length > 0) {
        path = this.normalizePath(attributeValue);
      } else if (attributeName === 'expires' && attributeValue.length > 0) {
        const parsed = Date.parse(attributeValue);
        if (!Number.isNaN(parsed)) {
          expiresAtMs = parsed;
        }
      } else if (attributeName === 'max-age' && /^-?\d+$/.test(attributeValue)) {
        maxAge = Number.parseInt(attributeValue, 10);
      } else if (attributeName === 'secure') {
        secure = true;
      } else if (attributeName === 'httponly') {
        httpOnly = true;
      } else if (attributeName === 'samesite') {
        sameSite = this.normalizeSameSite(attributeValue);
      }
    }
    if (maxAge !== null) {
      expiresAtMs = maxAge <= 0 ? 0 : Date.now() + maxAge * 1000;
    }
    // RFC6265bis: SameSite=None is accepted only for Secure cookies. Dropping
    // invalid response cookies mirrors browser behavior and keeps the shared
    // HTTP/ArkWeb session on one security policy.
    if (sameSite === 'None' && !secure) {
      return null;
    }
    if (name.startsWith('__Secure-') && !secure) {
      return null;
    }
    if (name.startsWith('__Host-') && (!secure || !hostOnly || path !== '/')) {
      return null;
    }
    return {
      sessionId,
      name,
      value,
      domain,
      path,
      expiresAtMs,
      secure,
      httpOnly,
      sameSite,
      hostOnly,
      createdAt: this.nextCreationSequence(),
    };
  }

  /** Returns true when persisted state changed. */
  private upsert(cookie: StoredCookie): boolean {
    const index = this.cookies.findIndex((candidate: StoredCookie): boolean => {
      return candidate.sessionId === cookie.sessionId && candidate.name === cookie.name &&
        candidate.domain === cookie.domain && candidate.path === cookie.path;
    });
    const previousPersistent = index >= 0 && this.cookies[index].expiresAtMs !== null;
    if (cookie.expiresAtMs !== null && cookie.expiresAtMs <= Date.now()) {
      if (index >= 0) {
        this.cookies.splice(index, 1);
      }
      return previousPersistent;
    }
    if (index >= 0) {
      cookie.createdAt = this.cookies[index].createdAt;
      this.cookies[index] = cookie;
    } else {
      this.cookies.push(cookie);
    }
    return previousPersistent || cookie.expiresAtMs !== null;
  }

  private async removeExpiredAndPersist(now: number): Promise<void> {
    let persistentChanged = false;
    for (let index = this.cookies.length - 1; index >= 0; index -= 1) {
      const cookie = this.cookies[index];
      if (cookie.expiresAtMs === null || cookie.expiresAtMs > now) {
        continue;
      }
      persistentChanged = true;
      this.cookies.splice(index, 1);
    }
    if (persistentChanged) {
      await this.schedulePersist();
    }
  }

  private cookieMatchesUrl(cookie: StoredCookie, parsed: url.URL, now: number): boolean {
    if (cookie.expiresAtMs !== null && cookie.expiresAtMs <= now) {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (cookie.hostOnly ? host !== cookie.domain : !this.domainMatches(host, cookie.domain)) {
      return false;
    }
    if (cookie.secure && parsed.protocol.toLowerCase() !== 'https:') {
      return false;
    }
    return this.pathMatches(parsed.pathname, cookie.path);
  }

  private pathMatches(requestPath: string, cookiePath: string): boolean {
    const normalizedRequest = requestPath.length === 0 ? '/' : requestPath;
    if (normalizedRequest === cookiePath) {
      return true;
    }
    if (!normalizedRequest.startsWith(cookiePath)) {
      return false;
    }
    return cookiePath.endsWith('/') || normalizedRequest.charAt(cookiePath.length) === '/';
  }

  private domainMatches(host: string, domain: string): boolean {
    const normalizedHost = host.toLowerCase();
    const normalizedDomain = this.normalizeDomain(domain);
    return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
  }

  private defaultPath(pathname: string): string {
    if (!pathname.startsWith('/') || pathname === '/') {
      return '/';
    }
    const finalSlash = pathname.lastIndexOf('/');
    return finalSlash <= 0 ? '/' : pathname.substring(0, finalSlash);
  }

  private normalizePath(path: string): string {
    const trimmed = path.trim();
    return trimmed.startsWith('/') ? trimmed : '/';
  }

  private normalizeDomain(domain: string): string {
    const normalized = domain.trim().toLowerCase().replace(/^\.+/, '');
    if (normalized.length === 0 || normalized.indexOf('/') >= 0 || normalized.indexOf(':') >= 0) {
      throw new Error('cookie domain is invalid');
    }
    return normalized;
  }

  private normalizeSameSite(value: unknown): SameSiteValue {
    if (typeof value !== 'string') {
      return null;
    }
    switch (value.trim().toLowerCase()) {
      case 'strict':
        return 'Strict';
      case 'lax':
        return 'Lax';
      case 'none':
        return 'None';
      default:
        return null;
    }
  }

  private parseWireExpiry(value: unknown): number | null {
    if (typeof value !== 'string') {
      return null;
    }
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      throw new Error('cookie expiresAt must be an ISO-compatible date');
    }
    return parsed;
  }

  private toWireCookie(cookie: StoredCookie): JsonObject {
    const wire: JsonObject = {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
    };
    if (cookie.expiresAtMs !== null) {
      wire['expiresAt'] = new Date(cookie.expiresAtMs).toISOString();
    }
    if (cookie.sameSite !== null) {
      wire['sameSite'] = cookie.sameSite;
    }
    return wire;
  }

  private capabilitySessionId(value: unknown, requestUrl: string | null, domain: string | null): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return this.requireSessionId(value);
    }
    if (requestUrl !== null) {
      const parsed = this.parseHttpUrl(requestUrl);
      return this.requireSessionId(`legacy:${parsed.protocol}//${parsed.host}`);
    }
    if (domain !== null) {
      return this.requireSessionId(`legacy-domain:${this.normalizeDomain(domain)}`);
    }
    throw new Error('cookie capability requires sessionId, url, or domain');
  }

  private requireSessionId(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_SESSION_ID_LENGTH) {
      throw new Error(`cookie session id must contain 1..${MAX_SESSION_ID_LENGTH} characters`);
    }
    return trimmed;
  }

  private requireCookieName(value: unknown): string {
    if (typeof value !== 'string') {
      throw new Error('cookie name must be a string');
    }
    const trimmed = value.trim();
    if (trimmed.length === 0 || /[\s;,=]/.test(trimmed)) {
      throw new Error('cookie name is invalid');
    }
    return trimmed;
  }

  private parseHttpUrl(value: string): url.URL {
    let parsed: url.URL;
    try {
      parsed = url.URL.parseURL(value);
    } catch (error) {
      throw new Error(`cookie URL is invalid: ${this.errorMessage(error)}`);
    }
    const protocol = parsed.protocol.toLowerCase();
    if ((protocol !== 'http:' && protocol !== 'https:') || parsed.hostname.length === 0) {
      throw new Error('cookie URL must use http or https');
    }
    return parsed;
  }

  private nextCreationSequence(): number {
    this.creationSequence += 1;
    return this.creationSequence;
  }

  private utf8(value: string): Uint8Array {
    return new util.TextEncoder('utf-8').encode(value);
  }

  private errorCode(error: unknown): number | null {
    if (error !== null && typeof error === 'object') {
      const code = (error as Record<string, unknown>)['code'];
      return typeof code === 'number' ? code : null;
    }
    return null;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : `${error}`;
  }

  private isStoredCookie(value: unknown): value is StoredCookie {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    const cookie = value as Partial<StoredCookie>;
    return typeof cookie.sessionId === 'string' && typeof cookie.name === 'string' &&
      typeof cookie.value === 'string' && typeof cookie.domain === 'string' &&
      typeof cookie.path === 'string' &&
      (cookie.expiresAtMs === null || typeof cookie.expiresAtMs === 'number') &&
      typeof cookie.secure === 'boolean' && typeof cookie.httpOnly === 'boolean' &&
      (cookie.sameSite === null || cookie.sameSite === 'Strict' || cookie.sameSite === 'Lax' ||
        cookie.sameSite === 'None') && typeof cookie.hostOnly === 'boolean' &&
      typeof cookie.createdAt === 'number';
  }
}
