// CoreHostAdapter — Core closed-set HostCapability helpers.
//
// This adapter contains capabilities that are requested by Reader-Core over the
// NAPI host.request boundary but are not part of the Reader UI HostRequest enum.
// UI-only adapters stay in their own files and are not registered with
// HostCapabilityRegistry.
//
// persistence.* backend: @ohos.data.preferences (true on-disk persistence,
// keyed by `namespace:key` and serialized as JSON). When no common.Context is
// available (unit-test environment without a UIAbility), the adapter falls
// back to an in-process Map so persistence.get/put remain callable — this
// mirrors the FileHostAdapter null-without-context boundary but keeps the
// capability registered for HostSmoke structural assertions. On device,
// EntryAbility passes its context so persistence survives app restarts.

import dataPreferences from '@ohos.data.preferences';
import common from '@ohos.app.ability.common';
import fs from '@ohos.file.fs';
import util from '@ohos.util';
import {
  HostCacheGetRequest,
  HostCacheGetResponse,
  HostCachePutRequest,
  HostCachePutResponse,
  HostPersistenceGetRequest,
  HostPersistenceGetResponse,
  HostPersistencePutRequest,
  HostPersistencePutResponse,
  HostLogEmitRequest,
  HostLogEmitResponse,
  HostTimeNowRequest,
  HostTimeNowResponse,
  HostSystemInfoRequest,
  HostSystemInfoResponse,
  HostMediaDownloadRequest,
  HostMediaDownloadResponse,
  HostHttpRequest,
  HostError,
  HostErrorWrapper,
} from '../types';
import { HttpHostAdapter, MEDIA_DOWNLOAD_DEFAULT_MAX_BYTES } from './HttpHostAdapter';
import { FileHostAdapter } from './FileHostAdapter';

interface CacheEntry {
  value?: string;
  valueBase64?: string;
  expiresAtMillis?: number;
}

interface PersistenceEntry {
  value?: string;
  valueBase64?: string;
  revision: string;
}

class SystemInfoPayload {
  platform?: string;
  os?: string;
  runtime?: string;
  timestamp?: number;
}

function compositeKey(namespace: string, key: string): string {
  return `${namespace}:${key}`;
}

function iso8601(millis: number): string {
  return new Date(millis).toISOString();
}

function firstHeader(headers: Record<string, string | string[]> | undefined,
  name: string): string | undefined {
  if (headers === undefined) return undefined;
  const keys = Object.keys(headers);
  const normalizedName = name.toLowerCase().replace(/[-_]/g, '');
  for (let index = 0; index < keys.length; index++) {
    if (keys[index].toLowerCase().replace(/[-_]/g, '') !== normalizedName) continue;
    const value = headers[keys[index]];
    return value instanceof Array ? value[0] : value;
  }
  return undefined;
}

function downloadFailure(message: string, url: string, status?: number): HostErrorWrapper {
  const error: HostError = {
    code: 'DOWNLOAD_FAILED',
    message: message,
    retryable: status !== undefined && status >= 500,
    details: { phase: 'Transport', url: url },
  };
  if (status !== undefined) error.details = { phase: 'Transport', url: url, status: status };
  return new HostErrorWrapper(error);
}

const PREFERENCES_NAME: string = 'reader_persistence';
// A full Core StorageSnapshot can contain local-book chapter text, so it must
// not be stored as one Preferences value. Keep the protocol namespace/key
// opaque and route only this Core-owned blob to an app-private atomic file.
const CORE_STORAGE_NAMESPACE: string = 'reader-core.storage';
const CORE_STORAGE_KEY: string = 'snapshot-v1';
const CORE_STORAGE_DIR: string = 'reader-core';
const CORE_STORAGE_FILE: string = 'snapshot-v1.json';
const ENOENT_CODE: number = 13900002;

interface FsErrorLike {
  code?: number;
  message?: string;
}

