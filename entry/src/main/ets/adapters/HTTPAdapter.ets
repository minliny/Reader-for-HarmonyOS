// HTTPAdapter — wraps @ohos.net.http for Core-compatible HTTP requests
import { http } from '@kit.NetworkKit';

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

  destroy(): void {
    this.client.destroy();
  }
}
