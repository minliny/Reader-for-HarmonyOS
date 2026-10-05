import fileIo from '@ohos.file.fs';
import type { BusinessError } from '@ohos.base';
import util from '@ohos.util';
import type { JsonObject } from '@reader/core-harmony';
import { BookRequestNotDispatchedError } from '../../app/BookRequestScheduler';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { replaceReaderAtomicSnapshot } from '../../app/ReaderAtomicSnapshotFile';
import { sha256Hex } from '../../app/BundledBookSourceSupply';
import type { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';

export type BookshelfManagementMethod = 'book-group.create' | 'book-group.update' | 'book-group.delete' | 'bookshelf.group.assign' | 'bookshelf.remove' | 'bookshelf.removeBatch';
export function isBookshelfRemovalMethod(method: BookshelfManagementMethod | undefined): boolean {
  return method === 'bookshelf.remove' || method === 'bookshelf.removeBatch';
}
export interface BookshelfManagementIntent {
  version: 1; operationId: string; sequence: number;
  mutation: { method: BookshelfManagementMethod; params: JsonObject };
  terminal?: JsonObject;
  recordFingerprint?: string;
}
export interface BookshelfManagementMutationState {
  confirmation: 'undispatched' | 'unknown' | 'confirmed';
  blocked: boolean; canContinueOriginal: boolean; message: string;
  operationId?: string; sequence?: number; method?: BookshelfManagementMethod;
  sourceId?: string; bookId?: string; group?: string;
}
interface ManagementReceipt { binding: { operationId: string; sequence: number; payloadFingerprint: string };
  method: BookshelfManagementMethod; outcome: 'applied' | 'rejected'; data: JsonObject; ackFingerprint: string; }
interface ManagementQuery { head?: { operationId: string; sequence: number; payloadFingerprint?: string };
  receipt?: ManagementReceipt; canApplySameOriginal: boolean; }
const METHODS: BookshelfManagementMethod[] = ['book-group.create', 'book-group.update', 'book-group.delete', 'bookshelf.group.assign', 'bookshelf.remove', 'bookshelf.removeBatch'];

/** One fixed complete group/membership intent over the existing AtomicFile.
 * The original management orchestrator owns business serialization. This IO
 * lane protects its original tuple across Runtime and process replacement;
 * it never infers a write receipt from current group/book list values. */
export class BookshelfManagementIntentStore {
  private static readonly retained: WeakMap<ReaderRuntimeOwner, BookshelfManagementIntentStore> = new WeakMap();
  static forRuntime(owner: ReaderRuntimeOwner): BookshelfManagementIntentStore {
    if (!ReaderRuntimeOwner.isCurrent(owner)) throw new Error('BOOKSHELF_MANAGEMENT_OWNER_RETIRED');
    let store = this.retained.get(owner);
    if (store === undefined) { store = new BookshelfManagementIntentStore(owner); this.retained.set(owner, store); }
    return store;
  }
  private static tail: Promise<void> = Promise.resolve();
  private static warm: BookshelfManagementIntent | undefined;
  private readonly owner: ReaderRuntimeOwner;
  private state: BookshelfManagementMutationState = { confirmation: 'undispatched', blocked: false,
    canContinueOriginal: false, message: '' };
  constructor(owner: ReaderRuntimeOwner) { this.owner = owner; }
  snapshot(): BookshelfManagementMutationState { return { ...this.state }; }
  original(): BookshelfManagementIntent | undefined {
    const value = BookshelfManagementIntentStore.warm;
    return value?.operationId === this.state.operationId ? JSON.parse(JSON.stringify(value)) as BookshelfManagementIntent : undefined;
  }

  async execute<T>(method: BookshelfManagementMethod, params: JsonObject,
    qualify: (method: BookshelfManagementMethod, params: JsonObject, data: JsonObject) => T,
    evidence: ReaderWriteEvidence | undefined, admitted: () => boolean): Promise<T> {
    return this.serial(async (): Promise<T> => {
      this.assertCurrent(admitted);
      let old: BookshelfManagementIntent | undefined;
      let head: ManagementQuery = { canApplySameOriginal: false };
      try {
        this.requireCapability(method); old = await this.load();
        if (old === undefined) head = await this.query(undefined, admitted);
      } catch (error) {
        this.state.blocked = true; this.state.canContinueOriginal = false;
        this.state.message = (error as Error).message;
        throw error as Error;
      }
      if (old !== undefined) { this.pending(old); throw new Error(this.state.message); }
      const sequence = (head.head?.sequence ?? 0) + 1;
      if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('书架管理流水号不可继续，不能重置');
      this.assertCurrent(admitted);
      const intent: BookshelfManagementIntent = { version: 1,
        operationId: `${util.generateRandomUUID()}/${sequence}`, sequence,
        mutation: { method, params: JSON.parse(JSON.stringify(params)) as JsonObject } };
      BookshelfManagementIntentStore.warm = intent; this.pending(intent);
      // Failure of local durability admission cannot lead to Core dispatch.
      await this.write(intent); this.assertCurrent(admitted);
      let dispatched = false;
      try {
        const event = await this.owner.request('bookshelf.management.mutation.apply', this.params(intent), {
          canDispatch: (): boolean => this.current(admitted),
          onDispatch: (): void => { dispatched = true; evidence?.dispatched(); },
        });
        const receipt = await this.receipt(event.data, intent);
        if (receipt.outcome === 'rejected') {
          evidence?.rejectedBeforeExecution(); await this.finish(intent, receipt, 'undispatched');
          throw new Error(this.rejection(receipt));
        }
        const value = qualify(method, intent.mutation.params, receipt.data);
        if (!dispatched) throw new Error('书架管理回执缺少实际派发证据');
        evidence?.confirmed(); await this.finish(intent, receipt, 'confirmed'); return value;
      } catch (error) {
        if (error instanceof BookRequestNotDispatchedError && !dispatched) {
          evidence?.rejectedBeforeExecution();
          // A branded last-boundary non-dispatch is about this newly accepted
          // request only. An explicit continuation never clears an old unknown.
          await this.clearKnownNotDispatched(intent);
        }
        throw error as Error;
      }
    });
  }

  /** Pure original-ID query; only the explicit continuation may apply the
   * same complete DTO again, and only with Core's qualified permission. */
  async recover(qualify: (method: BookshelfManagementMethod, params: JsonObject, data: JsonObject) => unknown,
    admitted: () => boolean, continueOriginal: boolean = false): Promise<BookshelfManagementMutationState> {
    return this.serial(async (): Promise<BookshelfManagementMutationState> => {
      this.assertCurrent(admitted); let intent: BookshelfManagementIntent | undefined;
      try { intent = await this.load(); }
      catch (error) {
        const known = BookshelfManagementIntentStore.warm?.terminal?.['outcome'];
        this.state.confirmation = known === 'applied' ? 'confirmed' : known === 'rejected' ? 'undispatched' : 'unknown';
        this.state.blocked = true; this.state.canContinueOriginal = false;
        this.state.message = (error as Error).message; throw error as Error;
      }
      if (intent === undefined) { this.state.blocked = false; this.state.canContinueOriginal = false; return this.snapshot(); }
      this.pending(intent);
      try {
        let receipt = intent.terminal === undefined ? undefined : await this.receipt(intent.terminal, intent);
        if (receipt === undefined) {
          this.requireCapability(intent.mutation.method); const query = await this.query(intent, admitted); receipt = query.receipt;
          if (receipt === undefined) {
            this.state.canContinueOriginal = query.canApplySameOriginal;
            this.state.message = query.canApplySameOriginal ?
              `${isBookshelfRemovalMethod(intent.mutation.method) ? '原删除' : '原分组'}操作尚未确认；可明确继续已保留的原操作，不会创建新标识` :
              `${isBookshelfRemovalMethod(intent.mutation.method) ? '原删除' : '原分组'}操作尚无精确回执，已保留并阻断；当前列表不能确认此次写入`;
            if (!continueOriginal) return this.snapshot();
            if (!query.canApplySameOriginal) throw new Error(this.state.message);
            // Re-establish local fsync ACK before the same original admission.
            await this.write(intent); this.assertCurrent(admitted);
            let dispatched = false;
            const event = await this.owner.request('bookshelf.management.mutation.apply', this.params(intent), {
              canDispatch: (): boolean => this.current(admitted), onDispatch: (): void => { dispatched = true; } });
            receipt = await this.receipt(event.data, intent);
            if (!dispatched) throw new Error('续原分组回执缺少实际派发证据');
          }
        }
        if (receipt.outcome === 'applied') qualify(intent.mutation.method, intent.mutation.params, receipt.data);
        await this.finish(intent, receipt, receipt.outcome === 'applied' ? 'confirmed' : 'undispatched');
        if (receipt.outcome === 'rejected') this.state.message = this.rejection(receipt);
        return this.snapshot();
      } catch (error) {
        if (this.state.confirmation !== 'confirmed') this.state.confirmation = 'unknown';
        this.state.blocked = true; this.state.canContinueOriginal = false;
        this.state.message = (error as Error).message; throw error as Error;
      }
    });
  }

  /** Core deletion and local EPUB release have separate ACKs. Pure recovery
   * retains the qualified terminal until an explicit original cleanup intent
   * (or the initial accepted delete) completes. The shared lane prevents a
   * new group/delete from racing that release and reusing the original asset. */
  async completeRemoval(operationId: string, cleanup: (intent: BookshelfManagementIntent) => Promise<void>,
    admitted: () => boolean): Promise<void> {
    await this.serial(async (): Promise<void> => {
      this.assertCurrent(admitted);
      const intent = await this.load();
      if (intent === undefined || intent.operationId !== operationId || !isBookshelfRemovalMethod(intent.mutation.method) ||
        intent.terminal === undefined) throw new Error('原删除清理身份或精确回执已改变');
      const receipt = await this.receipt(intent.terminal, intent);
      if (receipt.outcome !== 'applied') throw new Error('原删除未获 Core 确认，不能清理资产');
      this.pending(intent); this.state.confirmation = 'confirmed'; this.state.canContinueOriginal = true;
      try {
        this.assertCurrent(admitted); await cleanup(intent); this.assertCurrent(admitted);
        await this.clear(intent); this.state.blocked = false; this.state.canContinueOriginal = false; this.state.message = '';
      } catch (error) {
        this.state.blocked = true; this.state.canContinueOriginal = this.current(admitted);
        this.state.message = `书籍已移出书架；原删除资产或记录清理未完成：${(error as Error).message}`;
        throw error as Error;
      }
    });
  }

  private async query(intent: BookshelfManagementIntent | undefined, admitted: () => boolean): Promise<ManagementQuery> {
    const data = (await this.owner.request('bookshelf.management.mutation.query', intent === undefined ? {} :
      { operationId: intent.operationId, expected: this.params(intent) }, { canDispatch: (): boolean => this.current(admitted) })).data;
    const headValue = data['head']; let head: ManagementQuery['head'];
    if (headValue !== null) {
      const h = this.object(headValue);
      if (typeof h['operationId'] !== 'string' || !Number.isSafeInteger(h['sequence']) || (h['sequence'] as number) < 1)
        throw new Error('书架管理head身份无效');
      if (h['payloadFingerprint'] !== undefined && !this.fingerprint(h['payloadFingerprint'])) throw new Error('书架管理head指纹无效');
      head = h as unknown as ManagementQuery['head'];
    }
    if (typeof data['canApplySameOriginal'] !== 'boolean') throw new Error('书架管理续原操作资格缺失');
    if (intent === undefined && (data['receipt'] !== null || data['canApplySameOriginal'] !== false))
      throw new Error('书架管理head查询返回无归属回执或续写资格');
    const receipt = data['receipt'] === null ? undefined : await this.receipt(this.object(data['receipt']), intent!);
    if (receipt !== undefined && (head === undefined || head.sequence < receipt.binding.sequence ||
      (head.sequence === receipt.binding.sequence && (head.operationId !== receipt.binding.operationId ||
        (head.payloadFingerprint !== undefined && head.payloadFingerprint !== receipt.binding.payloadFingerprint)))))
      throw new Error('书架管理head与原回执不符');
    // Core also permits an already exact-confirmed tuple's idempotent apply.
    // Receipt consumers settle that receipt without issuing another write.
    if (data['canApplySameOriginal'] === true && (intent === undefined ||
      (head?.sequence ?? 0) !== (receipt === undefined ? intent.sequence - 1 : intent.sequence)))
      throw new Error('书架管理续原操作资格与实际流水不符');
    return { head, receipt, canApplySameOriginal: data['canApplySameOriginal'] as boolean };
  }
  private async receipt(raw: JsonObject, intent: BookshelfManagementIntent): Promise<ManagementReceipt> {
    const b = this.object(raw['binding']);
    if (b['operationId'] !== intent.operationId || b['sequence'] !== intent.sequence || !this.fingerprint(b['payloadFingerprint']) ||
      raw['method'] !== intent.mutation.method || !this.fingerprint(raw['ackFingerprint']) ||
      (raw['outcome'] !== 'applied' && raw['outcome'] !== 'rejected'))
      throw new Error('书架管理回执与原完整操作身份不符');
    this.object(raw['data']);
    if (raw['ackFingerprint'] !== await sha256Hex(JSON.stringify([raw['method'], raw['outcome'], raw['data']])))
      throw new Error('书架管理原回执完整结果校验失败');
    return raw as unknown as ManagementReceipt;
  }
  private async finish(intent: BookshelfManagementIntent, receipt: ManagementReceipt,
    confirmation: 'confirmed' | 'undispatched'): Promise<void> {
    this.state.confirmation = confirmation; this.state.canContinueOriginal = false;
    const terminal: BookshelfManagementIntent = { ...intent, terminal: receipt as unknown as JsonObject };
    BookshelfManagementIntentStore.warm = terminal;
    try {
      // Preserve the actual qualified receipt if cleanup ACK is lost. An ACK
      // already obtained from original Runtime remains truth after retirement.
      await this.write(terminal);
      if (confirmation === 'confirmed' && isBookshelfRemovalMethod(intent.mutation.method)) {
        this.state.blocked = true; this.state.canContinueOriginal = true;
        this.state.message = '书籍已移出书架；原删除资产与记录清理仍需完成';
      } else {
        await this.clear(terminal); this.state.blocked = false; this.state.message = '';
      }
    } catch (_) {
      this.state.blocked = true;
      this.state.message = `${confirmation === 'confirmed' ? '原书架写入已确认' : 'Core 已明确拒绝原书架操作'}；记录清理尚未确认，请核对`;
    }
  }
  private pending(intent: BookshelfManagementIntent): void {
    this.state = { confirmation: intent.terminal?.['outcome'] === 'applied' ? 'confirmed' :
      intent.terminal?.['outcome'] === 'rejected' ? 'undispatched' : 'unknown', blocked: true, canContinueOriginal: false,
      message: isBookshelfRemovalMethod(intent.mutation.method) ? '原删除操作仍需核对，不能覆盖原内容或执行另一分组/删除写入' :
        '原分组操作仍需核对，不能覆盖原内容或执行另一分组/删除写入',
      operationId: intent.operationId, sequence: intent.sequence, method: intent.mutation.method };
    if (intent.mutation.method === 'bookshelf.group.assign' || intent.mutation.method === 'bookshelf.remove') {
      this.state.sourceId = intent.mutation.params['sourceId'] as string;
      this.state.bookId = intent.mutation.params['bookId'] as string;
      this.state.group = intent.mutation.params['group'] as string;
    }
  }
  private async load(): Promise<BookshelfManagementIntent | undefined> {
    this.assertCurrent(); let raw: string;
    try { raw = await fileIo.readText(this.path()); }
    catch (error) { if ((error as BusinessError).code === 13900002) raw = ''; else throw new Error('原分组记录不可读，已停止新写入'); }
    let disk: BookshelfManagementIntent | undefined;
    if (raw !== '') {
      disk = JSON.parse(raw) as BookshelfManagementIntent;
      if (disk?.version !== 1 || !Number.isSafeInteger(disk.sequence) || disk.sequence < 1 ||
        typeof disk.operationId !== 'string' || !new RegExp('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/' + disk.sequence + '$').test(disk.operationId) ||
        !METHODS.includes(disk.mutation?.method)) throw new Error('原分组记录身份/命令无效，已保留');
      this.object(disk.mutation.params);
      if (!this.fingerprint(disk.recordFingerprint) || await sha256Hex(this.raw(disk, false)) !== disk.recordFingerprint)
        throw new Error('原分组记录完整内容校验失败，已保留');
      if (disk.terminal !== undefined) await this.receipt(disk.terminal, disk);
    }
    const warm = BookshelfManagementIntentStore.warm;
    if (warm !== undefined && disk !== undefined && !this.same(warm, disk)) throw new Error('原分组暖状态与持久记录冲突，禁止覆盖');
    const result = warm ?? disk; BookshelfManagementIntentStore.warm = result; return result;
  }
  private async write(intent: BookshelfManagementIntent): Promise<void> {
    this.assertCurrent(); intent.recordFingerprint = await sha256Hex(this.raw(intent, false)); this.assertCurrent();
    await this.replace(this.raw(intent, true));
  }
  private async clear(intent: BookshelfManagementIntent): Promise<void> {
    this.assertCurrent();
    if (BookshelfManagementIntentStore.warm === undefined || !this.same(BookshelfManagementIntentStore.warm, intent))
      throw new Error('旧分组服务不能清除另一原操作');
    await this.replace(''); this.assertCurrent();
    if (BookshelfManagementIntentStore.warm === undefined || !this.same(BookshelfManagementIntentStore.warm, intent))
      throw new Error('旧分组清理回执不能清除新原操作');
    BookshelfManagementIntentStore.warm = undefined;
  }
  private async clearKnownNotDispatched(intent: BookshelfManagementIntent): Promise<void> {
    this.state.confirmation = 'undispatched'; this.state.canContinueOriginal = false;
    try { await this.clear(intent); this.state.blocked = false; } catch (_) { this.state.blocked = true; }
  }
  private raw(intent: BookshelfManagementIntent, fingerprint: boolean): string {
    return JSON.stringify({ version: intent.version, operationId: intent.operationId, sequence: intent.sequence,
      mutation: intent.mutation, terminal: intent.terminal,
      recordFingerprint: fingerprint ? intent.recordFingerprint : undefined });
  }
  private same(a: BookshelfManagementIntent, b: BookshelfManagementIntent): boolean {
    return a.operationId === b.operationId && a.sequence === b.sequence && JSON.stringify(a.mutation) === JSON.stringify(b.mutation);
  }
  private params(intent: BookshelfManagementIntent): JsonObject {
    return { operationId: intent.operationId, sequence: intent.sequence, mutation: intent.mutation };
  }
  private async replace(raw: string): Promise<void> {
    const context = this.owner.getUIAbilityContext(); await replaceReaderAtomicSnapshot(this.path(), context.filesDir, raw);
  }
  private path(): string { return `${this.owner.getUIAbilityContext().filesDir}/reader-bookshelf-management-intent-v1.json`; }
  private current(admitted?: () => boolean): boolean {
    try { return ReaderRuntimeOwner.isCurrent(this.owner) && (admitted?.() ?? true); } catch (_) { return false; }
  }
  private assertCurrent(admitted?: () => boolean): void { if (!this.current(admitted)) throw new Error('原分组服务已退役，保留记录由当前服务核对'); }
  private requireCapability(method: BookshelfManagementMethod): void {
    const capability = isBookshelfRemovalMethod(method) ? 'bookshelf.removalMutation.v1' : 'bookshelf.managementMutation.v1';
    if (!this.owner.supportsCoreCapability(capability)) throw new Error('当前 Core 缺少书架原操作精确回执能力，已停止新写入');
  }
  private fingerprint(value: unknown): boolean { return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value); }
  private object(value: unknown): JsonObject {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('分组原操作回执结构无效'); return value as JsonObject;
  }
  private rejection(receipt: ManagementReceipt): string {
    const error = receipt.data['error'];
    return error !== null && typeof error === 'object' && typeof (error as JsonObject)['message'] === 'string' ?
      (error as JsonObject)['message'] as string : 'Core 明确拒绝原分组操作';
  }
  private async serial<T>(work: () => Promise<T>): Promise<T> {
    const prior = BookshelfManagementIntentStore.tail; let release: (() => void) | undefined;
    BookshelfManagementIntentStore.tail = new Promise<void>((resolve): void => { release = resolve; });
    await prior; try { return await work(); } finally { release?.(); }
  }
}
