// HTTPAdapter — wraps @ohos.net.http for Core-compatible HTTP requests
import { http } from '@kit.NetworkKit';
import { fileIo } from '@kit.CoreFileKit';

export interface HTTPProxyConfig {
  host: string;
  port: number;
  exclusionList: string[];
  auditLabel: string;
  appLevelProxyApplied?: boolean;
}

export interface HTTPRequest {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  bypassProxy?: boolean;
}

export interface HTTPResponse {
  statusCode: number;
  headers: Record<string, string>;
  data: string;
}

export interface DownloadProgress {
  receivedBytes: number;
  totalBytes: number;
  retryCount: number;
  statusClass: string;   // bounded class, e.g. '2xx' / 'network_error' / 'http_5xx'
}

export type DownloadProgressCallback = (progress: DownloadProgress) => void;

export interface DownloadResult {
  filePath: string;
  receivedBytes: number;
  statusClass: string;
  retryCount: number;
  errorClass: string;
}

const MAX_RETRIES = 3;
const RETRY_STATUS_CLASSES = new Set<string>(['network_error', 'http_5xx']);

export class HTTPAdapter {
  private client: http.HttpRequest;
  private defaultTimeout: number;
  private proxyConfig?: HTTPProxyConfig;

  constructor(timeout: number = 30000, proxyConfig?: HTTPProxyConfig) {
    this.client = http.createHttp();
    this.defaultTimeout = timeout;
    this.proxyConfig = proxyConfig;
  }

  async get(url: string, headers?: Record<string, string>): Promise<HTTPResponse> {
    return this.request({ url, method: 'GET', headers });
  }

  async post(url: string, body?: string, headers?: Record<string, string>): Promise<HTTPResponse> {
    return this.request({ url, method: 'POST', headers, body });
  }

  async request(req: HTTPRequest): Promise<HTTPResponse> {
    const timeout = req.timeout ?? this.defaultTimeout;
    const fallbackHeaders: Record<string, string> = {};
    const headers = req.headers ?? fallbackHeaders;
    const options: http.HttpRequestOptions = {
      method: req.method === 'GET' ? http.RequestMethod.GET : http.RequestMethod.POST,
      header: headers,
      extraData: req.body,
      expectDataType: http.HttpDataType.STRING,
      connectTimeout: timeout,
      readTimeout: timeout
    };
    if (req.bypassProxy === true) {
      options.usingProxy = false;
    } else if (this.proxyConfig) {
      options.usingProxy = {
        host: this.proxyConfig.host,
        port: this.proxyConfig.port,
        exclusionList: this.proxyConfig.exclusionList
      };
    }
    try {
      const resp = await this.client.request(req.url, options);

      return {
        statusCode: resp.responseCode,
        headers: this.parseHeaders(resp.header),
        data: this.normalizeResult(resp.result)
      };
    } catch (e) {
      return {
        statusCode: 0,
        headers: fallbackHeaders,
        data: `{"error":"NETWORK_ERROR","detail":${JSON.stringify(String(e))}}`
      };
    }
  }

  private parseHeaders(header: Object): Record<string, string> {
    const result: Record<string, string> = {};
    if (!header) { return result; }
    const keys = Object.keys(header);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const v = (header as Record<string, Object>)[k];
      result[k] = Array.isArray(v) ? v.join(', ') : String(v);
    }
    return result;
  }

  private normalizeResult(result: string | Object | ArrayBuffer): string {
    if (typeof result === 'string') {
      return result;
    }
    if (result instanceof ArrayBuffer) {
      return String.fromCharCode(...new Uint8Array(result));
    }
    if (result === undefined || result === null) {
      return '';
    }
    return JSON.stringify(result);
  }

  /**
   * Download a URL to a sandbox file with bounded retry on transient errors.
   * Progress is reported via onProgress with bounded status classes; no raw
   * URL, cookie, or response body material is surfaced beyond the bytes
   * written to the local file. The caller controls the destination path.
   */
  async downloadToFile(
    url: string,
    filePath: string,
    headers?: Record<string, string>,
    onProgress?: DownloadProgressCallback
  ): Promise<DownloadResult> {
    let retryCount = 0;
    let lastErrorClass = 'none';
    while (retryCount <= MAX_RETRIES) {
      const client = http.createHttp();
      try {
        const requestHeaders: Record<string, string> = headers ?? {};
        const options: http.HttpRequestOptions = {
          method: http.RequestMethod.GET,
          header: requestHeaders,
          expectDataType: http.HttpDataType.ARRAY_BUFFER,
          connectTimeout: this.defaultTimeout,
          readTimeout: this.defaultTimeout
        };
        if (this.proxyConfig) {
          options.usingProxy = {
            host: this.proxyConfig.host,
            port: this.proxyConfig.port,
            exclusionList: this.proxyConfig.exclusionList
          };
        }
        const resp = await client.request(url, options);
        const statusClass = this.statusClass(resp.responseCode);
        if (resp.responseCode < 200 || resp.responseCode >= 300) {
          lastErrorClass = statusClass;
          if (RETRY_STATUS_CLASSES.has(statusClass) && retryCount < MAX_RETRIES) {
            retryCount++;
            client.destroy();
            continue;
          }
          client.destroy();
          return { filePath, receivedBytes: 0, statusClass, retryCount, errorClass: statusClass };
        }
        const buffer = resp.result instanceof ArrayBuffer ? resp.result as ArrayBuffer : new ArrayBuffer(0);
        const bytes = new Uint8Array(buffer);
        this.writeBytes(filePath, bytes);
        if (onProgress) {
          onProgress({ receivedBytes: bytes.length, totalBytes: bytes.length, retryCount, statusClass });
        }
        client.destroy();
        return { filePath, receivedBytes: bytes.length, statusClass, retryCount, errorClass: 'none' };
      } catch (e) {
        lastErrorClass = 'network_error';
        client.destroy();
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          continue;
        }
        return { filePath, receivedBytes: 0, statusClass: 'network_error', retryCount, errorClass: 'network_error' };
      }
    }
    return { filePath, receivedBytes: 0, statusClass: 'network_error', retryCount, errorClass: lastErrorClass };
  }

  private statusClass(code: number): string {
    if (code === 0) { return 'network_error'; }
    if (code >= 200 && code < 300) { return '2xx'; }
    if (code >= 300 && code < 400) { return '3xx'; }
    if (code >= 400 && code < 500) { return 'http_4xx'; }
    if (code >= 500) { return 'http_5xx'; }
    return 'unknown';
  }

  private writeBytes(filePath: string, bytes: Uint8Array): void {
    const file = fileIo.openSync(filePath, fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE);
    try {
      fileIo.writeSync(file.fd, bytes.buffer);
    } finally {
      fileIo.closeSync(file);
    }
  }

  destroy(): void {
    this.client.destroy();
  }
}
