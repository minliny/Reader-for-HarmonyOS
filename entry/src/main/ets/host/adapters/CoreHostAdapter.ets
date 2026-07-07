// CoreHostAdapter — Core closed-set HostCapability helpers.
//
// This adapter contains capabilities that are requested by Reader-Core over the
// NAPI host.request boundary but are not part of the Reader UI HostRequest enum.
// UI-only adapters stay in their own files and are not registered with
// HostCapabilityRegistry.

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

export class CoreHostAdapter {
  private cache: Map<string, CacheEntry> = new Map<string, CacheEntry>();
  private persistence: Map<string, PersistenceEntry> = new Map<string, PersistenceEntry>();

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

  persistenceGet(request: HostPersistenceGetRequest): HostPersistenceGetResponse {
    const entry = this.persistence.get(compositeKey(request.namespace, request.key));
    if (entry === undefined) {
      return { found: false };
    }
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

  persistencePut(request: HostPersistencePutRequest): HostPersistencePutResponse {
    const key = compositeKey(request.namespace, request.key);
    const current = this.persistence.get(key);
    const currentRevision = current?.revision ?? '0';
    if (request.expectedRevision !== undefined && request.expectedRevision !== currentRevision) {
      throw new Error(`persistence.put revision mismatch: expected ${request.expectedRevision}, got ${currentRevision}`);
    }
    const nextRevision = `${Number(currentRevision) + 1}`;
    const entry: PersistenceEntry = { revision: nextRevision };
    if (request.value !== undefined) {
      entry.value = request.value;
    }
    if (request.valueBase64 !== undefined) {
      entry.valueBase64 = request.valueBase64;
    }
    this.persistence.set(key, entry);
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
