import fileIo from '@ohos.file.fs';
import type { BusinessError } from '@ohos.base';
import util from '@ohos.util';
import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { replaceReaderAtomicSnapshot } from '../../app/ReaderAtomicSnapshotFile';
import type { ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';

import { RULES_MUTATION_METHODS } from './RulesMutationContract';
export interface RulesMutationIntent {
  version: 1; operationId: string; sequence: number; label: string;
  mutation: { method: string; params: JsonObject };
  /** Only a qualified actual terminal Core receipt; independent from cleanup ACK. */
  terminal?: JsonObject;
}
/** Single complete accepted delta over the existing AtomicFile primitive. The
 * static IO lane and warm tuple outlive Runtime replacement. Never evict an
 * unknown tuple, infer persistence from readText, or replace it with a draft. */
export class RulesMutationIntentStore {
  private static tail: Promise<void> = Promise.resolve();
  private static warm: RulesMutationIntent | undefined;
  private readonly runtime: ReadingGatewayRuntime;
  private acceptedIntent: RulesMutationIntent | undefined;
  constructor(runtime: ReadingGatewayRuntime) { this.runtime = runtime; }
  accepted(): RulesMutationIntent | undefined { return this.acceptedIntent; }
  async load(): Promise<RulesMutationIntent | undefined> {
    return this.serial(async (): Promise<RulesMutationIntent | undefined> => {
      this.assertCurrent(); const disk = await this.read(); this.assertCurrent();
      const warm = RulesMutationIntentStore.warm;
      if (warm !== undefined && disk !== undefined && !this.same(warm, disk)) throw new Error('规则原记录与暖状态冲突，不能覆盖');
      const intent = warm ?? disk; RulesMutationIntentStore.warm = intent; return intent;
    });
  }
  async accept(label: string, method: string, params: JsonObject,
    queryHead: () => Promise<number>, admitted: () => boolean): Promise<RulesMutationIntent> {
    return this.serial(async (): Promise<RulesMutationIntent> => {
      this.assertCurrent(); if (!admitted()) throw new Error('规则操作已退役，未接受');
      const disk = await this.read(); this.assertCurrent();
      if (disk !== undefined || RulesMutationIntentStore.warm !== undefined) throw new Error('上一规则原操作仍需核对，不能接受另一草稿');
      if (!RULES_MUTATION_METHODS.includes(method)) throw new Error('不属于已登记的有限规则命令');
      const fixed = JSON.parse(JSON.stringify(params)) as JsonObject;
      const head = await queryHead(); this.assertCurrent(); if (!admitted()) throw new Error('规则操作已退役，未接受');
      if (!Number.isSafeInteger(head) || head < 0 || head >= Number.MAX_SAFE_INTEGER) throw new Error('规则流水号不可继续，不能重置');
      const sequence = head + 1;
      const intent: RulesMutationIntent = { version: 1, operationId: `${util.generateRandomUUID()}/${sequence}`,
        sequence, label, mutation: { method, params: fixed } };
      RulesMutationIntentStore.warm = intent;
      this.acceptedIntent = intent;
      await this.write(intent); return intent;
    });
  }
  async ensureDurable(intent: RulesMutationIntent, admitted: () => boolean): Promise<void> {
    await this.serial(async (): Promise<void> => {
      this.assertCurrent(); if (!admitted()) throw new Error('规则服务已退役');
      const disk = await this.read(); this.assertCurrent(); if (!admitted()) throw new Error('规则服务已退役');
      if ((disk !== undefined && !this.same(disk, intent)) ||
        (RulesMutationIntentStore.warm !== undefined && !this.same(RulesMutationIntentStore.warm, intent))) throw new Error('旧规则记录不能覆盖新原操作');
      RulesMutationIntentStore.warm = intent; await this.write(intent);
    });
  }
  /** Caller supplies actual exact Core terminal receipt or original branded
   * undispatched proof. This clears only this tuple after real AtomicFile ACK. */
  async clear(intent: RulesMutationIntent, terminal?: JsonObject): Promise<void> {
    await this.serial(async (): Promise<void> => {
      this.assertCurrent(); const disk = await this.read(); this.assertCurrent();
      let warm = RulesMutationIntentStore.warm;
      if ((disk !== undefined && !this.same(disk, intent)) || (warm !== undefined && !this.same(warm, intent))) throw new Error('旧规则服务不能清除新原操作');
      if (terminal !== undefined) {
        warm = { ...intent, terminal }; RulesMutationIntentStore.warm = warm;
      }
      try { await this.replace(''); }
      catch (error) {
        // Preserve an already qualified terminal receipt across warm handoff
        // and, when IO permits, cold restart. Unknown cleanup cannot revoke it.
        if (warm?.terminal !== undefined) { try { await this.write(warm); } catch (_) {} }
        throw error;
      }
      this.assertCurrent();
      if (RulesMutationIntentStore.warm !== warm) throw new Error('规则清理回执已退役');
      RulesMutationIntentStore.warm = undefined;
    });
  }
  private async serial<T>(operation: () => Promise<T>): Promise<T> {
    const prior = RulesMutationIntentStore.tail; let release: (() => void) | undefined;
    RulesMutationIntentStore.tail = new Promise<void>((resolve): void => { release = resolve; });
    await prior; try { return await operation(); } finally { release?.(); }
  }
  private async read(): Promise<RulesMutationIntent | undefined> {
    let raw: string;
    try { raw = await fileIo.readText(this.path()); }
    catch (error) { if ((error as BusinessError).code === 13900002) return undefined; throw new Error('规则原记录暂时不可读，已停止新写入'); }
    if (raw === '') return undefined;
    const intent = JSON.parse(raw) as RulesMutationIntent;
    if (intent?.version !== 1 || !Number.isSafeInteger(intent.sequence) || intent.sequence <= 0 ||
      typeof intent.operationId !== 'string' || intent.operationId.length > 128 ||
      intent.operationId.split('/').pop() !== `${intent.sequence}` || typeof intent.label !== 'string' ||
      !RULES_MUTATION_METHODS.includes(intent.mutation?.method) || intent.mutation.params === null ||
      typeof intent.mutation.params !== 'object' || Array.isArray(intent.mutation.params)) throw new Error('规则原记录身份或内容无效，已保留');
    return intent;
  }
  private async write(intent: RulesMutationIntent): Promise<void> { this.assertCurrent(); await this.replace(JSON.stringify(intent)); }
  private async replace(raw: string): Promise<void> {
    const context = this.runtime.getUIAbilityContext?.(); if (context === undefined) throw new Error('规则持久记录能力不可用');
    await replaceReaderAtomicSnapshot(this.path(), context.filesDir, raw);
  }
  private path(): string {
    const context = this.runtime.getUIAbilityContext?.(); if (context === undefined) throw new Error('规则持久记录能力不可用');
    return `${context.filesDir}/reader-rules-mutation-intent-v1.json`;
  }
  private same(a: RulesMutationIntent, b: RulesMutationIntent): boolean {
    return a.operationId === b.operationId && a.sequence === b.sequence && JSON.stringify(a.mutation) === JSON.stringify(b.mutation);
  }
  private assertCurrent(): void { if (!ReaderRuntimeOwner.isCurrent(this.runtime as ReaderRuntimeOwner)) throw new Error('规则服务已退役，请由当前服务核对原记录'); }
}
