import fileIo from '@ohos.file.fs';
import type { BusinessError } from '@ohos.base';
import util from '@ohos.util';
import { ReaderCoreRequestError, isReaderCoreTransactionPendingError, type JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { replaceReaderAtomicSnapshot } from '../../app/ReaderAtomicSnapshotFile';
import type { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';

export interface ReadingOperationContext { sourceId: string; bookId: string; title?: string; author?: string; requestedCount?: number; confirmedBefore?: number; ownerAction?: 'createChapterStart' | 'createPosition' | 'delete' | 'clear' | 'retiredSourceCleanup' | 'settingsTextClear'; }
export interface ReadingOperationBinding { operationId: string; sequence: number; payloadFingerprint: string; }
export interface ReadingOperationIntent {
  version: 1;
  method: 'bookmark.create' | 'bookmark.delete' | 'cache.clear';
  params: JsonObject;
  context: ReadingOperationContext;
  phase: 'pending' | 'confirmed' | 'notDispatched';
  binding?: ReadingOperationBinding;
  result?: JsonObject;
}
interface ReadingQualifiedReceipt { binding: ReadingOperationBinding; phase: 'committed' | 'settled'; data: JsonObject; }
export interface ReadingRecoveredOperation { intent: ReadingOperationIntent; data: JsonObject; }
export class ReadingOperationPendingError extends Error {
  readonly intent?: ReadingOperationIntent;
  readonly blocked: boolean;
  readonly confirmed: boolean;
  constructor(message: string, intent?: ReadingOperationIntent, blocked: boolean = false, confirmed: boolean = false) {
    super(message); this.intent = intent; this.blocked = blocked; this.confirmed = confirmed;
  }
}
interface ReadingDomainLane { tail: Promise<void>; warm?: ReadingOperationIntent; }
const bookmarkLane: ReadingDomainLane = { tail: Promise.resolve() };
const cacheClearLane: ReadingDomainLane = { tail: Promise.resolve() };

/** Exactly two named domains. Shared IO is the existing platform AtomicFile
 * adapter; each domain has one fixed local intent and one serialized IO/RPC
 * lane. This is neither a task registry nor a retry/error bus. */
class ReadingDomainIntent {
  private readonly runtime: ReadingGatewayRuntime;
  private readonly ownsRuntime: () => boolean;
  private readonly domain: 'bookmark' | 'cacheClear';
  private readonly lane: ReadingDomainLane;
  constructor(runtime: ReadingGatewayRuntime, domain: 'bookmark' | 'cacheClear', ownsRuntime?: () => boolean) {
    this.runtime = runtime; this.domain = domain;
    this.ownsRuntime = ownsRuntime ?? ((): boolean => ReaderRuntimeOwner.isCurrent(runtime as ReaderRuntimeOwner));
    this.lane = domain === 'bookmark' ? bookmarkLane : cacheClearLane;
  }
  async pending(): Promise<ReadingOperationIntent | undefined> {
    return this.serial(async (): Promise<ReadingOperationIntent | undefined> => this.load());
  }
  async execute<T>(method: ReadingOperationIntent['method'], params: JsonObject, context: ReadingOperationContext,
    qualify: (data: JsonObject, intent: ReadingOperationIntent) => T, evidence: ReaderWriteEvidence | undefined, current: () => boolean): Promise<T> {
    return this.serial(async (): Promise<T> => {
      this.assertCurrent(); if (!current()) throw new Error('READING_OPERATION_RETIRED_BEFORE_DISPATCH');
      if (this.domain === 'bookmark' ? method !== 'bookmark.create' && method !== 'bookmark.delete' : method !== 'cache.clear')
        throw new ReadingOperationPendingError('操作与固定域不符', undefined, true);
      const old = await this.load();
      if (old !== undefined) throw new ReadingOperationPendingError('原操作仍需核对，不能覆盖或分配新标识', old);
      const head = await this.queryHead();
      this.assertCurrent(); if (!current()) throw new Error('READING_OPERATION_RETIRED_BEFORE_DISPATCH');
      const sequence = (head?.sequence ?? 0) + 1;
      if (!Number.isSafeInteger(sequence) || sequence < 1) throw new ReadingOperationPendingError('操作流水号已达到上限，不能重置', undefined, true);
      const operationId = `${util.generateRandomUUID()}/${sequence}`;
      const fixed = JSON.parse(JSON.stringify(params)) as JsonObject;
      const intent: ReadingOperationIntent = { version: 1, method,
        params: { ...fixed, operationId, sequence }, context: { ...context }, phase: 'pending' };
      this.lane.warm = intent;
      let submitted = false;
      try {
        // An AtomicFile/base+parent fsync ACK is required before Core admission.
        await this.write(intent); this.assertCurrent();
        if (!current()) throw new Error('READING_OPERATION_RETIRED_BEFORE_DISPATCH');
        submitted = true;
        return await this.dispatch(intent, qualify, evidence, false, current);
      } catch (error) {
        // Real local-before-RPC evidence permits cleanup. A later no-execution
        // error during continuation never proves the original call absent.
        if (!submitted) await this.abortKnownNotDispatched(intent);
        throw error as Error;
      }
    });
  }
  /** Exact pure read first. Null/head observations never submit a write or
   * clear the intent. Only a qualified receipt may reach metadata settlement. */
  async reconcile<T>(context: ReadingOperationContext, qualify: (data: JsonObject, intent: ReadingOperationIntent) => T,
    current: () => boolean): Promise<ReadingRecoveredOperation | undefined> {
    return this.serial(async (): Promise<ReadingRecoveredOperation | undefined> => {
      this.assertCurrent(); if (!current()) return undefined;
      const intent = await this.load(); if (intent === undefined) return undefined;
      this.assertContext(intent, context);
      if (intent.phase === 'notDispatched') { await this.clear(intent); return undefined; }
      const receipt = await this.queryKnownIntent(intent);
      if (receipt === undefined) throw new ReadingOperationPendingError('原操作结果尚未确认；可核对，或明确继续同一原操作', intent);
      qualify(receipt.data, intent);
      await this.finishQualified(intent, receipt.binding, receipt.phase, receipt.data);
      return { intent, data: receipt.data };
    });
  }
  /** Explicit user continuation only, never a retry from refresh/status. The
   * same durable complete ID/sequence/DTO is reused; no new mutation identity. */
  async continueOriginal<T>(context: ReadingOperationContext, qualify: (data: JsonObject, intent: ReadingOperationIntent) => T,
    evidence: ReaderWriteEvidence | undefined, current: () => boolean): Promise<ReadingRecoveredOperation | undefined> {
    return this.serial(async (): Promise<ReadingRecoveredOperation | undefined> => {
      this.assertCurrent(); if (!current()) return undefined;
      const intent = await this.load(); if (intent === undefined) return undefined;
      this.assertContext(intent, context);
      if (intent.phase === 'notDispatched') { await this.clear(intent); return undefined; }
      const receipt = await this.queryKnownIntent(intent);
      if (receipt !== undefined) {
        qualify(receipt.data, intent); await this.finishQualified(intent, receipt.binding, receipt.phase, receipt.data);
        evidence?.dispatched(); evidence?.confirmed(); return { intent, data: receipt.data };
      }
      this.assertCurrent(); if (!current()) return undefined;
      // Require another ACK of the exact same intent snapshot. Old opaque ID,
      // invalid expected DTO or a head which has passed it is already blocked.
      await this.write(intent); this.assertCurrent(); if (!current()) return undefined;
      const data = await this.dispatch(intent, (value): JsonObject => { qualify(value, intent); return value; }, evidence, true, current);
      return { intent, data };
    });
  }
  private async dispatch<T>(intent: ReadingOperationIntent, qualify: (data: JsonObject, intent: ReadingOperationIntent) => T,
    evidence: ReaderWriteEvidence | undefined, priorUnknown: boolean, current: () => boolean): Promise<T> {
    this.assertCurrent(); let entered = false;
    let data: JsonObject;
    try { data = (await this.runtime.request(intent.method, intent.params, {
      canDispatch: (): boolean => this.runtimeCurrent() && current(),
      onDispatch: (): void => { entered = true; evidence?.dispatched(); },
    })).data; }
    catch (error) {
      if (!entered || this.noExecution(error)) {
        evidence?.rejectedBeforeExecution();
        if (!priorUnknown) {
          await this.abortKnownNotDispatched(intent);
          throw new ReadingOperationPendingError((error as Error).message);
        }
      }
      throw new ReadingOperationPendingError((error as Error).message, intent);
    }
    // A result ACK itself also proves dispatch if a compatible test/runtime
    // adapter omitted the hook; production ReaderRuntimeOwner always invokes it.
    if (!entered) evidence?.dispatched();
    const value = qualify(data, intent); evidence?.confirmed();
    // A valid result ACK remains a business fact if later query/metadata/local
    // clear fails. These failures retain the same intent, never repeat writes.
    try {
      const receipt = await this.queryIntent(intent);
      if (receipt === undefined) throw new ReadingOperationPendingError('操作已回执，精确持久回执尚未可读，原标识已保留', intent, true);
      qualify(receipt.data, intent);
      await this.finishQualified(intent, receipt.binding, receipt.phase, receipt.data);
    } catch (error) { const issue = error as ReadingOperationPendingError;
      throw new ReadingOperationPendingError(issue.message, intent, issue.blocked === true, true); }
    return value;
  }
  private async queryHead(): Promise<ReadingOperationBinding | undefined> {
    const data = (await this.runtime.request(this.queryMethod(), {}, { canDispatch: (): boolean => this.runtimeCurrent() })).data;
    if (data['receipt'] !== null) throw new ReadingOperationPendingError('操作head查询返回了非空未知回执', undefined, true);
    return data['head'] === null ? undefined : this.binding(data['head']);
  }
  private async queryIntent(intent: ReadingOperationIntent): Promise<ReadingQualifiedReceipt | undefined> {
    this.assertCurrent();
    const expected: JsonObject = this.domain === 'bookmark' ? { action: intent.method === 'bookmark.create' ? 'create' : 'delete', params: intent.params } : intent.params;
    let data: JsonObject;
    try { data = (await this.runtime.request(this.queryMethod(), { operationId: intent.params['operationId'], expected }, { canDispatch: (): boolean => this.runtimeCurrent() })).data; }
    catch (error) { throw new ReadingOperationPendingError(`原操作核对不可用：${(error as Error).message}`, intent, true); }
    const head = data['head'] === null ? undefined : this.binding(data['head']);
    if (data['receipt'] === null) {
      if (intent.phase === 'confirmed') throw new ReadingOperationPendingError('已确认操作的精确回执缺失，已阻断；不能重新写入', intent, true, true);
      if (head !== undefined && head.sequence >= (intent.params['sequence'] as number))
        throw new ReadingOperationPendingError('原操作回执缺失且流水号已越过，已阻断，不能重新派发或猜测成功', intent, true);
      return undefined;
    }
    const receipt = this.object(data['receipt']); const binding = this.binding(receipt['binding']);
    if (head === undefined || head.sequence < binding.sequence || (head.sequence === binding.sequence &&
      (head.operationId !== binding.operationId || head.payloadFingerprint !== binding.payloadFingerprint)))
      throw new ReadingOperationPendingError('持久head与精确回执不符', intent, true);
    if (binding.operationId !== intent.params['operationId'] || binding.sequence !== intent.params['sequence'] ||
      (intent.binding !== undefined && (binding.payloadFingerprint !== intent.binding.payloadFingerprint || binding.operationId !== intent.binding.operationId)))
      throw new ReadingOperationPendingError('回执与原操作标识/指纹不符，已保留并阻断', intent, true);
    const phase = receipt['phase'];
    if (phase !== 'committed' && phase !== 'settled') throw new ReadingOperationPendingError('回执阶段无效', intent, true);
    let result: JsonObject;
    if (this.domain === 'bookmark') {
      const outcome = this.object(receipt['outcome']);
      if (outcome['action'] !== (intent.method === 'bookmark.create' ? 'create' : 'delete')) throw new ReadingOperationPendingError('回执动作不符', intent, true);
      result = this.object(outcome['result']);
    } else result = this.object(receipt['result']);
    return { binding, phase, data: result };
  }
  private async queryKnownIntent(intent: ReadingOperationIntent): Promise<ReadingQualifiedReceipt | undefined> {
    try { return await this.queryIntent(intent); }
    catch (error) { const issue = error as ReadingOperationPendingError;
      throw new ReadingOperationPendingError(issue.message, intent, issue.blocked === true, intent.phase === 'confirmed' || issue.confirmed === true); }
  }
  private async finishQualified(intent: ReadingOperationIntent, binding: ReadingOperationBinding,
    phase: 'committed' | 'settled', data: JsonObject): Promise<void> {
    try { await this.finish(intent, binding, phase, data); }
    catch (error) { const issue = error as ReadingOperationPendingError;
      throw new ReadingOperationPendingError(issue.message, { ...intent, phase: 'confirmed', binding, result: data }, issue.blocked === true, true); }
  }
  private async finish(intent: ReadingOperationIntent, binding: ReadingOperationBinding,
    phase: 'committed' | 'settled', data: JsonObject): Promise<void> {
    this.assertCurrent(); const confirmed: ReadingOperationIntent = { ...intent, phase: 'confirmed', binding, result: data };
    this.lane.warm = confirmed; await this.write(confirmed);
    if (phase !== 'settled') {
      this.assertCurrent();
      try {
        const result = (await this.runtime.request(this.settleMethod(), { ...binding }, { canDispatch: (): boolean => this.runtimeCurrent() })).data;
        const returned = this.binding(result['binding']);
        if (result['phase'] !== 'settled' || returned.operationId !== binding.operationId || returned.sequence !== binding.sequence || returned.payloadFingerprint !== binding.payloadFingerprint)
          throw new Error('invalid settle receipt');
      } catch (error) {
        // Lost metadata ACK is resolved with a read of this same exact ID.
        const observed = await this.queryIntent(confirmed);
        if (observed?.phase !== 'settled') throw new ReadingOperationPendingError('操作已确认，回执结算尚未确认，原标识已保留', confirmed);
      }
    }
    await this.clear(confirmed);
  }
  private async abortKnownNotDispatched(intent: ReadingOperationIntent): Promise<void> {
    this.assertCurrent(); const aborted: ReadingOperationIntent = { ...intent, phase: 'notDispatched' };
    this.lane.warm = aborted; await this.write(aborted); await this.clear(aborted);
  }
  private async load(): Promise<ReadingOperationIntent | undefined> {
    this.assertCurrent(); let raw: string;
    try { raw = await fileIo.readText(this.path()); }
    catch (error) { if ((error as BusinessError).code === 13900002) raw = ''; else throw new ReadingOperationPendingError('原操作记录暂不可读，已停止新操作'); }
    this.assertCurrent(); let disk: ReadingOperationIntent | undefined;
    if (raw !== '') {
      try { disk = JSON.parse(raw) as ReadingOperationIntent; } catch (_) { throw new ReadingOperationPendingError('原操作记录格式无效，已保留', undefined, true); }
      if (disk?.version !== 1 || (this.domain === 'bookmark' ? disk.method !== 'bookmark.create' && disk.method !== 'bookmark.delete' : disk.method !== 'cache.clear') ||
        !this.validNewId(disk.params?.['operationId'], disk.params?.['sequence']) ||
        typeof disk.context?.sourceId !== 'string' || typeof disk.context?.bookId !== 'string' ||
        (disk.context.requestedCount !== undefined && (!Number.isSafeInteger(disk.context.requestedCount) || disk.context.requestedCount < 1)) ||
        (disk.context.confirmedBefore !== undefined && (!Number.isSafeInteger(disk.context.confirmedBefore) || disk.context.confirmedBefore < 0 || disk.context.requestedCount === undefined || disk.context.confirmedBefore >= disk.context.requestedCount)) ||
        (disk.phase !== 'pending' && disk.phase !== 'confirmed' && disk.phase !== 'notDispatched'))
        throw new ReadingOperationPendingError('原操作记录身份/内容无效，已保留', disk, true);
      if (disk.phase === 'confirmed') {
        const binding = this.binding(disk.binding);
        if (binding.operationId !== disk.params['operationId'] || binding.sequence !== disk.params['sequence'])
          throw new ReadingOperationPendingError('确认记录与原操作身份不符', disk, true);
        this.object(disk.result);
      } else if (disk.binding !== undefined || disk.result !== undefined)
        throw new ReadingOperationPendingError('未确认记录包含非法回执资格', disk, true);
    }
    const warm = this.lane.warm;
    if (warm !== undefined && disk !== undefined && !this.same(warm, disk)) throw new ReadingOperationPendingError('原操作暖态与持久标识冲突，已停止覆盖', warm, true);
    this.lane.warm = warm ?? disk; return this.lane.warm;
  }
  private async write(intent: ReadingOperationIntent): Promise<void> {
    this.assertCurrent(); await this.replace(JSON.stringify(intent)); this.assertCurrent();
  }
  private async clear(intent: ReadingOperationIntent): Promise<void> {
    this.assertCurrent();
    if (this.lane.warm === undefined || !this.same(this.lane.warm, intent)) throw new ReadingOperationPendingError('旧服务不能清除另一标识', intent, true);
    await this.replace(''); this.assertCurrent();
    if (this.lane.warm === undefined || !this.same(this.lane.warm, intent)) throw new ReadingOperationPendingError('旧清理回执不能清除新标识', intent, true);
    this.lane.warm = undefined;
  }
  private async replace(raw: string): Promise<void> { const context = this.runtime.getUIAbilityContext?.(); if (context === undefined) throw new Error('READING_OPERATION_DURABLE_IO_UNAVAILABLE'); await replaceReaderAtomicSnapshot(this.path(), context.filesDir, raw); }
  private path(): string { const context = this.runtime.getUIAbilityContext?.(); if (context === undefined) throw new Error('READING_OPERATION_DURABLE_IO_UNAVAILABLE'); return `${context.filesDir}/${this.domain === 'bookmark' ? 'reader-bookmark-intent-v1.json' : 'reader-cache-clear-intent-v1.json'}`; }
  private runtimeCurrent(): boolean { try { return this.ownsRuntime(); } catch (_) { return false; } }
  private assertCurrent(): void { if (!this.runtimeCurrent()) throw new ReadingOperationPendingError('原Runtime已退役，请由当前服务核对保留记录'); }
  private same(a: ReadingOperationIntent, b: ReadingOperationIntent): boolean { return a.method === b.method && JSON.stringify(a.params) === JSON.stringify(b.params) && JSON.stringify(a.context) === JSON.stringify(b.context); }
  private assertContext(intent: ReadingOperationIntent, context: ReadingOperationContext): void { if (intent.context.sourceId !== context.sourceId || intent.context.bookId !== context.bookId || intent.context.title !== context.title || intent.context.author !== context.author) throw new ReadingOperationPendingError('另一实体的原操作仍需核对，请返回原内容', intent, true); }
  private validNewId(id: unknown, sequence: unknown): boolean {
    return typeof sequence === 'number' && Number.isSafeInteger(sequence) && sequence > 0 && typeof id === 'string' &&
      new RegExp('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/' + String(sequence) + '$').test(id);
  }
  private queryMethod(): string { return this.domain === 'bookmark' ? 'bookmark.operation.query' : 'cache.clear.operation.query'; }
  private settleMethod(): string { return this.domain === 'bookmark' ? 'bookmark.operation.settle' : 'cache.clear.operation.settle'; }
  private noExecution(error: unknown): boolean { return isReaderCoreTransactionPendingError(error) || (error instanceof ReaderCoreRequestError && error.event.error.details?.['nonExecution'] === true && (error.event.error.details?.['domain'] === (this.domain === 'bookmark' ? 'bookmark' : 'cacheClear') || error.event.error.details?.['domain'] === 'reading')); }
  private object(value: unknown): JsonObject { if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new ReadingOperationPendingError('原操作回执格式无效', this.lane.warm, true); return value as JsonObject; }
  private binding(value: unknown): ReadingOperationBinding { const b = this.object(value); if (typeof b['operationId'] !== 'string' || !Number.isSafeInteger(b['sequence']) || (b['sequence'] as number) <= 0 || typeof b['payloadFingerprint'] !== 'string' || !/^[0-9a-f]{64}$/.test(b['payloadFingerprint'])) throw new ReadingOperationPendingError('原操作回执身份无效', this.lane.warm, true); return { operationId: b['operationId'], sequence: b['sequence'] as number, payloadFingerprint: b['payloadFingerprint'] }; }
  private async serial<T>(work: () => Promise<T>): Promise<T> { const prior = this.lane.tail; let release: (() => void) | undefined; this.lane.tail = new Promise<void>((resolve): void => { release = resolve; }); await prior; try { return await work(); } finally { release?.(); } }
}
export class BookmarkOperationIntentStore extends ReadingDomainIntent { constructor(runtime: ReadingGatewayRuntime, ownsRuntime?: () => boolean) { super(runtime, 'bookmark', ownsRuntime); } }
/** Shared by Settings/Offline/retired-source cleanup: one cache-clear sequence,
 * mutex and fixed intent, never three consumer-specific journals. */
export class CacheClearOperationIntentStore extends ReadingDomainIntent { constructor(runtime: ReadingGatewayRuntime, ownsRuntime?: () => boolean) { super(runtime, 'cacheClear', ownsRuntime); } }
