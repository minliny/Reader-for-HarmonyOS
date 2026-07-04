// Reader for HarmonyOS - M8 跨层基础设施 - ReaderHttpClient.ets
import http from '@ohos.net.http';
import { ReaderLogger } from './ReaderLogger';

export interface RequestOptions {
  timeout?: number;
  headers?: Record<string, string>;
  retry?: number;
}

export interface HttpResponse<T> {
  statusCode: number;
  data: T;
  headers: Record<string, string>;
}

export class ReaderHttpClient {
  private static instance: ReaderHttpClient;

  static shared(): ReaderHttpClient {
    if (!ReaderHttpClient.instance) ReaderHttpClient.instance = new ReaderHttpClient();
    return ReaderHttpClient.instance;
  }

  async get<T>(url: string, options?: RequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>('GET', url, undefined, options);
  }

  async post<T>(url: string, body: object, options?: RequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>('POST', url, body, options);
  }

  async put<T>(url: string, body: object, options?: RequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>('PUT', url, body, options);
  }

  async delete<T>(url: string, options?: RequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>('DELETE', url, undefined, options);
  }

  private async request<T>(
    method: string,
    url: string,
    body: object | undefined,
    options?: RequestOptions
  ): Promise<HttpResponse<T>> {
    const retry = options?.retry ?? 0;
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        const httpReq = http.createHttp();
        try {
          const promise = httpReq.request(url, {
            method: method as http.RequestMethod,
            header: options?.headers || { 'Content-Type': 'application/json' },
            extraData: body ? JSON.stringify(body) : undefined,
            connectTimeout: options?.timeout ?? 15000,
            readTimeout: options?.timeout ?? 15000,
            expectDataType: http.HttpDataType.STRING
          });
          const resp = await promise;
          const data = this.parseResponse<T>(resp.result as string);
          return {
            statusCode: resp.responseCode,
            data,
            headers: (resp.header as Record<string, string>) || {}
          };
        } finally {
          httpReq.destroy();
        }
      } catch (e) {
        lastError = e as Error;
        ReaderLogger.w('HttpClient', `attempt ${attempt + 1} failed: ${url}`, e);
      }
    }
    throw lastError || new Error('HTTP request failed');
  }

  private parseResponse<T>(raw: string): T {
    if (!raw) return {} as T;
    try {
      return JSON.parse(raw) as T;
    } catch (e) {
      return raw as unknown as T;
    }
  }
}
