// SourceImageCache — protected, binary-only cover downloader for persisted
// Core sources.  `source.imageRequest` gives us a Core-built HostHttpRequest
// descriptor; this adapter owns the actual byte stream and the app-private
// cache.  It deliberately does not reuse HttpHostAdapter.execute(), whose
// response body is text-oriented and would corrupt binary image data.
//
// Security boundary:
// - only Core-generated GET http(s) descriptors are accepted;
// - source/login/session headers are resolved by HttpHostAdapter, never UI;
// - only 2xx image responses below the bounded byte budget are persisted;
// - writes go to a .part file and are atomically renamed on dataEnd;
// - callers receive a file:// URI, never the original remote URL.
import http from '@ohos.net.http';
import fs from '@ohos.file.fs';
import util from '@ohos.util';
import cryptoFramework from '@ohos.security.cryptoFramework';
import { type HostHttpRequest } from '../types';

export const SOURCE_IMAGE_CACHE_DIRECTORY: string = 'reader-covers-v1';
export const SOURCE_IMAGE_MAX_BYTES: number = 8 * 1024 * 1024;
export const SOURCE_IMAGE_CACHE_MAX_BYTES: number = 48 * 1024 * 1024;
export const SOURCE_IMAGE_CACHE_MAX_FILES: number = 96;
export const SOURCE_IMAGE_CACHE_TTL_MILLIS: number = 7 * 24 * 60 * 60 * 1000;

const IMAGE_SUFFIX: string = '.img';
const PART_SUFFIX: string = '.part';
const HTTP_SCHEME: RegExp = /^https?:\/\//i;

/** The same header preparation used by textual Core http.execute requests. */
export interface SourceImageHeaderResolver {
  buildRequestHeaders(request: HostHttpRequest): Record<string, string>;
}

/** Narrow stream seam.  Unit tests can supply a deterministic fake without
 * calling the platform network stack. */
export interface SourceImageStreamClient {
  onHeaders(callback: (headers: Object) => void): void;
  onData(callback: (chunk: ArrayBuffer) => void): void;
  onEnd(callback: () => void): void;
  request(url: string, options: http.HttpRequestOptions): Promise<number>;
  destroy(): void;
}

export interface SourceImageStreamClientFactory {
  create(): SourceImageStreamClient;
}

/** Small storage seam makes the byte policy testable without a sandbox. */
export interface SourceImageFileStore {
  getCachedUri(key: string): string | null;
  openPart(key: string): void;
  appendPart(key: string, chunk: ArrayBuffer): void;
  commitPart(key: string): string;
  discardPart(key: string): void;
  cleanup(): void;
}

interface CacheRecord {
  path: string;
  size: number;
  mtime: number;
}

interface FsErrorLike {
  code?: number;
}

class PlatformSourceImageStreamClient implements SourceImageStreamClient {
  private readonly client: http.HttpRequest = http.createHttp();

  onHeaders(callback: (headers: Object) => void): void {
    this.client.on('headersReceive', callback);
  }

  onData(callback: (chunk: ArrayBuffer) => void): void {
    this.client.on('dataReceive', callback);
  }

  onEnd(callback: () => void): void {
    this.client.on('dataEnd', callback);
  }

  request(url: string, options: http.HttpRequestOptions): Promise<number> {
    return this.client.requestInStream(url, options);
  }

  destroy(): void {
    this.client.destroy();
  }
}

class PlatformSourceImageStreamClientFactory implements SourceImageStreamClientFactory {
  create(): SourceImageStreamClient {
    return new PlatformSourceImageStreamClient();
  }
}

class PlatformSourceImageFileStore implements SourceImageFileStore {
  private readonly root: string;
  // `File` is intentionally not named here: the ArkTS compiler does not
  // expose the global declaration in every target. `openSync()` returns its
  // stable numeric fd, which is all the stream writer/closer needs.
  private activePart: Map<string, number> = new Map<string, number>();

  constructor(cacheDir: string) {
    this.root = `${cacheDir}/${SOURCE_IMAGE_CACHE_DIRECTORY}`;
  }

