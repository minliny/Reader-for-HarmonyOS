import { hilog } from '@kit.PerformanceAnalysisKit';
import asset from '@ohos.security.asset';
import url from '@ohos.url';
import util from '@ohos.util';
import type { JsonObject } from '@reader/core-harmony';
import { isCookieVisibleToScript, isExactCookieDomainScope } from './CookieSecurityPolicy';
import { errorMessageOf } from './ErrorMessage';

const LOG_DOMAIN = 0x5244;
const LOG_TAG = 'Reader';
const ASSET_ALIAS = 'reader.cookie.sessions.v1';
const ASSET_PENDING_ALIAS = 'reader.cookie.sessions.pending.v2';
const ASSET_CHUNK_ALIAS_PREFIX = 'reader.cookie.sessions.v1#';
// Platform hard limit: a single AssetStore SECRET value holds at most 1024
// bytes, so the jar is striped across chunk records instead of one record.
const ASSET_SECRET_CHUNK_BYTES = 1024;
const FORMAT_VERSION = 1;
const MAX_SESSION_ID_LENGTH = 2048;
const MAX_PERSISTED_COOKIES = 4096;
const MAX_PERSISTED_BYTES = 512 * 1024;
const MAX_PERSISTED_CHUNKS = MAX_PERSISTED_BYTES / ASSET_SECRET_CHUNK_BYTES;
// Session cookies never enter AssetStore, so durable quotas alone cannot
// protect the in-memory jar from repeated unique Set-Cookie/cookie.set calls.
const MAX_COOKIE_NAME_LENGTH = 256;
const MAX_COOKIE_VALUE_LENGTH = 4096;
const MAX_COOKIE_PATH_LENGTH = 4096;
const MAX_SESSION_COOKIES = 256;
const MAX_SESSION_COOKIE_BYTES = 64 * 1024;
const MAX_TOTAL_COOKIES = MAX_PERSISTED_COOKIES;
const MAX_TOTAL_COOKIE_BYTES = 1024 * 1024;

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

type PersistedChunkHeader = {
  formatVersion: number;
  chunkCount: number;
  generation?: string;
};

type CookieWriteTransaction = {
  next: PersistedChunkHeader;
  previous: PersistedChunkHeader | null;
};

export type ArkWebCookieSeed = {
  name: string;
  domain: string;
  path: string;
  url: string;
  header: string;
};

export type ArkWebObservedCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expiresAt?: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  hostOnly: boolean;
};

/**
 * Host-owned cookie/session boundary shared by HTTP and the later ArkWeb
 * executor. Core supplies only an opaque session id; ArkUI never sees or
 * persists credential plaintext.
 *
 * Session cookies stay in memory. Cookies with Expires/Max-Age are stored in
 * AssetStore, encrypted by the platform and removed with the application. The
 * platform caps each SECRET at 1024 bytes. Versioned chunks and a single
 * commit record keep interrupted writes from mixing generations; a journal
 * recovers abandoned chunks. HTTP persistence may degrade, but explicit
 * credential clearing resolves only after its empty state is committed.
 * `Tag.IS_PERSISTENT` is deliberately not used: that tag means surviving an
 * uninstall and would be wrong for source credentials.
 */
export class CookieSessionStore {
  static readonly instance: CookieSessionStore = new CookieSessionStore();

  private readonly cookies: StoredCookie[] = [];
  private loadPromise: Promise<void> | null = null;
  private writeTail: Promise<void> = Promise.resolve();
  private creationSequence: number = Date.now();
  private persistedChunkCount: number = 0;
  private persistedGeneration: string | undefined = undefined;
  private generationSequence: number = 0;
  private readonly sessionGenerations: Map<string, number> = new Map();

