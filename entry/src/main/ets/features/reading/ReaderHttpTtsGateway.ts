export type ReaderHttpTtsJsonObject = { [key: string]: unknown };

export interface ReaderHttpTtsRuntime {
  request(method: string, params?: ReaderHttpTtsJsonObject): Promise<{ data: ReaderHttpTtsJsonObject }>;
}

export type ReaderHttpTtsConfig = {
  id: number;
  name: string;
  url: string;
  contentType?: string;
  concurrentRate?: string;
  loginUrl?: string;
  loginUi?: string;
  header?: string;
  jsLib?: string;
  enabledCookieJar?: boolean;
  loginCheckJs?: string;
  lastUpdateTime: number;
};

export type ReaderHttpTtsRequestDescriptor = {
  method: 'GET';
  url: string;
  headers: Record<string, string>;
  body?: string;
  contentType?: string;
  concurrentRate?: string;
};

export type ReaderHttpTtsDeleteResult = {
  id: number;
  deleted: boolean;
};

/** Strict Harmony boundary for Core-owned HttpTTS configuration and descriptors. */
export class ReaderHttpTtsGateway {
  private readonly runtime: ReaderHttpTtsRuntime;

  constructor(runtime: ReaderHttpTtsRuntime) {
    this.runtime = runtime;
  }

  async put(config: ReaderHttpTtsConfig): Promise<ReaderHttpTtsConfig> {
    this.assertConfig(config, 'http-tts.put');
    const result = await this.runtime.request('http-tts.put', { ...config });
    return this.decodeConfig(result.data['tts'], 'http-tts.put');
  }

  async get(id: number): Promise<ReaderHttpTtsConfig | undefined> {
    this.assertId(id, 'http-tts.get');
    const result = await this.runtime.request('http-tts.get', { id });
    const raw = result.data['tts'];
    return raw === undefined || raw === null ? undefined : this.decodeConfig(raw, 'http-tts.get');
  }

  async list(): Promise<ReaderHttpTtsConfig[]> {
    const result = await this.runtime.request('http-tts.list', {});
    const raw = result.data['items'];
    if (!Array.isArray(raw)) throw new Error('http-tts.list returned invalid items');
    return raw.map((item: unknown): ReaderHttpTtsConfig => this.decodeConfig(item, 'http-tts.list'));
  }

  async delete(id: number): Promise<ReaderHttpTtsDeleteResult> {
    this.assertId(id, 'http-tts.delete');
    const result = await this.runtime.request('http-tts.delete', { id });
    const resultId = result.data['id'];
    const deleted = result.data['deleted'];
    if (resultId !== id || typeof deleted !== 'boolean') {
      throw new Error('http-tts.delete returned an invalid result');
    }
    return { id, deleted };
  }

  async buildRequest(id: number, text: string): Promise<ReaderHttpTtsRequestDescriptor> {
    this.assertId(id, 'http-tts.build-request');
    if (text.trim().length === 0) throw new Error('http-tts.build-request requires non-empty text');
    const result = await this.runtime.request('http-tts.build-request', { id, text });
    const raw = this.requireObject(result.data, 'http-tts.build-request data');
    this.assertAllowedKeys(raw, ['method', 'url', 'headers', 'body', 'contentType', 'concurrentRate'],
      'http-tts.build-request data');
    const method = raw['method'];
    const url = raw['url'];
    if (method !== 'GET' || typeof url !== 'string' || url.trim().length === 0) {
      throw new Error('http-tts.build-request returned an unsupported descriptor');
    }
    const headersRaw = this.requireObject(raw['headers'], 'http-tts.build-request headers');
    const headers: Record<string, string> = {};
    for (const key of Object.keys(headersRaw)) {
      const value = headersRaw[key];
      if (key.trim().length === 0 || typeof value !== 'string') {
        throw new Error('http-tts.build-request returned invalid headers');
      }
      headers[key] = value;
    }
    const descriptor: ReaderHttpTtsRequestDescriptor = { method, url, headers };
    this.assignOptionalString(raw, descriptor, 'body');
    this.assignOptionalString(raw, descriptor, 'contentType');
    this.assignOptionalString(raw, descriptor, 'concurrentRate');
    return descriptor;
  }

  private decodeConfig(value: unknown, command: string): ReaderHttpTtsConfig {
    const raw = this.requireObject(value, `${command} tts`);
    this.assertAllowedKeys(raw, [
      'id', 'name', 'url', 'contentType', 'concurrentRate', 'loginUrl', 'loginUi', 'header', 'jsLib',
      'enabledCookieJar', 'loginCheckJs', 'lastUpdateTime',
    ], `${command} tts`);
    const id = raw['id'];
    const name = raw['name'];
    const url = raw['url'];
    const lastUpdateTime = raw['lastUpdateTime'];
    if (!Number.isSafeInteger(id) || (id as number) < 0 || typeof name !== 'string' || name.trim().length === 0 ||
      typeof url !== 'string' || url.trim().length === 0 || !Number.isSafeInteger(lastUpdateTime) ||
      (lastUpdateTime as number) < 0) {
      throw new Error(`${command} returned an invalid HttpTTS config`);
    }
    const config: ReaderHttpTtsConfig = {
      id: id as number,
      name,
      url,
      lastUpdateTime: lastUpdateTime as number,
    };
    this.assignOptionalString(raw, config, 'contentType');
    this.assignOptionalString(raw, config, 'concurrentRate');
    this.assignOptionalString(raw, config, 'loginUrl');
    this.assignOptionalString(raw, config, 'loginUi');
    this.assignOptionalString(raw, config, 'header');
    this.assignOptionalString(raw, config, 'jsLib');
    this.assignOptionalString(raw, config, 'loginCheckJs');
    const enabledCookieJar = raw['enabledCookieJar'];
    if (enabledCookieJar !== undefined && enabledCookieJar !== null) {
      if (typeof enabledCookieJar !== 'boolean') throw new Error(`${command} returned invalid enabledCookieJar`);
      config.enabledCookieJar = enabledCookieJar;
    }
    return config;
  }

  private assertConfig(config: ReaderHttpTtsConfig, command: string): void {
    this.assertId(config.id, command);
    if (config.name.trim().length === 0 || config.url.trim().length === 0 ||
      !Number.isSafeInteger(config.lastUpdateTime) || config.lastUpdateTime < 0) {
      throw new Error(`${command} requires a valid config`);
    }
  }

  private assertId(id: number, command: string): void {
    if (!Number.isSafeInteger(id) || id < 0) throw new Error(`${command} requires a non-negative safe id`);
  }

  private requireObject(value: unknown, label: string): ReaderHttpTtsJsonObject {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`${label} must be an object`);
    }
    return value as ReaderHttpTtsJsonObject;
  }

  private assertAllowedKeys(value: ReaderHttpTtsJsonObject, keys: string[], label: string): void {
    const allowed = new Set(keys);
    for (const key of Object.keys(value)) {
      if (!allowed.has(key)) throw new Error(`${label} returned unknown field ${key}`);
    }
  }

  private assignOptionalString<T extends object>(
    raw: ReaderHttpTtsJsonObject,
    target: T,
    key: string,
  ): void {
    const value = raw[key];
    if (value === undefined || value === null) return;
    if (typeof value !== 'string') throw new Error(`HttpTTS returned invalid ${key}`);
    (target as Record<string, unknown>)[key] = value;
  }
}
