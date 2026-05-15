// HTTPAdapter — wraps @ohos.net.http for Core-compatible HTTP requests
import { http } from '@kit.NetworkKit';

export interface HTTPRequest {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

export interface HTTPResponse {
  statusCode: number;
  headers: Record<string, string>;
  data: string;
}

export class HTTPAdapter {
  private client: http.HttpRequest;
  private defaultTimeout: number;

  constructor(timeout: number = 30000) {
    this.client = http.createHttp();
    this.defaultTimeout = timeout;
  }

  async get(url: string, headers?: Record<string, string>): Promise<HTTPResponse> {
    return this.request({ url, method: 'GET', headers });
  }

  async post(url: string, body?: string, headers?: Record<string, string>): Promise<HTTPResponse> {
    return this.request({ url, method: 'POST', headers, body });
  }

  async request(req: HTTPRequest): Promise<HTTPResponse> {
    const timeout = req.timeout ?? this.defaultTimeout;
    try {
      const resp = await this.client.request(req.url, {
        method: req.method === 'GET' ? http.RequestMethod.GET : http.RequestMethod.POST,
        header: req.headers ?? {},
        extraData: req.body,
        connectTimeout: timeout,
        readTimeout: timeout
      });

      return {
        statusCode: resp.responseCode,
        headers: this.parseHeaders(resp.header),
        data: resp.result as string ?? ''
      };
    } catch (e) {
      return {
        statusCode: 0,
        headers: {},
        data: JSON.stringify({ error: 'NETWORK_ERROR', detail: JSON.stringify(e) })
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

  destroy(): void {
    this.client.destroy();
  }
}