export class CoreHostAdapter {
  private cache: Map<string, CacheEntry> = new Map<string, CacheEntry>();
  // On-device persistence backend (Preferences). When context is null
  // (unit-test env), persistenceGet/Put fall back to `persistenceFallback`
  // so the capability remains callable without a HarmonyOS runtime.
  private context: common.Context | null = null;
  private preferences: dataPreferences.Preferences | null = null;
  private persistenceFallback: Map<string, PersistenceEntry> = new Map<string, PersistenceEntry>();
  // Preferences exposes async read/put/flush operations. Chain writers before
  // their first await so two requests carrying the same expectedRevision
  // cannot both pass the read side of the CAS.
  private persistenceWriteTail: Promise<void> = Promise.resolve();

  constructor(context?: common.Context) {
    this.context = context ?? null;
  }

  cacheGet(request: HostCacheGetRequest): HostCacheGetResponse {
    const key = compositeKey(request.namespace, request.key);
    const entry = this.cache.get(key);
    if (entry === undefined) {
      return { hit: false };
    }
    if (entry.expiresAtMillis !== undefined && entry.expiresAtMillis < Date.now()) {
      this.cache.delete(key);
      return { hit: false };
    }
    const response: HostCacheGetResponse = { hit: true };
    if (entry.value !== undefined) {
      response.value = entry.value;
    }
    if (entry.valueBase64 !== undefined) {
      response.valueBase64 = entry.valueBase64;
    }
    if (entry.expiresAtMillis !== undefined) {
      response.expiresAt = iso8601(entry.expiresAtMillis);
    }
    return response;
  }

  cachePut(request: HostCachePutRequest): HostCachePutResponse {
    const expiresAtMillis = request.ttlMillis !== undefined
      ? Date.now() + request.ttlMillis
      : undefined;
    const entry: CacheEntry = {};
    if (request.value !== undefined) {
      entry.value = request.value;
    }
    if (request.valueBase64 !== undefined) {
      entry.valueBase64 = request.valueBase64;
    }
    if (expiresAtMillis !== undefined) {
      entry.expiresAtMillis = expiresAtMillis;
    }
    this.cache.set(compositeKey(request.namespace, request.key), entry);
    const response: HostCachePutResponse = { stored: true };
    if (expiresAtMillis !== undefined) {
      response.expiresAt = iso8601(expiresAtMillis);
    }
    return response;
  }

