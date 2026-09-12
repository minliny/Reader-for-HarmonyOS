import { asset } from '@kit.AssetStoreKit';
import { util } from '@kit.ArkTS';
import type { BusinessError } from '@kit.BasicServicesKit';
import { isReaderTtsCredentialAliasForConfig } from '../features/reading/ReaderOnlineTtsProfile.ts';

/** Platform AssetStore owns secret bytes. Core receives an immutable alias only. */
export class ReaderTtsCredentialStore {
  static readonly instance: ReaderTtsCredentialStore = new ReaderTtsCredentialStore();
  private bytes(value: string): Uint8Array { return new util.TextEncoder().encodeInto(value); }
  async read(alias?: string, expectedConfigId?: number): Promise<string> {
    if (alias === undefined) return '';
    if (typeof alias !== 'string' || alias.length === 0) throw new Error('在线语音密钥引用无效');
    this.assertAlias(alias, expectedConfigId);
    const query = new Map<asset.Tag, asset.Value>();
    query.set(asset.Tag.ALIAS, this.bytes(alias)); query.set(asset.Tag.RETURN_TYPE, asset.ReturnType.ALL);
    try {
      const records = await asset.query(query);
      if (records.length === 0) throw new Error('在线语音密钥不存在，请重新填写');
      const value = records[0].get(asset.Tag.SECRET);
      if (!(value instanceof Uint8Array)) throw new Error('在线语音密钥无法读取');
      const decoded = util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(value);
      if (decoded.length === 0 || decoded.length > 8192 || value.length > 8192 ||
        /[\u0000-\u001f\u007f]/.test(decoded)) {
        throw new Error('在线语音密钥格式无效');
      }
      return decoded;
    } catch (_) { throw new Error('在线语音密钥无法读取，请重新填写'); }
  }
  async create(id: number, value: string): Promise<string> {
    if (!Number.isSafeInteger(id) || id < 0 || typeof value !== 'string' || value.length === 0 ||
      value.length > 8192 || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error('在线语音密钥格式无效');
    }
    const secretBytes = this.bytes(value);
    if (secretBytes.length > 8192) throw new Error('在线语音密钥格式无效');
    const alias = `reader.tts.${id}.${util.generateRandomUUID(true)}`;
    const attributes = new Map<asset.Tag, asset.Value>();
    attributes.set(asset.Tag.ALIAS, this.bytes(alias)); attributes.set(asset.Tag.SECRET, secretBytes);
    attributes.set(asset.Tag.ACCESSIBILITY, asset.Accessibility.DEVICE_POWERED_ON);
    attributes.set(asset.Tag.CONFLICT_RESOLUTION, asset.ConflictResolution.THROW_ERROR);
    try { await asset.add(attributes); } catch (_) { throw new Error('在线语音密钥保存失败，请重试'); }
    return alias;
  }
  async remove(alias?: string, expectedConfigId?: number): Promise<void> {
    if (alias === undefined) return;
    if (typeof alias !== 'string' || alias.length === 0) throw new Error('在线语音密钥引用无效');
    this.assertAlias(alias, expectedConfigId);
    const query = new Map<asset.Tag, asset.Value>(); query.set(asset.Tag.ALIAS, this.bytes(alias));
    try { await asset.remove(query); } catch (error) {
      const failure = error as BusinessError;
      if (failure.code !== asset.ErrorCode.NOT_FOUND) throw new Error('旧在线语音密钥清理失败');
    }
  }
  private assertAlias(alias: string, expectedConfigId?: number): void {
    if (!isReaderTtsCredentialAliasForConfig(alias, expectedConfigId)) {
      throw new Error('在线语音密钥引用无效');
    }
  }
}
