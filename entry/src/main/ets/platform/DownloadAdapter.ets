// DownloadAdapter — clean-room HarmonyOS download adapter.
// Wraps HTTPAdapter.downloadToFile with a redacted progress surface for the
// host download-service smoke. Exposes only bounded classes and byte counts;
// never raw URLs, cookies, credentials, or response bodies.

import { HTTPAdapter, DownloadProgress, DownloadProgressCallback, DownloadResult, HTTPProxyConfig } from '../adapters/HTTPAdapter';
import { fileIo } from '@kit.CoreFileKit';

export interface DownloadAuditEvidence {
  completed: boolean;
  receivedBytes: number;
  retryCount: number;
  statusClass: string;
  errorClass: string;
  cacheHit: boolean;
  rawContentExported: boolean;
  checksum: string;
}

export class DownloadAdapter {
  private http: HTTPAdapter;
  private cacheDir: string;
  private cache: Map<string, string> = new Map();

  constructor(cacheDir: string, proxyConfig?: HTTPProxyConfig) {
    this.http = new HTTPAdapter(30000, proxyConfig);
    this.cacheDir = cacheDir;
  }

  /**
   * Download a URL into the sandbox cache and return a redacted audit record.
   * `cacheKey` decouples the caller from the raw URL; the same key reuses a
   * cached file (cacheHit=true) to model bounded cache behavior.
   */
  async download(cacheKey: string, url: string): Promise<DownloadAuditEvidence> {
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        completed: true,
        receivedBytes: 0,
        retryCount: 0,
        statusClass: '2xx',
        errorClass: 'none',
        cacheHit: true,
        rawContentExported: false,
        checksum: `dl-cache:${cacheKey}`
      };
    }
    const targetPath = `${this.cacheDir}/${cacheKey}`;
    const progress: DownloadProgress = { receivedBytes: 0, totalBytes: 0, retryCount: 0, statusClass: 'pending' };
    const cb: DownloadProgressCallback = (p: DownloadProgress) => {
      progress.receivedBytes = p.receivedBytes;
      progress.totalBytes = p.totalBytes;
      progress.retryCount = p.retryCount;
      progress.statusClass = p.statusClass;
    };
    const result: DownloadResult = await this.http.downloadToFile(url, targetPath, undefined, cb);
    const completed = result.errorClass === 'none' && result.receivedBytes > 0;
    if (completed) {
      this.cache.set(cacheKey, targetPath);
    }
    return {
      completed,
      receivedBytes: result.receivedBytes,
      retryCount: result.retryCount,
      statusClass: result.statusClass,
      errorClass: result.errorClass,
      cacheHit: false,
      rawContentExported: false,
      checksum: `dl:${cacheKey}:${result.statusClass}:${result.receivedBytes}`
    };
  }

  /** Best-effort cleanup of a cached download file. */
  evict(cacheKey: string): void {
    const path = this.cache.get(cacheKey);
    if (path) {
      try { fileIo.unlinkSync(path); } catch (_e) { /* best effort */ }
      this.cache.delete(cacheKey);
    }
  }

  destroy(): void {
    this.http.destroy();
  }
}
