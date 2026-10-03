import type { JsonObject } from '@reader/core-harmony';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { RulesMutationOwner, type RulesMutationSnapshot } from '../settings/RulesMutationOwner';
import { RulesManagementGateway } from '../settings/RulesManagementGateway';

export type ReaderChineseConversionMode = 'none' | 't2s' | 's2t';
export type ReaderChineseConversionJsonObject = JsonObject;
export type ReaderChineseConversionRuntime = ReadingGatewayRuntime;

/** Original Core processing configuration. Conversion, replacement rules and
 * their local-coordinate updates share the existing exact processing authority. */
export class ReaderChineseConversionGateway {
  private readonly runtime: ReadingGatewayRuntime;
  constructor(runtime: ReadingGatewayRuntime) { this.runtime = runtime; }
  snapshot(): RulesMutationSnapshot { return RulesMutationOwner.forRuntime(this.runtime).snapshot(); }
  async recoverOriginal(current: () => boolean, explicit: boolean = false): Promise<RulesMutationSnapshot> {
    return new RulesManagementGateway(this.runtime as ReaderRuntimeOwner).recoverMutation(current,explicit);
  }
  async getMode(current: () => boolean = (): boolean => true): Promise<ReaderChineseConversionMode> {
    const result = await this.runtime.request('reader.chinese-conversion.get', {}, { canDispatch:current });
    return this.decodeConfigMode(result.data['config'], 'reader.chinese-conversion.get');
  }
  async putMode(mode: ReaderChineseConversionMode, current: () => boolean = (): boolean => true): Promise<ReaderChineseConversionMode> {
    this.assertMode(mode, 'reader.chinese-conversion.put mode');
    if (this.runtime.supportsCoreCapability?.('rules.mutation.conversion.v1') !== true) throw new Error('当前 Core 不具备转换原操作回执能力，未派发');
    return RulesMutationOwner.forRuntime(this.runtime).run('简繁转换保存',current,async (request,confirmed): Promise<ReaderChineseConversionMode> => {
      const result = await request('reader.chinese-conversion.put',{mode});
      const actual = this.decodeConfigMode(result.data['config'],'reader.chinese-conversion.put');
      if (actual !== mode || (result.data['config'] as JsonObject)['configId'] !== 1) throw new Error('转换原回执不匹配');
      confirmed(); return actual;
    });
  }
  private decodeConfigMode(value: unknown, label: string): ReaderChineseConversionMode {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${label} config must be an object`);
    const mode = (value as JsonObject)['mode']; this.assertMode(mode,`${label} config.mode`); return mode;
  }
  private assertMode(value: unknown, label: string): asserts value is ReaderChineseConversionMode {
    if (value !== 'none' && value !== 't2s' && value !== 's2t') throw new Error(`${label} must be none, t2s, or s2t`);
  }
}
