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
} from '../types';
import { HttpHostAdapter } from './HttpHostAdapter';
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

const PREFERENCES_NAME: string = 'reader_persistence';

export class CoreHostAdapter {
  private cache: Map<string, CacheEntry> = new Map<string, CacheEntry>();
  // On-device persistence backend (Preferences). When context is null
  // (unit-test env), persistenceGet/Put fall back to `persistenceFallback`
  // so the capability remains callable without a HarmonyOS runtime.
  private context: common.Context | null = null;
  private preferences: dataPreferences.Preferences | null = null;
  private persistenceFallback: Map<string, PersistenceEntry> = new Map<string, PersistenceEntry>();

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
    // Device path: @ohos.data.preferences (true on-disk persistence).
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
  }

  async persistencePut(request: HostPersistencePutRequest): Promise<HostPersistencePutResponse> {
    const key = compositeKey(request.namespace, request.key);
    // Fallback path: in-process Map (unit-test env without context).
    if (this.context === null) {
      const current = this.persistenceFallback.get(key);
      return this.applyPut(this.persistenceFallback, key, current, request);
    }
    // Device path: @ohos.data.preferences. Read-modify-write preserves the
    // expectedRevision optimistic-concurrency check; flush() persists to disk.
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
  }

  // ── persistence helpers ──

  private async ensurePreferences(): Promise<dataPreferences.Preferences> {
    if (this.preferences !== null) {
      return this.preferences;
    }
    // context is non-null here — callers gate on this.context === null first.
    this.preferences = await dataPreferences.getPreferences(this.context as common.Context, PREFERENCES_NAME);
    return this.preferences;
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
    return `${Number(currentRevision) + 1}`;
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
    const httpRequest: HostHttpRequest = {
      url: request.url,
      method: request.method ?? 'GET',
      headers: request.headers ?? {},
      sessionId: request.sessionId,
    };
    const response = await httpAdapter.execute(httpRequest);
    const body = response.body ?? '';
    if ((request.method ?? 'GET') !== 'HEAD' && response.status !== 304) {
      await fileAdapter.write({
        path: savePath,
        content: body,
        createDirectories: true,
      });
    }
    const contentTypeValue = response.headers?.['content-type'];
    const contentType = contentTypeValue instanceof Array ? contentTypeValue[0] : contentTypeValue;
    const etagValue = response.headers?.['etag'];
    const etag = etagValue instanceof Array ? etagValue[0] : etagValue;
    return {
      resourceId,
      tempPath: savePath,
      statusCode: response.status,
      contentType,
      etag,
      byteLength: body.length,
      fromCache: response.status === 304,
      finalUrl: response.finalUrl ?? request.url,
    };
  }
}