  /** UI-contract cache.clear. Core never requests this over the closed Host
   * bus, so Reducer/Effects invoke it directly on the Host cache owner. */
  cacheClear(namespace?: string): number {
    if (namespace === undefined || namespace.length === 0 || namespace === 'all') {
      const count = this.cache.size;
      this.cache.clear();
      return count;
    }
    const prefix = `${namespace}:`;
    const keys = Array.from(this.cache.keys());
    let cleared = 0;
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].startsWith(prefix) && this.cache.delete(keys[i])) {
        cleared += 1;
      }
    }
    return cleared;
  }

  async persistenceGet(request: HostPersistenceGetRequest): Promise<HostPersistenceGetResponse> {
    const key = compositeKey(request.namespace, request.key);
    // Fallback path: in-process Map (unit-test env without context).
    if (this.context === null) {
      const entry = this.persistenceFallback.get(key);
      if (entry === undefined) {
        return { found: false };
      }
      return this.buildGetResponse(entry);
    }
    if (this.isCoreStorageSnapshot(request)) {
      try {
        const entry = this.readCoreStorageSnapshot();
        if (entry === undefined) {
          return { found: false };
        }
        return this.buildGetResponse(entry);
      } catch (e) {
        // A corrupt snapshot must fail the Core restore handshake rather than
        // masquerade as a miss and later being overwritten by an empty state.
        throw new Error(`CoreHostAdapter.persistenceGet Core snapshot failed: ${e}`);
      }
    }
    // Device path: @ohos.data.preferences (true on-disk persistence).
    try {
      const pref = await this.ensurePreferences();
      const has = await pref.has(key);
      if (!has) {
        return { found: false };
      }
      const raw = await pref.get(key, '') as string;
      const entry = this.deserializeEntry(raw);
      if (entry === null) {
        return { found: false };
      }
      return this.buildGetResponse(entry);
    } catch (e) {
      throw new Error(`CoreHostAdapter.persistenceGet key=${key} failed: ${e}`);
    }
  }

  async persistencePut(request: HostPersistencePutRequest): Promise<HostPersistencePutResponse> {
    const previous = this.persistenceWriteTail;
    let release: () => void = (): void => {};
    this.persistenceWriteTail = new Promise<void>((resolve): void => {
      release = (): void => { resolve(); };
    });
    await previous;
    try {
      return await this.persistencePutLocked(request);
    } finally {
      release();
    }
  }

  private async persistencePutLocked(request: HostPersistencePutRequest): Promise<HostPersistencePutResponse> {
    const key = compositeKey(request.namespace, request.key);
    // Fallback path: in-process Map (unit-test env without context).
    if (this.context === null) {
      const current = this.persistenceFallback.get(key);
      return this.applyPut(this.persistenceFallback, key, current, request);
    }
    if (this.isCoreStorageSnapshot(request)) {
      try {
        const current = this.readCoreStorageSnapshot();
        const nextRevision = this.checkAndComputeRevision(current, request);
        const entry: PersistenceEntry = { revision: nextRevision };
        if (request.value !== undefined) {
          entry.value = request.value;
        }
        if (request.valueBase64 !== undefined) {
          entry.valueBase64 = request.valueBase64;
        }
        this.writeCoreStorageSnapshot(entry);
        return { stored: true, revision: nextRevision };
      } catch (e) {
        throw new Error(`CoreHostAdapter.persistencePut Core snapshot failed: ${e}`);
      }
    }
    // Device path: @ohos.data.preferences. Read-modify-write preserves the
    // expectedRevision optimistic-concurrency check; flush() persists to disk.
    try {
      const pref = await this.ensurePreferences();
      const has = await pref.has(key);
      let current: PersistenceEntry | undefined = undefined;
      if (has) {
        const raw = await pref.get(key, '') as string;
        current = this.deserializeEntry(raw) ?? undefined;
      }
      const nextRevision = this.checkAndComputeRevision(current, request);
      const entry: PersistenceEntry = { revision: nextRevision };
      if (request.value !== undefined) {
        entry.value = request.value;
      }
      if (request.valueBase64 !== undefined) {
        entry.valueBase64 = request.valueBase64;
      }
      await pref.put(key, JSON.stringify(entry));
      await pref.flush();
      return { stored: true, revision: nextRevision };
    } catch (e) {
      throw new Error(`CoreHostAdapter.persistencePut key=${key} failed: ${e}`);
    }
  }

  // ── persistence helpers ──

  private async ensurePreferences(): Promise<dataPreferences.Preferences> {
    try {
      if (this.preferences !== null) {
        return this.preferences;
      }
      // context is non-null here — callers gate on this.context === null first.
      this.preferences = await dataPreferences.getPreferences(this.context as common.Context, PREFERENCES_NAME);
      return this.preferences;
    } catch (e) {
      throw new Error(`CoreHostAdapter.ensurePreferences failed: ${e}`);
    }
  }

  private isCoreStorageSnapshot(request: HostPersistenceGetRequest | HostPersistencePutRequest): boolean {
    return request.namespace === CORE_STORAGE_NAMESPACE && request.key === CORE_STORAGE_KEY;
  }

  private coreStorageSnapshotPath(): string {
    if (this.context === null) {
      throw new Error('Core storage snapshot requires application context');
    }
    return this.context.filesDir + '/' + CORE_STORAGE_DIR + '/' + CORE_STORAGE_FILE;
  }

  /**
   * Read the snapshot envelope from the app-private file. `undefined` is a
   * genuine first-run miss; malformed JSON is a hard error so Core keeps its
   * empty in-memory store disabled for persistence instead of overwriting data.
   */
  private readCoreStorageSnapshot(): PersistenceEntry | undefined {
    const path = this.coreStorageSnapshotPath();
    let size = 0;
    try {
      size = fs.statSync(path).size;
    } catch (e) {
      if (this.isNotFound(e as Object)) {
        return undefined;
      }
      throw new Error(`Core storage snapshot stat failed: ${e}`);
    }
    const file = fs.openSync(path, fs.OpenMode.READ_ONLY);
    try {
      if (size <= 0) {
        throw new Error('Core storage snapshot is empty');
      }
      const buffer = new ArrayBuffer(size);
      fs.readSync(file.fd, buffer);
      const decoder = util.TextDecoder.create('utf-8');
      const raw = decoder.decodeToString(new Uint8Array(buffer));
      const entry = this.deserializeEntry(raw);
      if (entry === null) {
        throw new Error('Core storage snapshot envelope is malformed');
      }
      return entry;
    } finally {
      fs.closeSync(file);
    }
  }

  /**
   * Write → fsync → rename gives the Core snapshot all-or-nothing replacement
   * semantics inside the app sandbox. The persisted revision is carried in
   * the envelope, so a restart can continue the HostPersistence CAS chain.
   */
  private writeCoreStorageSnapshot(entry: PersistenceEntry): void {
    const path = this.coreStorageSnapshotPath();
    const slash = path.lastIndexOf('/');
    const dir = slash > 0
      ? path.substring(0, slash)
      : (this.context as common.Context).filesDir;
    try {
      fs.mkdirSync(dir, true);
    } catch (e) {
      // Existing directory is the expected path; openSync below surfaces a
      // real permission or path failure.
    }
    const temp = path + '.tmp';
    const file = fs.openSync(temp, fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC);
    try {
      fs.writeSync(file.fd, JSON.stringify(entry));
      fs.fsyncSync(file.fd);
    } finally {
      fs.closeSync(file);
    }
    try {
      fs.renameSync(temp, path);
    } catch (e) {
      try {
        fs.unlinkSync(temp);
      } catch (cleanupError) {
        // Best effort only; preserve the original rename failure.
      }
      throw new Error(`Core storage snapshot rename failed: ${e}`);
    }
  }

  private isNotFound(error: Object): boolean {
    const value = error as FsErrorLike;
    if (value.code === ENOENT_CODE) {
      return true;
    }
    const message = value.message ?? '';
    const lower = message.toLowerCase();
    return lower.includes('no such file') || lower.includes('does not exist') || lower.includes('not exist');
  }

  private buildGetResponse(entry: PersistenceEntry): HostPersistenceGetResponse {
    const response: HostPersistenceGetResponse = {
      found: true,
      revision: entry.revision,
    };
    if (entry.value !== undefined) {
      response.value = entry.value;
    }
    if (entry.valueBase64 !== undefined) {
      response.valueBase64 = entry.valueBase64;
    }
    return response;
  }

  // Deserialize a JSON string stored in Preferences back into a PersistenceEntry.
  // Returns null if the stored value is corrupt/unparseable (treated as miss).
  private deserializeEntry(raw: string): PersistenceEntry | null {
    if (raw.length === 0) {
      return null;
    }
    try {
      const entry = JSON.parse(raw) as PersistenceEntry;
      if (typeof entry.revision !== 'string') {
        return null;
      }
      return entry;
    } catch (e) {
      return null;
    }
  }

  // Validate expectedRevision (optimistic concurrency) and compute the next
  // monotonically-increasing revision string. Throws on mismatch.
  private checkAndComputeRevision(
    current: PersistenceEntry | undefined,
    request: HostPersistencePutRequest,
  ): string {
    const currentRevision = current?.revision ?? '0';
    if (request.expectedRevision !== undefined && request.expectedRevision !== currentRevision) {
      throw new Error(`persistence.put revision mismatch: expected ${request.expectedRevision}, got ${currentRevision}`);
    }
    const revision = Number(currentRevision);
    if (!Number.isSafeInteger(revision) || revision < 0 || revision >= 9007199254740991) {
      throw new Error('persistence.put stored revision is corrupt or exhausted');
    }
    return `${revision + 1}`;
  }

  // Map-based put (fallback path). Keeps the same revision semantics as the
  // Preferences path so behavior is identical in the unit-test environment.
  private applyPut(
    store: Map<string, PersistenceEntry>,
    key: string,
    current: PersistenceEntry | undefined,
    request: HostPersistencePutRequest,
  ): HostPersistencePutResponse {
    const nextRevision = this.checkAndComputeRevision(current, request);
    const entry: PersistenceEntry = { revision: nextRevision };
    if (request.value !== undefined) {
      entry.value = request.value;
    }
    if (request.valueBase64 !== undefined) {
      entry.valueBase64 = request.valueBase64;
    }
    store.set(key, entry);
    return { stored: true, revision: nextRevision };
  }

  logEmit(request: HostLogEmitRequest): HostLogEmitResponse {
    const target = request.target ?? 'ReaderCore';
    const fields = request.fields !== undefined ? JSON.stringify(request.fields) : '';
    console.info(`[${target}] ${request.level}: ${request.message} ${fields}`);
    return { emitted: true };
  }

  timeNow(request: HostTimeNowRequest): HostTimeNowResponse {
    const now = Date.now();
    const response: HostTimeNowResponse = {
      unixMillis: now,
      iso8601: iso8601(now),
    };
    if (request.timezone !== undefined && request.timezone.length > 0) {
      response.timezone = request.timezone;
    }
    return response;
  }

  systemInfo(request: HostSystemInfoRequest): HostSystemInfoResponse {
    const info = new SystemInfoPayload();
    info.platform = 'harmonyos';
    info.os = 'harmonyos';
    info.runtime = 'arkts';
    info.timestamp = Date.now();
    if (request.keys !== undefined && request.keys.length > 0) {
      const filtered = new SystemInfoPayload();
      for (let i = 0; i < request.keys.length; i++) {
        const key = request.keys[i];
        if (key === 'platform') {
          filtered.platform = info.platform;
        } else if (key === 'os') {
          filtered.os = info.os;
        } else if (key === 'runtime') {
          filtered.runtime = info.runtime;
        } else if (key === 'timestamp') {
          filtered.timestamp = info.timestamp;
        }
      }
      return { info: filtered };
    }
    return { info };
  }

  async mediaDownload(
    request: HostMediaDownloadRequest,
    httpAdapter: HttpHostAdapter,
    fileAdapter: FileHostAdapter | null
  ): Promise<HostMediaDownloadResponse> {
    if (fileAdapter === null) {
      throw new Error('media.download requires a FileHostAdapter context');
    }
    const resourceId = request.cacheKey ?? `media-${Date.now()}`;
    const savePath = request.savePath ?? `cache://${resourceId}`;
    const headers: Record<string, string> = {};
    if (request.headers !== undefined) {
      const requestHeaderKeys = Object.keys(request.headers);
      for (let index = 0; index < requestHeaderKeys.length; index++) {
        const key = requestHeaderKeys[index];
        headers[key] = request.headers[key];
      }
    }
    if (request.rangeStart !== undefined || request.rangeEnd !== undefined) {
      const start = request.rangeStart ?? 0;
      const end = request.rangeEnd;
      if (!Number.isFinite(start) || start < 0 || Math.floor(start) !== start ||
        (end !== undefined && (!Number.isFinite(end) || end < start || Math.floor(end) !== end))) {
        throw downloadFailure('media.download range must be a non-negative ordered byte range', request.url);
      }
      headers['Range'] = `bytes=${start}-${end === undefined ? '' : end}`;
    }
    if (request.ifNoneMatch !== undefined) headers['If-None-Match'] = request.ifNoneMatch;
    if (request.ifModifiedSince !== undefined) headers['If-Modified-Since'] = request.ifModifiedSince;
    const httpRequest: HostHttpRequest = {
      url: request.url,
      method: request.method ?? 'GET',
      headers: headers,
      sessionId: request.sessionId,
    };
    const streamed = await httpAdapter.downloadToFile(
      httpRequest,
      fileAdapter,
      savePath,
      `media-download-${resourceId}-${Date.now()}`,
      request.maxBytes ?? MEDIA_DOWNLOAD_DEFAULT_MAX_BYTES,
      request.timeoutMillis ?? 15000,
    );
    const response = streamed.response;
    if ((response.status < 200 || response.status >= 300) && response.status !== 304) {
      throw downloadFailure(`media.download returned HTTP ${response.status}`, request.url, response.status);
    }
    const contentType = firstHeader(response.headers, 'content-type');
    const etag = firstHeader(response.headers, 'etag');
    const declaredLength = Number(firstHeader(response.headers, 'content-length'));
    const contentLength = Number.isFinite(declaredLength) && declaredLength >= 0
      ? declaredLength
      : undefined;
    return {
      resourceId,
      tempPath: savePath,
      statusCode: response.status,
      contentType,
      contentLength,
      etag,
      byteLength: streamed.byteLength,
      fromCache: response.status === 304,
      finalUrl: response.finalUrl ?? request.url,
    };
  }
}