  sessionGeneration(sessionId: string): number {
    return this.sessionGenerations.get(this.requireSessionId(sessionId)) ?? 0;
  }

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
    expectedGeneration?: number,
  ): Promise<JsonObject[]> {
    await this.ensureLoaded();
    const normalizedSessionId = this.requireSessionId(sessionId);
    if (expectedGeneration !== undefined && expectedGeneration !== this.sessionGeneration(normalizedSessionId)) {
      return [];
    }
    const parsedUrl = this.parseHttpUrl(requestUrl);
    const observed: JsonObject[] = [];
    let persistentChanged = false;
    for (const header of setCookieHeaders) {
      const parsed = this.parseSetCookie(normalizedSessionId, parsedUrl, header);
      if (parsed === null) {
        continue;
      }
      let accepted = true;
      try {
        persistentChanged = this.upsert(parsed) || persistentChanged;
      } catch (_) {
        // Ignore over-quota response cookies, matching browser jar behavior.
        accepted = false;
      }
      if (accepted && isCookieVisibleToScript(parsed.httpOnly)) {
        observed.push(this.toWireCookie(parsed));
      }
    }
    if (persistentChanged) {
      // Serialize generation commits behind the response; secure storage can
      // recover either complete generation after an interrupted write.
      void this.schedulePersist();
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
      if (cookie.sessionId !== sessionId || cookie.httpOnly ||
        cookie.expiresAtMs !== null && cookie.expiresAtMs <= now) {
        return false;
      }
      if (requestedName !== null && cookie.name !== requestedName) {
        return false;
      }
      if (parsedUrl !== null) {
        return this.cookieMatchesUrl(cookie, parsedUrl, now);
      }
      return normalizedDomain === null || (cookie.hostOnly ? normalizedDomain === cookie.domain :
        this.domainMatches(normalizedDomain, cookie.domain));
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
    if (!this.isSafeCookieValue(value)) {
      throw new Error('cookie value is invalid');
    }
    const rawDomain = typeof record['domain'] === 'string' ? record['domain'] : null;
    if (parsedUrl === null && rawDomain === null) {
      throw new Error('cookie.set requires url or cookie.domain');
    }
    const domain = rawDomain === null ? parsedUrl!.hostname.toLowerCase() : this.normalizeDomain(rawDomain);
    if (parsedUrl !== null && !isExactCookieDomainScope(parsedUrl.hostname, domain)) {
      throw new Error('cookie.set domain must exactly match url host');
    }
    const rawPath = typeof record['path'] === 'string' ? record['path'] : null;
    const path = rawPath === null ? this.defaultPath(parsedUrl?.pathname ?? '/') : this.normalizePath(rawPath);
    const expiresAtMs = this.parseWireExpiry(record['expiresAt']);
    const secure = record['secure'] === true;
    if (secure && (parsedUrl === null || parsedUrl.protocol.toLowerCase() !== 'https:')) {
      throw new Error('cookie.set rejects Secure cookies from non-HTTPS URLs');
    }
    const sameSite = this.normalizeSameSite(record['sameSite']);
    const hostOnly = true;
    if (record['httpOnly'] === true) {
      throw new Error('cookie.set cannot create HttpOnly credentials from script');
    }
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
      httpOnly: false,
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
    const normalized = this.requireSessionId(sessionId);
    // Invalidate already admitted HTTP/WebView work before the first await.
    this.sessionGenerations.set(normalized, this.sessionGeneration(normalized) + 1);
    await this.ensureLoaded();
    for (let index = this.cookies.length - 1; index >= 0; index -= 1) {
      if (this.cookies[index].sessionId !== normalized) {
        continue;
      }
      this.cookies.splice(index, 1);
    }
    // Clearing credentials has durable semantics even after an earlier load/write failure.
    await this.schedulePersist(true);
  }

  /** Seed ArkWeb's incognito jar without exposing cookies to ArkUI. */
  async arkWebSeeds(sessionId: string): Promise<ArkWebCookieSeed[]> {
    await this.ensureLoaded();
    const normalizedSessionId = this.requireSessionId(sessionId);
    const now = Date.now();
    await this.removeExpiredAndPersist(now);
    const seeds: ArkWebCookieSeed[] = [];
    for (const cookie of this.cookies) {
      if (cookie.sessionId !== normalizedSessionId) {
        continue;
      }
      const attributes: string[] = [`${cookie.name}=${cookie.value}`, `Path=${cookie.path}`];
      if (!cookie.hostOnly) {
        attributes.push(`Domain=${cookie.domain}`);
      }
      if (cookie.expiresAtMs !== null) {
        attributes.push(`Expires=${new Date(cookie.expiresAtMs).toUTCString()}`);
      }
      if (cookie.secure) {
        attributes.push('Secure');
      }
      if (cookie.httpOnly) {
        attributes.push('HttpOnly');
      }
      if (cookie.sameSite !== null) {
        attributes.push(`SameSite=${cookie.sameSite}`);
      }
      seeds.push({
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path,
        url: this.arkWebSeedUrl(cookie.domain, cookie.path),
        header: attributes.join('; '),
      });
    }
    return seeds;
  }

  /**
   * Reconcile the incognito ArkWeb task back into the same source-scoped jar.
   * Only identities seeded into this task are removed when absent; cookies on
   * unrelated source domains remain untouched.
   */
  async reconcileArkWebCookies(
    sessionId: string,
    seeds: ArkWebCookieSeed[],
    observed: ArkWebObservedCookie[],
    expectedGeneration?: number,
  ): Promise<void> {
    await this.ensureLoaded();
    const normalizedSessionId = this.requireSessionId(sessionId);
    if (expectedGeneration !== undefined && expectedGeneration !== this.sessionGeneration(normalizedSessionId)) {
      return;
    }
    let persistentChanged = false;
    for (let index = this.cookies.length - 1; index >= 0; index -= 1) {
      const cookie = this.cookies[index];
      if (cookie.sessionId !== normalizedSessionId || !seeds.some((seed: ArkWebCookieSeed): boolean => {
        return seed.name === cookie.name && seed.domain === cookie.domain && seed.path === cookie.path;
      })) {
        continue;
      }
      persistentChanged = persistentChanged || cookie.expiresAtMs !== null;
      this.cookies.splice(index, 1);
    }
    for (const record of observed) {
      try {
        const domain = this.normalizeDomain(record.domain);
        const path = this.normalizePath(record.path);
        const sameSite = this.normalizeSameSite(record.sameSite);
        if (sameSite === 'None' && !record.secure || !this.isSafeCookieValue(record.value)) {
          continue;
        }
        const cookie: StoredCookie = {
          sessionId: normalizedSessionId,
          name: this.requireCookieName(record.name),
          value: record.value,
          domain,
          path,
          expiresAtMs: this.parseWireExpiry(record.expiresAt),
          secure: record.secure,
          httpOnly: record.httpOnly,
          sameSite,
          // ArkWeb has already applied its mature RFC6265 parser. Reader keeps
          // the captured credential exact-host to avoid persisting cross-host
          // scope without a platform Public Suffix API.
          hostOnly: true,
          createdAt: this.nextCreationSequence(),
        };
        persistentChanged = this.upsert(cookie) || persistentChanged;
      } catch (_) {
        // Keep reconciliation fail-closed when ArkWeb returns a malformed,
        // oversized, or otherwise untrusted cookie record. One bad platform
        // row must not discard the other valid credentials from this job.
      }
    }
    if (persistentChanged) {
      await this.schedulePersist();
    }
  }

  /**
   * ArkWeb requires a URL whose host accepts the Set-Cookie line. HTTPS is a
   * safe seed origin for both Secure and non-Secure cookies; later navigation
   * still applies each cookie's own Secure/Domain/Path constraints.
   */
  private arkWebSeedUrl(domain: string, path: string): string {
    const host = domain.indexOf(':') !== -1 && !domain.startsWith('[') ? `[${domain}]` : domain;
    return `https://${host}${path}`;
  }

  private ensureLoaded(): Promise<void> {
    if (this.loadPromise === null) {
      this.loadPromise = this.loadFromAssetStore().catch((error: Error): void => {
        this.loadPromise = null;
        throw error;
      });
    }
    return this.loadPromise;
  }

  private async loadFromAssetStore(): Promise<void> {
    try { await this.recoverPendingWrite(); } catch (_) {
      hilog.warn(LOG_DOMAIN, LOG_TAG, 'cookie store cleanup deferred');
    }
    const header = await this.readRecordSecret(ASSET_ALIAS);
    if (header === null) {
      return;
    }
    const chunkHeader = this.parseChunkHeader(header);
    let envelope: PersistedCookieEnvelope | null;
    if (chunkHeader === null) {
      // Legacy single-record jar written before chunked persistence.
      envelope = this.parseEnvelope(header);
    } else {
      const payload = chunkHeader.chunkCount === 0 ? null :
        await this.readChunkedPayload(chunkHeader.chunkCount, chunkHeader.generation);
      envelope = chunkHeader.chunkCount === 0 ? { formatVersion: FORMAT_VERSION, cookies: [] } :
        (payload === null ? null : this.parseEnvelope(payload));
    }
    if (envelope === null) {
      // A damaged secure payload must not poison every later cookie
      // operation: degrade to an empty in-memory jar and keep serving.
      hilog.warn(LOG_DOMAIN, LOG_TAG, 'cookie store secure payload is unreadable; starting from an empty jar');
      return;
    }
    const now = Date.now();
    for (const candidate of envelope.cookies) {
      if (this.isStoredCookie(candidate) && candidate.expiresAtMs !== null && candidate.expiresAtMs > now) {
        try {
          this.upsert(candidate);
          this.creationSequence = Math.max(this.creationSequence, candidate.createdAt);
        } catch (_) {
          // Ignore malformed or over-quota persisted entries and continue with
          // the remaining valid source-scoped credentials.
        }
      }
    }
    this.persistedChunkCount = chunkHeader === null ? 0 : chunkHeader.chunkCount;
    this.persistedGeneration = chunkHeader?.generation;
  }

  private schedulePersist(required: boolean = false): Promise<void> {
    const next = this.writeTail.then((): Promise<void> => this.persist());
    // Keep the serialization chain usable after a fault, while a user's
    // explicit clear receives the original rejection.
    this.writeTail = next.catch((): void => {
      hilog.warn(LOG_DOMAIN, LOG_TAG, 'cookie store persistence failed');
    });
    return required ? next : this.writeTail;
  }

  private async persist(): Promise<void> {
    await this.recoverPendingWrite();
    const persistent = this.cookies.filter((cookie: StoredCookie): boolean => {
      return cookie.expiresAtMs !== null && cookie.expiresAtMs > Date.now();
    });
    if (persistent.length > MAX_PERSISTED_COOKIES) { throw new Error('cookie count limit exceeded'); }
    const payload = this.utf8(JSON.stringify({ formatVersion: FORMAT_VERSION, cookies: persistent }));
    if (payload.length > MAX_PERSISTED_BYTES) { throw new Error('cookie byte limit exceeded'); }
    const chunks = persistent.length === 0 ? [] : this.chunkPayload(payload);
    this.generationSequence += 1;
    const generation = `${Date.now().toString(36)}-${this.generationSequence.toString(36)}-${Math.random().toString(36).slice(2)}`;
    const next: PersistedChunkHeader = { formatVersion: 2, generation, chunkCount: chunks.length };
    const oldHeader = await this.readRecordSecret(ASSET_ALIAS);
    const previous = oldHeader === null ? null : this.parseChunkHeader(oldHeader);
    const transaction: CookieWriteTransaction = { next, previous };
    await this.writeRecord(ASSET_PENDING_ALIAS, this.utf8(JSON.stringify(transaction)));
    for (let index = 0; index < chunks.length; index += 1) {
      await this.writeRecord(this.chunkAlias(index, generation), chunks[index]);
    }
    // One Asset overwrite commits the generation, including a durable empty
    // jar. Older binaries reject format 2 instead of loading old chunk aliases.
    await this.writeRecord(ASSET_ALIAS, this.utf8(JSON.stringify(next)));
    this.persistedChunkCount = chunks.length;
    this.persistedGeneration = generation;
    try { await this.recoverPendingWrite(); } catch (_) {
      // The commit is already durable. The journal retains exact garbage
      // ownership for retry, so cleanup failure cannot revive credentials.
      hilog.warn(LOG_DOMAIN, LOG_TAG, 'cookie store cleanup deferred');
    }
  }

  private async recoverPendingWrite(): Promise<void> {
    const pending = await this.readRecordSecret(ASSET_PENDING_ALIAS);
    if (pending === null) { return; }
    let transaction: CookieWriteTransaction;
    try {
      transaction = JSON.parse(util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(pending)) as CookieWriteTransaction;
    } catch (_) {
      // A torn or externally-corrupted journal cannot identify safe garbage
      // ownership. Remove only the journal marker and keep the live header/
      // chunks intact so one bad record cannot permanently block every later
      // cookie write or clear operation.
      await this.removeRecord(ASSET_PENDING_ALIAS);
      return;
    }
    const rawNext = transaction !== null && typeof transaction === 'object' ?
      (transaction as Record<string, unknown>)['next'] : undefined;
    const rawPrevious = transaction !== null && typeof transaction === 'object' ?
      (transaction as Record<string, unknown>)['previous'] : undefined;
    if (rawNext === null || typeof rawNext !== 'object' || Array.isArray(rawNext) ||
      rawPrevious !== null && (rawPrevious === undefined || typeof rawPrevious !== 'object' || Array.isArray(rawPrevious))) {
      await this.removeRecord(ASSET_PENDING_ALIAS);
      return;
    }
    const next = this.parseChunkHeader(this.utf8(JSON.stringify(rawNext)));
    if (next === null || next.generation === undefined) {
      await this.removeRecord(ASSET_PENDING_ALIAS);
      return;
    }
    const previous = rawPrevious === null ? null :
      this.parseChunkHeader(this.utf8(JSON.stringify(rawPrevious)));
    if (rawPrevious !== null && previous === null) {
      await this.removeRecord(ASSET_PENDING_ALIAS);
      return;
    }
    const liveBytes = await this.readRecordSecret(ASSET_ALIAS);
    const live = liveBytes === null ? null : this.parseChunkHeader(liveBytes);
    const garbage = live?.generation === next.generation ? previous : next;
    if (garbage !== null && garbage?.generation !== live?.generation) {
      for (let index = 0; index < garbage.chunkCount; index += 1) {
        await this.removeRecord(this.chunkAlias(index, garbage.generation));
      }
    } else if (garbage !== null && garbage.generation === undefined && live?.generation !== undefined) {
      for (let index = 0; index < garbage.chunkCount; index += 1) { await this.removeRecord(this.chunkAlias(index)); }
    }
    await this.removeRecord(ASSET_PENDING_ALIAS);
  }

  private chunkAlias(index: number, generation?: string): string {
    return generation === undefined ? `${ASSET_CHUNK_ALIAS_PREFIX}${index}` :
      `${ASSET_CHUNK_ALIAS_PREFIX}${generation}/${index}`;
  }

  private chunkPayload(payload: Uint8Array): Uint8Array[] {
    const chunks: Uint8Array[] = [];
    for (let offset = 0; offset < payload.length; offset += ASSET_SECRET_CHUNK_BYTES) {
      chunks.push(payload.subarray(offset, Math.min(offset + ASSET_SECRET_CHUNK_BYTES, payload.length)));
    }
    return chunks;
  }

  private async readChunkedPayload(chunkCount: number, generation?: string): Promise<Uint8Array | null> {
    const parts: Uint8Array[] = [];
    let total = 0;
    for (let index = 0; index < chunkCount; index += 1) {
      const part = await this.readRecordSecret(this.chunkAlias(index, generation));
      if (part === null) {
        hilog.warn(LOG_DOMAIN, LOG_TAG, 'cookie store chunk %{public}d is missing; starting from an empty jar',
          index);
        return null;
      }
      if (part.length > ASSET_SECRET_CHUNK_BYTES ||
        total > MAX_PERSISTED_BYTES - part.length) {
        hilog.warn(LOG_DOMAIN, LOG_TAG, 'cookie store chunk payload exceeds its bounded size');
        return null;
      }
      parts.push(part);
      total += part.length;
    }
    const payload = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      payload.set(part, offset);
      offset += part.length;
    }
    return payload;
  }

  private async readRecordSecret(alias: string): Promise<Uint8Array | null> {
    const query = new Map<asset.Tag, asset.Value>();
    query.set(asset.Tag.ALIAS, this.utf8(alias));
    query.set(asset.Tag.RETURN_TYPE, asset.ReturnType.ALL);
    let records: Array<asset.AssetMap>;
    try {
      records = await asset.query(query);
    } catch (error) {
      if (this.errorCode(error) === asset.ErrorCode.NOT_FOUND) {
        return null;
      }
      throw new Error('cookie store cannot read secure AssetStore');
    }
    if (records.length === 0) {
      return null;
    }
    const secret = records[0].get(asset.Tag.SECRET);
    if (!(secret instanceof Uint8Array)) {
      hilog.warn(LOG_DOMAIN, LOG_TAG, 'cookie store AssetStore record has no secret payload');
      return null;
    }
    return secret;
  }

  private async writeRecord(alias: string, secret: Uint8Array): Promise<void> {
    const attributes = new Map<asset.Tag, asset.Value>();
    attributes.set(asset.Tag.ALIAS, this.utf8(alias));
    attributes.set(asset.Tag.SECRET, secret);
    attributes.set(asset.Tag.ACCESSIBILITY, asset.Accessibility.DEVICE_POWERED_ON);
    attributes.set(asset.Tag.CONFLICT_RESOLUTION, asset.ConflictResolution.OVERWRITE);
    try {
      await asset.add(attributes);
    } catch (error) {
      throw new Error(`cookie store cannot write secure AssetStore: ${this.errorMessage(error)}`);
    }
  }

  private async removeRecord(alias: string): Promise<void> {
    const query = new Map<asset.Tag, asset.Value>();
    query.set(asset.Tag.ALIAS, this.utf8(alias));
    try {
      await asset.remove(query);
    } catch (error) {
      if (this.errorCode(error) !== asset.ErrorCode.NOT_FOUND) {
        throw new Error(`cookie store cannot clear secure AssetStore: ${this.errorMessage(error)}`);
      }
    }
  }

  private parseChunkHeader(secret: Uint8Array): PersistedChunkHeader | null {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(secret)) as
        Record<string, unknown>;
    } catch (error) {
      return null;
    }
    const chunkCount = parsed['chunkCount'];
    const version = parsed['formatVersion'];
    const generation = parsed['generation'];
    if (typeof chunkCount !== 'number' || !Number.isSafeInteger(chunkCount) ||
      chunkCount < 0 || chunkCount > MAX_PERSISTED_CHUNKS) { return null; }
    if (version === 1 && chunkCount > 0) { return { formatVersion: 1, chunkCount }; }
    if (version === 2 && typeof generation === 'string' && /^[a-z0-9-]{8,100}$/.test(generation)) {
      return { formatVersion: 2, chunkCount, generation };
    }
    return null;
  }

  private parseEnvelope(secret: Uint8Array): PersistedCookieEnvelope | null {
    try {
      const parsed = JSON.parse(util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(secret)) as
        PersistedCookieEnvelope;
      if (parsed.formatVersion !== FORMAT_VERSION || !Array.isArray(parsed.cookies)) {
        return null;
      }
      return parsed;
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse one untrusted response header. Browser cookie jars ignore malformed
   * Set-Cookie lines; do the same here so a single hostile header cannot turn
   * an otherwise successful HTTP response into a failed source request.
   */
  private parseSetCookie(sessionId: string, requestUrl: url.URL, header: string): StoredCookie | null {
    try {
      return this.parseSetCookieUnsafe(sessionId, requestUrl, header);
    } catch (_) {
      return null;
    }
  }

  private parseSetCookieUnsafe(sessionId: string, requestUrl: url.URL, header: string): StoredCookie | null {
    const sections = header.split(';');
    const first = sections.shift()?.trim() ?? '';
    const separator = first.indexOf('=');
    if (separator <= 0) {
      return null;
    }
    const name = this.requireCookieName(first.substring(0, separator).trim());
    const value = first.substring(separator + 1).trim();
    if (!this.isSafeCookieValue(value)) {
      return null;
    }
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
        if (!isExactCookieDomainScope(requestUrl.hostname, requestedDomain)) {
          return null;
        }
        domain = requestedDomain;
        hostOnly = true;
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
    if (secure && requestUrl.protocol.toLowerCase() !== 'https:') {
      return null;
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
    this.assertCookieShape(cookie);
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
    this.assertCookieBudget(cookie, index);
    if (index >= 0) {
      cookie.createdAt = this.cookies[index].createdAt;
      this.cookies[index] = cookie;
    } else {
      this.cookies.push(cookie);
    }
    return previousPersistent || cookie.expiresAtMs !== null;
  }

  private assertCookieBudget(cookie: StoredCookie, replacingIndex: number): void {
    const incomingBytes = this.cookieBytes(cookie);
    let totalCount = 0;
    let totalBytes = 0;
    let sessionCount = 0;
    let sessionBytes = 0;
    for (let index = 0; index < this.cookies.length; index += 1) {
      if (index === replacingIndex) continue;
      const current = this.cookies[index];
      const bytes = this.cookieBytes(current);
      totalCount += 1;
      totalBytes += bytes;
      if (current.sessionId === cookie.sessionId) {
        sessionCount += 1;
        sessionBytes += bytes;
      }
    }
    const adding = replacingIndex < 0 ? 1 : 0;
    if (sessionCount + adding > MAX_SESSION_COOKIES ||
      sessionBytes + incomingBytes > MAX_SESSION_COOKIE_BYTES ||
      totalCount + adding > MAX_TOTAL_COOKIES ||
      totalBytes + incomingBytes > MAX_TOTAL_COOKIE_BYTES) {
      throw new Error('cookie store quota exceeded');
    }
  }

  private cookieBytes(cookie: StoredCookie): number {
    return this.utf8(cookie.sessionId).byteLength + this.utf8(cookie.name).byteLength +
      this.utf8(cookie.value).byteLength + this.utf8(cookie.domain).byteLength +
      this.utf8(cookie.path).byteLength;
  }

  private isSafeCookieName(value: string): boolean {
    return value.length > 0 && value.length <= MAX_COOKIE_NAME_LENGTH &&
      !/[\s;,=\u0000-\u001f\u007f]/.test(value);
  }

  private isSafeCookieValue(value: string): boolean {
    return value.length <= MAX_COOKIE_VALUE_LENGTH &&
      !/[;,\u0000-\u001f\u007f]/.test(value);
  }

  private isSafeCookiePath(value: string): boolean {
    return value.length > 0 && value.length <= MAX_COOKIE_PATH_LENGTH &&
      value.startsWith('/') && !/[;?#[\\]\u0000-\u001f\u007f]/.test(value);
  }

  private isSafeCookieDomain(value: string): boolean {
    return value.length > 0 && value.length <= 255 &&
      !/[\s/@?#\\[\],:;=\u0000-\u001f\u007f]/.test(value);
  }

  private assertCookieShape(cookie: StoredCookie): void {
    if (cookie.sessionId.trim() !== cookie.sessionId || cookie.sessionId.length === 0 ||
      cookie.sessionId.length > MAX_SESSION_ID_LENGTH || !this.isSafeCookieName(cookie.name) ||
      !this.isSafeCookieValue(cookie.value) || !this.isSafeCookieDomain(cookie.domain) ||
      !this.isSafeCookiePath(cookie.path) ||
      (cookie.expiresAtMs !== null && (!Number.isFinite(cookie.expiresAtMs) || cookie.expiresAtMs < 0)) ||
      !Number.isFinite(cookie.createdAt)) {
      throw new Error('cookie value or scope is invalid');
    }
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
    if (trimmed.length === 0 || trimmed.length > MAX_SESSION_ID_LENGTH ||
      /[\u0000-\u001f\u007f]/.test(trimmed)) {
      throw new Error(`cookie session id must contain 1..${MAX_SESSION_ID_LENGTH} characters`);
    }
    return trimmed;
  }

  private requireCookieName(value: unknown): string {
    if (typeof value !== 'string') {
      throw new Error('cookie name must be a string');
    }
    const trimmed = value.trim();
    if (!this.isSafeCookieName(trimmed) || /[\s;,=]/.test(trimmed)) {
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
    return errorMessageOf(error);
  }

  private isStoredCookie(value: unknown): value is StoredCookie {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    const cookie = value as Partial<StoredCookie>;
    return typeof cookie.sessionId === 'string' && cookie.sessionId.trim() === cookie.sessionId &&
      cookie.sessionId.length > 0 && cookie.sessionId.length <= MAX_SESSION_ID_LENGTH &&
      !/[\u0000-\u001f\u007f]/.test(cookie.sessionId) && typeof cookie.name === 'string' &&
      this.isSafeCookieName(cookie.name) && typeof cookie.value === 'string' &&
      this.isSafeCookieValue(cookie.value) && typeof cookie.domain === 'string' &&
      this.isSafeCookieDomain(cookie.domain) && typeof cookie.path === 'string' &&
      this.isSafeCookiePath(cookie.path) &&
      (cookie.expiresAtMs === null || typeof cookie.expiresAtMs === 'number' &&
        Number.isFinite(cookie.expiresAtMs) && cookie.expiresAtMs >= 0) &&
      typeof cookie.secure === 'boolean' && typeof cookie.httpOnly === 'boolean' &&
      (cookie.sameSite === null || cookie.sameSite === 'Strict' || cookie.sameSite === 'Lax' ||
        cookie.sameSite === 'None') && cookie.hostOnly === true &&
      typeof cookie.createdAt === 'number' && Number.isFinite(cookie.createdAt);
  }
}