  getCachedUri(key: string): string | null {
    this.ensureRoot();
    const path = this.finalPath(key);
    try {
      const stat = fs.statSync(path);
      if (!stat.isFile() || stat.size <= 0 || stat.size > SOURCE_IMAGE_MAX_BYTES || this.isExpired(stat.mtime)) {
        this.unlinkQuietly(path);
        return null;
      }
      return this.fileUri(path);
    } catch (_error) {
      return null;
    }
  }

  openPart(key: string): void {
    this.ensureRoot();
    // Two visible cards can ask for the same protected cover during one
    // frame. Do not let the later request close/unlink the first stream's
    // .part file. The later caller fails closed to its placeholder; the next
    // render gets the completed deterministic cache hit.
    if (this.activePart.has(key)) {
      throw new Error('source image cache key already downloading');
    }
    this.discardPart(key);
    const file = fs.openSync(
      this.partPath(key),
      fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC,
    );
    this.activePart.set(key, file.fd);
  }

  appendPart(key: string, chunk: ArrayBuffer): void {
    const fd = this.activePart.get(key);
    if (fd === undefined) {
      throw new Error('source image part file is not open');
    }
    fs.writeSync(fd, chunk);
  }

  commitPart(key: string): string {
    this.closePart(key);
    const partPath = this.partPath(key);
    const finalPath = this.finalPath(key);
    try {
      fs.renameSync(partPath, finalPath);
    } catch (error) {
      // A parallel card can race to fill the same deterministic cache key.
      // Keep the first complete image when it is already valid; otherwise
      // fail closed and remove our incomplete part.
      const existing = this.getCachedUri(key);
      if (existing !== null) {
        this.unlinkQuietly(partPath);
        return existing;
      }
      this.unlinkQuietly(partPath);
      throw new Error('source image cache rename failed');
    }
    return this.fileUri(finalPath);
  }

  discardPart(key: string): void {
    this.closePart(key);
    this.unlinkQuietly(this.partPath(key));
  }

  cleanup(): void {
    this.ensureRoot();
    const names = fs.listFileSync(this.root);
    const records: CacheRecord[] = [];
    const now = Date.now();
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      // Directory entries are never accepted as a cache file.  Cache names
      // are SHA-256 hex plus a fixed suffix, so no user-controlled path can
      // be joined into the app-private root.
      if (!this.isCacheFileName(name)) continue;
      const path = `${this.root}/${name}`;
      try {
        const stat = fs.statSync(path);
        if (!stat.isFile()) {
          this.unlinkQuietly(path);
          continue;
        }
        const key = name.endsWith(PART_SUFFIX)
          ? name.substring(0, name.length - PART_SUFFIX.length)
          : '';
        // Never remove a live .part file belonging to another SourceCoverImage
        // while it is still receiving chunks. Cancellation/error paths remove
        // it synchronously through discardPart instead.
        if (name.endsWith(PART_SUFFIX) && this.activePart.has(key)) {
          continue;
        }
        if (name.endsWith(PART_SUFFIX) || stat.size <= 0 || stat.size > SOURCE_IMAGE_MAX_BYTES ||
          now - stat.mtime > SOURCE_IMAGE_CACHE_TTL_MILLIS) {
          this.unlinkQuietly(path);
          continue;
        }
        records.push({ path, size: stat.size, mtime: stat.mtime });
      } catch (_error) {
        // A concurrent cleanup/delete is harmless; never let it affect the
        // active stream or expose a partially written file.
      }
    }
    records.sort((left: CacheRecord, right: CacheRecord): number => left.mtime - right.mtime);
    let totalBytes = 0;
    for (let i = 0; i < records.length; i++) totalBytes += records[i].size;
    let retainedCount = records.length;
    let index = 0;
    while (index < records.length &&
      (retainedCount > SOURCE_IMAGE_CACHE_MAX_FILES || totalBytes > SOURCE_IMAGE_CACHE_MAX_BYTES)) {
      this.unlinkQuietly(records[index].path);
      totalBytes -= records[index].size;
      retainedCount -= 1;
      index += 1;
    }
  }

  private ensureRoot(): void {
    try {
      fs.mkdirSync(this.root, true);
    } catch (_error) {
      // mkdirSync may report EEXIST on SDK variants even with recursion=true.
      // Verify that a directory is present before allowing the following I/O
      // call to surface a genuine sandbox failure.
      const stat = fs.statSync(this.root);
      if (!stat.isDirectory()) throw new Error('source image cache root is not a directory');
    }
  }

  private finalPath(key: string): string {
    return `${this.root}/${key}${IMAGE_SUFFIX}`;
  }

  private partPath(key: string): string {
    return `${this.root}/${key}${PART_SUFFIX}`;
  }

  private closePart(key: string): void {
    const fd = this.activePart.get(key);
    if (fd === undefined) return;
    this.activePart.delete(key);
    try {
      fs.closeSync(fd);
    } catch (_error) {
      // The next cleanup path still removes the .part file.  Do not mask the
      // caller's cancellation/network error with a best-effort close error.
    }
  }

  private unlinkQuietly(path: string): void {
    try {
      fs.unlinkSync(path);
    } catch (error) {
      const fsError = error as FsErrorLike;
      if (fsError.code !== 13900002) {
        // Cache cleanup is deliberately quiet: never log paths, URL-derived
        // identifiers, request headers, cookies, or any image body bytes.
      }
    }
  }

  private isCacheFileName(name: string): boolean {
    return /^[a-f0-9]{64}\.(img|part)$/.test(name);
  }

  private isExpired(mtime: number): boolean {
    return Date.now() - mtime > SOURCE_IMAGE_CACHE_TTL_MILLIS;
  }

  private fileUri(path: string): string {
    return `file://${path}`;
  }
}

