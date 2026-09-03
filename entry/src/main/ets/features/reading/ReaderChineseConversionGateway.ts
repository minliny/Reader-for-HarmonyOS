export type ReaderChineseConversionMode = 'none' | 't2s' | 's2t';

export type ReaderChineseConversionJsonObject = { [key: string]: unknown };

export interface ReaderChineseConversionRuntime {
  request(
    method: string,
    params?: ReaderChineseConversionJsonObject,
  ): Promise<{ data: ReaderChineseConversionJsonObject }>;
}

/**
 * Typed ArkUI boundary for Core-owned Chinese display conversion.
 *
 * This setting is deliberately separate from Appearance persistence and
 * replacement rules: Core persists it and applies it to local/remote visible
 * content, titles, search results, and the text later handed to TTS.
 */
export class ReaderChineseConversionGateway {
  private readonly runtime: ReaderChineseConversionRuntime;

  constructor(runtime: ReaderChineseConversionRuntime) {
    this.runtime = runtime;
  }

  async getMode(): Promise<ReaderChineseConversionMode> {
    const result = await this.runtime.request('reader.chinese-conversion.get', {});
    return this.decodeConfigMode(result.data['config'], 'reader.chinese-conversion.get');
  }

  async putMode(mode: ReaderChineseConversionMode): Promise<ReaderChineseConversionMode> {
    this.assertMode(mode, 'reader.chinese-conversion.put mode');
    const result = await this.runtime.request('reader.chinese-conversion.put', { mode });
    return this.decodeConfigMode(result.data['config'], 'reader.chinese-conversion.put');
  }

  private decodeConfigMode(value: unknown, label: string): ReaderChineseConversionMode {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`${label} config must be an object`);
    }
    const mode = (value as ReaderChineseConversionJsonObject)['mode'];
    this.assertMode(mode, `${label} config.mode`);
    return mode;
  }

  private assertMode(value: unknown, label: string): asserts value is ReaderChineseConversionMode {
    if (value !== 'none' && value !== 't2s' && value !== 's2t') {
      throw new Error(`${label} must be none, t2s, or s2t`);
    }
  }
}
