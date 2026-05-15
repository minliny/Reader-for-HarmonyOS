// BridgeHTTPClient — ArkTS client for local Core bridge (localhost:8899)
// Strategy B: development accelerator for real Core data
import { http } from '@kit.NetworkKit';
import { BookSource } from '../models/BookSource';
import { SearchQuery, SearchResultItem } from '../models/SearchModels';
import { TOCItem, ContentPage } from '../models/ContentModels';
import { ChapterSplitPolicy } from '../models/LocalBook';

const DEFAULT_BASE_URL = 'http://localhost:8899';
const DEFAULT_TIMEOUT = 30000;

export interface BridgeHealth {
  status: 'ok' | 'degraded';
  coreVersion?: string;
  services?: string[];
  error?: string;
}

export interface BridgeError {
  code: string;
  message: string;
  stage?: string;
  context?: Record<string, string>;
}

export class BridgeConnectionError extends Error {
  constructor(message: string) {
    super(`Bridge connection failed: ${message}`);
    this.name = 'BridgeConnectionError';
  }
}

export class BridgeResponseError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'BridgeResponseError';
    this.code = code;
  }
}

export class BridgeTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Bridge request timed out after ${timeoutMs}ms`);
    this.name = 'BridgeTimeoutError';
  }
}

export class BridgeParseError extends Error {
  constructor(endpoint: string, detail: string) {
    super(`Failed to parse bridge response from ${endpoint}: ${detail}`);
    this.name = 'BridgeParseError';
  }
}

export class BridgeHTTPClient {
  private baseUrl: string;
  private timeout: number;
  private httpClient: http.HttpRequest;

  constructor(baseUrl: string = DEFAULT_BASE_URL, timeout: number = DEFAULT_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
    this.httpClient = http.createHttp();
  }

  async health(): Promise<BridgeHealth> {
    const resp = await this.httpClient.request(`${this.baseUrl}/health`, {
      method: http.RequestMethod.GET,
      connectTimeout: 5000,
      readTimeout: 5000
    });
    return JSON.parse(resp.result as string) as BridgeHealth;
  }

  async search(source: BookSource, query: SearchQuery): Promise<SearchResultItem[]> {
    const resp = await this.post('/search', { source, query });
    const data = JSON.parse(resp.result as string);
    if (data.error) {
      const err = data.error as BridgeError;
      throw new BridgeResponseError(err.code, err.message);
    }
    return data.results as SearchResultItem[];
  }

  async fetchTOC(source: BookSource, detailURL: string): Promise<TOCItem[]> {
    const resp = await this.post('/toc', { source, detailURL });
    const data = JSON.parse(resp.result as string);
    if (data.error) {
      const err = data.error as BridgeError;
      throw new BridgeResponseError(err.code, err.message);
    }
    return data.items as TOCItem[];
  }

  async fetchContent(source: BookSource, chapterURL: string): Promise<ContentPage> {
    const resp = await this.post('/content', { source, chapterURL });
    const data = JSON.parse(resp.result as string);
    if (data.error) {
      const err = data.error as BridgeError;
      throw new BridgeResponseError(err.code, err.message);
    }
    return data as ContentPage;
  }

  async parseTXT(dataBase64: string, encoding?: string, policy?: ChapterSplitPolicy): Promise<Record<string, Object>> {
    const resp = await this.post('/parse/txt', { dataBase64, encoding, policy });
    const data = JSON.parse(resp.result as string);
    if (data.error) {
      const err = data.error as BridgeError;
      throw new BridgeResponseError(err.code, err.message);
    }
    return data as Record<string, Object>;
  }

  private async post(path: string, body: Object): Promise<http.HttpResponse> {
    try {
      const resp = await this.httpClient.request(`${this.baseUrl}${path}`, {
        method: http.RequestMethod.POST,
        header: {
          'Content-Type': 'application/json',
          'X-Bridge-Version': '1.0.0'
        },
        extraData: JSON.stringify(body),
        connectTimeout: this.timeout,
        readTimeout: this.timeout
      });
      return resp;
    } catch (e) {
      throw new BridgeConnectionError(JSON.stringify(e));
    }
  }
}