/** One consumer-facing cancellation handle.  Cancelling destroys just this
 * image request and always removes its .part file. */
export class SourceImageLoadHandle {
  readonly result: Promise<string>;
  private cancelAction: (() => void) | null;
  private cancelled: boolean = false;

  constructor(result: Promise<string>, cancelAction: () => void) {
    this.result = result;
    this.cancelAction = cancelAction;
  }

  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    const action = this.cancelAction;
    this.cancelAction = null;
    if (action !== null) action();
  }
}

/** Shares one deterministic cache-key download across multiple visible cover
 * surfaces. Each surface can cancel its own interest without aborting another
 * card (for example, the continue-reading card and its matching shelf tile). */
class SharedSourceImageLoad {
  readonly result: Promise<string>;
  private readonly cancelUnderlying: () => void;
  private consumers: number = 0;
  private settled: boolean = false;

  constructor(result: Promise<string>, cancelUnderlying: () => void) {
    this.result = result;
    this.cancelUnderlying = cancelUnderlying;
    this.result.then((): void => {
      this.settled = true;
    }, (): void => {
      this.settled = true;
    });
  }

  acquire(): SourceImageLoadHandle {
    this.consumers += 1;
    let released = false;
    return new SourceImageLoadHandle(this.result, (): void => {
      if (released) return;
      released = true;
      if (this.consumers > 0) this.consumers -= 1;
      if (!this.settled && this.consumers === 0) this.cancelUnderlying();
    });
  }
}

/** Pure policy helpers kept public for host-focused tests. */
export class SourceImageResponsePolicy {
  static isHttpUrl(url: string): boolean {
    return HTTP_SCHEME.test(url.trim());
  }

  static isAllowedMime(contentType: string): boolean {
    const normalized = contentType.split(';')[0].trim().toLowerCase();
    return normalized === 'image/png' || normalized === 'image/jpeg' || normalized === 'image/jpg' ||
      normalized === 'image/gif' || normalized === 'image/webp' || normalized === 'image/bmp' ||
      normalized === 'image/avif';
  }

