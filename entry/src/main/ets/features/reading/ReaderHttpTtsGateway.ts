import {
  isReaderTtsCredentialAliasForConfig,
  readerOnlineTtsProfile,
  type ReaderOnlineTtsPlayback,
} from './ReaderOnlineTtsProfile.ts';
import { httpsUrlHostname, isPrivateNetworkTarget } from '../../app/HttpTransportPolicy.ts';
export type ReaderHttpTtsJsonObject = { [key: string]: unknown };

const MAX_DESCRIPTOR_BODY_LENGTH = 16 * 1024 * 1024;
const MAX_DESCRIPTOR_HEADER_VALUE_LENGTH = 64 * 1024;
const MAX_CONFIG_STRING_LENGTH = 64 * 1024;
const SAFE_PCM_SAMPLE_RATES: number[] = [8000, 16000, 22050, 24000, 32000, 44100, 48000];
const HTTP_TOKEN_PATTERN = /^[!#$%&'*+.^_`|~A-Za-z0-9-]+$/;

export interface ReaderHttpTtsRuntime {
  request(method: string, params?: ReaderHttpTtsJsonObject): Promise<{ data: ReaderHttpTtsJsonObject }>;
}

export type ReaderHttpTtsConfig = {
  id: number;
  name: string;
  url: string;
  readerProfile?: string;
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
  method: 'GET' | 'POST';
  playback?: ReaderOnlineTtsPlayback;
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
    // Decode the outbound object too: ephemeral form secrets must never enter Core.
    const payload = this.decodeConfig(config, 'http-tts.put');
    this.assertConfig(payload, 'http-tts.put');
    const result = await this.runtime.request('http-tts.put', { ...payload });
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

  async buildRequest(id: number, text: string, ratePercent: number = 100): Promise<ReaderHttpTtsRequestDescriptor> {
    this.assertId(id, 'http-tts.build-request');
    if (!Number.isSafeInteger(ratePercent) || ratePercent < 50 || ratePercent > 200 || ratePercent % 5 !== 0)
      throw new Error('在线语音语速无效');
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('http-tts.build-request requires non-empty text');
    }
    const result = await this.runtime.request('http-tts.build-request', { id, text, ratePercent });
    const raw = this.requireObject(result.data, 'http-tts.build-request data');
    this.assertAllowedKeys(raw, ['method', 'url', 'headers', 'body', 'contentType', 'concurrentRate', 'playback'],
      'http-tts.build-request data');
    const method = raw['method'];
    const url = raw['url'];
    if ((method !== 'GET' && method !== 'POST') || typeof url !== 'string' || url.trim().length === 0) {
      throw new Error('http-tts.build-request returned an unsupported descriptor');
    }
    const headersRaw = this.requireObject(raw['headers'], 'http-tts.build-request headers');
    const headers: Record<string, string> = {};
    for (const key of Object.keys(headersRaw)) {
      const value = headersRaw[key];
      if (key === '__proto__' || key === 'constructor' || key === 'prototype' ||
        key.length > 128 || !HTTP_TOKEN_PATTERN.test(key) || typeof value !== 'string' ||
        value.length > MAX_DESCRIPTOR_HEADER_VALUE_LENGTH || this.hasHeaderControl(key) ||
        this.hasHeaderControl(value)) {
        throw new Error('http-tts.build-request returned invalid headers');
      }
      headers[key] = value;
    }
    this.requirePublicHttpsUrl(url, 'http-tts.build-request');
    const descriptor: ReaderHttpTtsRequestDescriptor = { method, url, headers };
    if (raw['playback'] !== undefined && raw['playback'] !== null) {
      const fields = this.requireObject(raw['playback'], 'http-tts playback');
      this.assertAllowedKeys(fields, ['format', 'sampleRate', 'channels', 'sampleFormat', 'credentialRef',
        'credentialHeader', 'credentialPrefix', 'rateApplied', 'ratePercent'], 'http-tts playback');
      const format = fields['format'];
      const rate = fields['ratePercent'];
      const applied = fields['rateApplied'];
      const prefix = fields['credentialPrefix'];
      if ((format !== 'mp3' && format !== 'wav' && format !== 'pcm') || typeof rate !== 'number' ||
        !Number.isSafeInteger(rate) || rate < 50 || rate > 200 || rate % 5 !== 0 ||
        typeof applied !== 'boolean' || fields['sampleFormat'] !== 's16le' || typeof prefix !== 'string' ||
        prefix.length > 256 || this.hasHeaderControl(prefix)) throw new Error('在线语音播放参数无效');
      const playback: ReaderOnlineTtsPlayback = { format, ratePercent: rate, rateApplied: applied,
        sampleFormat: 's16le', credentialPrefix: prefix };
      this.assignOptionalString(fields, playback, 'credentialRef', 160, false, '在线语音密钥引用无效');
      this.assignOptionalString(fields, playback, 'credentialHeader', 128, false, '在线语音鉴权请求头无效');
      if (playback.credentialRef !== undefined &&
        !isReaderTtsCredentialAliasForConfig(playback.credentialRef)) throw new Error('在线语音密钥引用无效');
      if (playback.credentialHeader !== undefined &&
        (playback.credentialHeader.length > 128 || !/^[A-Za-z][A-Za-z0-9-]*$/.test(playback.credentialHeader)))
        throw new Error('在线语音鉴权请求头无效');
      const sampleRate = fields['sampleRate'];
      const channels = fields['channels'];
      if (sampleRate !== undefined && sampleRate !== null) {
        if (typeof sampleRate !== 'number' || !Number.isSafeInteger(sampleRate) ||
          SAFE_PCM_SAMPLE_RATES.indexOf(sampleRate) < 0)
          throw new Error('在线语音采样率无效');
        playback.sampleRate = sampleRate;
      }
      if (channels !== undefined && channels !== null) {
        if (typeof channels !== 'number' || !Number.isSafeInteger(channels) || (channels !== 1 && channels !== 2)) {
          throw new Error('在线语音声道无效');
        }
        playback.channels = channels;
      }
      if (format === 'pcm' && (playback.sampleRate === undefined || playback.channels === undefined))
        throw new Error('PCM 在线语音缺少采样率或声道');
      const hasCredentialPlaceholder = Object.keys(headers).some((key: string): boolean =>
        headers[key].includes('{{apiKey}}'));
      const hasUrlCredentialPlaceholder = url.includes('{{apiKey}}');
      if (playback.credentialRef === undefined &&
        (hasCredentialPlaceholder || hasUrlCredentialPlaceholder)) {
        throw new Error('在线语音密钥占位符缺少密钥引用');
      }
      if (playback.credentialRef !== undefined && playback.credentialHeader === undefined &&
        !hasCredentialPlaceholder && !hasUrlCredentialPlaceholder) {
        throw new Error('在线语音密钥缺少鉴权请求头');
      }
      descriptor.playback = playback;
    }
    this.assignOptionalString(raw, descriptor, 'body', MAX_DESCRIPTOR_BODY_LENGTH, true);
    this.assignOptionalString(raw, descriptor, 'contentType', 1024);
    this.assignOptionalString(raw, descriptor, 'concurrentRate', 1024);
    if (descriptor.body !== undefined && descriptor.body.includes('{{apiKey}}')) {
      throw new Error('在线语音请求体包含未解析的密钥占位符');
    }
    return descriptor;
  }

  private decodeConfig(value: unknown, command: string): ReaderHttpTtsConfig {
    const raw = this.requireObject(value, `${command} tts`);
    this.assertAllowedKeys(raw, [
      'id', 'name', 'url', 'contentType', 'concurrentRate', 'loginUrl', 'loginUi', 'header', 'jsLib',
      'enabledCookieJar', 'loginCheckJs', 'lastUpdateTime', 'readerProfile',
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
    if (name.length > 256 || this.hasHeaderControl(name)) {
      throw new Error(`${command} returned an invalid HttpTTS config`);
    }
    this.requirePublicHttpsUrl(url, command);
    const config: ReaderHttpTtsConfig = {
      id: id as number,
      name,
      url,
      lastUpdateTime: lastUpdateTime as number,
    };
    this.assignOptionalString(raw, config, 'readerProfile', 8192);
    if (config.readerProfile !== undefined) readerOnlineTtsProfile(config.readerProfile);
    this.assignOptionalString(raw, config, 'contentType', 1024);
    this.assignOptionalString(raw, config, 'concurrentRate', 1024);
    this.assignOptionalString(raw, config, 'loginUrl', MAX_CONFIG_STRING_LENGTH);
    this.assignOptionalString(raw, config, 'loginUi', MAX_CONFIG_STRING_LENGTH, true);
    this.assignOptionalString(raw, config, 'header', MAX_CONFIG_STRING_LENGTH, true);
    this.assignOptionalString(raw, config, 'jsLib', MAX_CONFIG_STRING_LENGTH, true);
    this.assignOptionalString(raw, config, 'loginCheckJs', MAX_CONFIG_STRING_LENGTH, true);
    const enabledCookieJar = raw['enabledCookieJar'];
    if (enabledCookieJar !== undefined && enabledCookieJar !== null) {
      if (typeof enabledCookieJar !== 'boolean') throw new Error(`${command} returned invalid enabledCookieJar`);
      config.enabledCookieJar = enabledCookieJar;
    }
    return config;
  }

  private assertConfig(config: ReaderHttpTtsConfig, command: string): void {
    this.assertId(config.id, command);
    if (typeof config.name !== 'string' || typeof config.url !== 'string' || config.name.trim().length === 0 ||
      config.url.trim().length === 0 || config.name.length > 256 || this.hasHeaderControl(config.name) ||
      !Number.isSafeInteger(config.lastUpdateTime) || config.lastUpdateTime < 0) {
      throw new Error(`${command} requires a valid config`);
    }
    this.requirePublicHttpsUrl(config.url, command);
  }

  private requirePublicHttpsUrl(value: string, command: string): void {
    const host = httpsUrlHostname(value);
    const trimmed = typeof value === 'string' ? value.trim() : '';
    const authority = trimmed.slice(8).split(/[/?#]/)[0];
    if (host === undefined || authority.length === 0 || authority.indexOf('@') >= 0 ||
      /[\u0000-\u0020\u007f]/.test(trimmed) || isPrivateNetworkTarget(host)) {
      throw new Error(`${command} requires an HTTPS URL on a public network target`);
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
    maxLength: number = MAX_CONFIG_STRING_LENGTH,
    allowControls: boolean = false,
    failureMessage?: string,
  ): void {
    const value = raw[key];
    if (value === undefined || value === null) return;
    if (typeof value !== 'string' || value.length > maxLength ||
      (!allowControls && this.hasHeaderControl(value))) {
      throw new Error(failureMessage ?? `HttpTTS returned invalid ${key}`);
    }
    (target as Record<string, unknown>)[key] = value;
  }

  private hasHeaderControl(value: string): boolean {
    // Header values may contain horizontal tab, but all other C0/DEL bytes
    // are rejected at this boundary to prevent log/header/request smuggling.
    return /[\u0000-\u0008\u000a-\u001f\u007f]/.test(value);
  }
}