  static parseContentLength(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    if (!/^[0-9]+$/.test(trimmed)) return -1;
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) ? parsed : -1;
  }

  static accepts(status: number, contentType: string, contentLength: number | null): boolean {
    if (status < 200 || status >= 300) return false;
    if (!SourceImageResponsePolicy.isAllowedMime(contentType)) return false;
    return contentLength === null || (contentLength >= 0 && contentLength <= SOURCE_IMAGE_MAX_BYTES);
  }

  static headerValue(headers: Object, name: string): string {
    const record = headers as Record<string, Object>;
    const keys = Object.keys(record);
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');
      const normalizedName = name.toLowerCase().replace(/[-_]/g, '');
      if (normalizedKey !== normalizedName) continue;
      const value = record[key];
      if (typeof value === 'string') return value;
      if (value instanceof Array && value.length > 0) return String(value[0]);
      if (value !== null && value !== undefined) return String(value);
    }
    return '';
  }
}

/**
 * Streams a Core-owned source-image descriptor into an app-private file.
 * No URL, Cookie, Authorization value, or image bytes are logged from here.
 */
export class SourceImageCache {
  private readonly headerResolver: SourceImageHeaderResolver;
  private readonly streamFactory: SourceImageStreamClientFactory;
  private readonly fileStore: SourceImageFileStore;
  private inFlight: Map<string, SharedSourceImageLoad> = new Map<string, SharedSourceImageLoad>();

  constructor(cacheDir: string, headerResolver: SourceImageHeaderResolver,
    streamFactory: SourceImageStreamClientFactory = new PlatformSourceImageStreamClientFactory(),
    fileStore?: SourceImageFileStore) {
    this.headerResolver = headerResolver;
    this.streamFactory = streamFactory;
    this.fileStore = fileStore ?? new PlatformSourceImageFileStore(cacheDir);
  }

  beginLoad(descriptor: HostHttpRequest): SourceImageLoadHandle {
    this.validateDescriptor(descriptor);
    const sourceId = descriptor.sourceId ?? '';
    const cacheKey = this.cacheKey(sourceId, descriptor.url);
    try {
      this.fileStore.cleanup();
    } catch (_error) {
      // Cache pruning is a quota optimization. A valid cached cover can still
      // be read even if pruning encounters a transient filesystem race.
    }
    const cached = this.fileStore.getCachedUri(cacheKey);
    if (cached !== null) {
      return new SourceImageLoadHandle(Promise.resolve(cached), (): void => {});
    }
    const existing = this.inFlight.get(cacheKey);
    if (existing !== undefined) return existing.acquire();

    const headers = this.headerResolver.buildRequestHeaders(descriptor);
    let cancelDownload: (() => void) | null = null;
    const result = this.streamToCache(descriptor, cacheKey, headers, (cancelAction: () => void): void => {
      cancelDownload = cancelAction;
    });
    const shared = new SharedSourceImageLoad(result, (): void => {
      if (cancelDownload !== null) cancelDownload();
    });
    this.inFlight.set(cacheKey, shared);
    result.then((): void => {
      if (this.inFlight.get(cacheKey) === shared) this.inFlight.delete(cacheKey);
    }, (): void => {
      if (this.inFlight.get(cacheKey) === shared) this.inFlight.delete(cacheKey);
    });
    return shared.acquire();
  }

  private streamToCache(descriptor: HostHttpRequest, cacheKey: string,
    headers: Record<string, string>, bindCancel: (action: () => void) => void): Promise<string> {
    return new Promise<string>((resolve: (uri: string) => void, reject: (error: Error) => void): void => {
      const client = this.streamFactory.create();
      let settled = false;
      let requestStatus: number | null = null;
      let receivedHeaders: Object | null = null;
      let headersAccepted = false;
      let streamEnded = false;
      let bytesReceived = 0;
      let partOpened = false;

      const finish = (): void => {
        if (settled) return;
        if (!headersAccepted || !streamEnded || requestStatus === null) return;
        if (requestStatus < 200 || requestStatus >= 300) {
          fail('non-success image response');
          return;
        }
        if (bytesReceived <= 0) {
          fail('empty image response');
          return;
        }
        settled = true;
        try {
          const uri = this.fileStore.commitPart(cacheKey);
          client.destroy();
          try {
            this.fileStore.cleanup();
          } catch (_error) {
            // The completed cover remains valid; bounded cleanup can retry on
            // the next image load.
          }
          resolve(uri);
        } catch (_error) {
          this.fileStore.discardPart(cacheKey);
          client.destroy();
          reject(new Error('source image cache commit failed'));
        }
      };

      const fail = (_reason: string): void => {
        if (settled) return;
        settled = true;
        if (partOpened) this.fileStore.discardPart(cacheKey);
        client.destroy();
        // Reasons stay deliberately generic at this boundary: callers should
        // show the placeholder and must not surface URL/header/body data.
        reject(new Error('source image request rejected'));
      };

      const acceptHeadersIfReady = (): void => {
        if (settled || headersAccepted || receivedHeaders === null) return;
        const contentType = SourceImageResponsePolicy.headerValue(receivedHeaders, 'content-type');
        const contentLengthValue = SourceImageResponsePolicy.headerValue(receivedHeaders, 'content-length');
        const contentLength = SourceImageResponsePolicy.parseContentLength(contentLengthValue);
        // Some SDK builds resolve requestInStream's Promise after the first
        // data callback.  MIME/length are available in headersReceive, so
        // open the temporary file after those checks and defer the 2xx gate
        // until the numeric status is delivered.  A non-2xx status still
        // deletes the .part before anything can be committed.
        if (!SourceImageResponsePolicy.isAllowedMime(contentType) ||
          contentLength === -1 || (contentLength !== null && contentLength > SOURCE_IMAGE_MAX_BYTES)) {
          fail('response headers rejected');
          return;
        }
        try {
          this.fileStore.openPart(cacheKey);
          partOpened = true;
          headersAccepted = true;
          finish();
        } catch (_error) {
          fail('part file open failed');
        }
      };

      bindCancel((): void => fail('cancelled'));
      client.onHeaders((headersEvent: Object): void => {
        if (settled) return;
        receivedHeaders = headersEvent;
        acceptHeadersIfReady();
      });
      client.onData((chunk: ArrayBuffer): void => {
        if (settled) return;
        // A stream that emits bytes before the response status and headers is
        // accepted cannot be verified safely, so fail rather than buffering.
        if (!headersAccepted) {
          fail('data before accepted headers');
          return;
        }
        const nextTotal = bytesReceived + chunk.byteLength;
        if (nextTotal > SOURCE_IMAGE_MAX_BYTES) {
          fail('image body exceeds limit');
          return;
        }
        try {
          this.fileStore.appendPart(cacheKey, chunk);
          bytesReceived = nextTotal;
        } catch (_error) {
          fail('part file write failed');
        }
      });
      client.onEnd((): void => {
        if (settled) return;
        streamEnded = true;
        finish();
      });

      const options: http.HttpRequestOptions = {
        method: http.RequestMethod.GET,
        header: headers,
        connectTimeout: 15000,
        readTimeout: 15000,
      };
      client.request(descriptor.url, options).then((status: number): void => {
        if (settled) return;
        requestStatus = status;
        acceptHeadersIfReady();
        finish();
      }).catch((_error: Error): void => {
        fail('stream request failed');
      });
    });
  }

  private validateDescriptor(descriptor: HostHttpRequest): void {
    const sourceId = descriptor.sourceId ?? '';
    if (sourceId.trim().length === 0) throw new Error('source image request requires sourceId');
    if (!SourceImageResponsePolicy.isHttpUrl(descriptor.url)) throw new Error('source image URL must be http(s)');
    if (descriptor.method !== 'GET') throw new Error('source image descriptor must be GET');
    if (descriptor.body !== undefined && descriptor.body.length > 0) {
      throw new Error('source image descriptor must not include a body');
    }
  }

  private cacheKey(sourceId: string, resolvedUrl: string): string {
    const text = `${sourceId}\u0000${resolvedUrl}`;
    const bytes = new util.TextEncoder().encodeInto(text);
    const md = cryptoFramework.createMd('SHA256');
    md.updateSync({ data: bytes });
    const digest = md.digestSync().data;
    let hex = '';
    for (let index = 0; index < digest.length; index++) {
      const value = digest[index].toString(16);
      hex += value.length === 1 ? `0${value}` : value;
    }
    return hex;
  }
}
