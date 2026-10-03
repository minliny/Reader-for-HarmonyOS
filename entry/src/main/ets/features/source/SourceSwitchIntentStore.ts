import fileIo from '@ohos.file.fs';
import type { BusinessError } from '@ohos.base';
import util from '@ohos.util';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { SourceSwitchGateway, type SourceSwitchCommitParams, type SourceSwitchTransactionProjection } from './SourceSwitchGateway';

const INTENT_FILE = 'reader-source-switch-intent-v1.json';
export interface SourceSwitchIntent {
  version: 1;
  operationId: string;
  sequence: number;
  params: SourceSwitchCommitParams;
  phase: 'pending' | 'confirmed';
  receipt?: SourceSwitchTransactionProjection;
}
export class SourceSwitchIntentRecoveryError extends Error {
  readonly kind: 'pending' | 'blocked';
  constructor(kind: 'pending' | 'blocked', message: string) { super(message); this.kind = kind; }
}

/** One domain-local fixed intent. Existing platform UUID/AtomicFile and Core
 * journal/head supply identity/persistence/dedup; this is only Reader admission.
 * Real IO stays serialized across Runtime replacement. Reading a file is never
 * a durable write ACK; no new payload replaces a pending/uncleared intent.
 * Preferences' 8192-character value limit cannot hold a normal complete TOC. */
export class SourceSwitchIntentStore {
  private readonly runtime: ReaderRuntimeOwner;
  private readonly gateway: SourceSwitchGateway;
  private static tail: Promise<void> = Promise.resolve();
  private static warmIntent: SourceSwitchIntent | undefined;

  constructor(runtime: ReaderRuntimeOwner, gateway: SourceSwitchGateway) { this.runtime = runtime; this.gateway = gateway; }

  async load(): Promise<SourceSwitchIntent | undefined> {
    return this.serial(async (): Promise<SourceSwitchIntent | undefined> => {
      this.assertCurrent();
      const disk = await this.read();
      this.assertCurrent();
      const warm = SourceSwitchIntentStore.warmIntent;
      if (warm !== undefined && disk !== undefined && !this.sameIntent(warm, disk)) {
        throw new SourceSwitchIntentRecoveryError('blocked', '换源待核对标识与持久记录冲突，已保留并停止覆盖');
      }
      const intent = warm ?? disk;
      SourceSwitchIntentStore.warmIntent = intent;
      return intent;
    });
  }

  async accept(params: SourceSwitchCommitParams, admitted: () => boolean): Promise<SourceSwitchIntent> {
    return this.serial(async (): Promise<SourceSwitchIntent> => {
      this.assertCurrent(); if (!admitted()) throw new SourceSwitchIntentRecoveryError('pending', '换源操作已退役');
      const disk = await this.read(), warm = SourceSwitchIntentStore.warmIntent;
      this.assertCurrent(); if (!admitted()) throw new SourceSwitchIntentRecoveryError('pending', '换源操作已退役');
      if (disk !== undefined || warm !== undefined) {
        throw new SourceSwitchIntentRecoveryError('blocked', '上一次换源仍需核对，不能覆盖或创建另一标识');
      }
      const operationId = util.generateRandomUUID();
      const query = await this.gateway.queryTransaction(operationId, undefined, admitted);
      this.assertCurrent(); if (!admitted()) throw new SourceSwitchIntentRecoveryError('pending', '换源操作已退役');
      if (query.transaction !== undefined) throw new SourceSwitchIntentRecoveryError('blocked', '换源标识已存在，不能重新分配');
      const watermark = query.head?.sequence ?? 0;
      if (!Number.isSafeInteger(watermark) || watermark < 0 || watermark >= Number.MAX_SAFE_INTEGER) {
        throw new SourceSwitchIntentRecoveryError('blocked', '换源流水号已达到上限，不能重置');
      }
      const sequence = watermark + 1;
      // JSON round-trip fixes optional omissions and breaks mutable page/TOC
      // references before persistence; no hashing or chapter matcher is invented.
      const fixed = JSON.parse(JSON.stringify(params)) as SourceSwitchCommitParams;
      const intent: SourceSwitchIntent = { version: 1, operationId, sequence,
        params: { ...fixed, operationId, sequence }, phase: 'pending' };
      SourceSwitchIntentStore.warmIntent = intent;
      await this.write(intent);
      return intent;
    });
  }

  /** Retry only the exact idempotent AtomicFile snapshot and require ACK. */
  async ensureDurable(intent: SourceSwitchIntent, admitted: () => boolean): Promise<void> {
    await this.serial(async (): Promise<void> => {
      this.assertCurrent(); if (!admitted()) throw new SourceSwitchIntentRecoveryError('pending', '换源操作已退役');
      const disk = await this.read(), warm = SourceSwitchIntentStore.warmIntent;
      this.assertCurrent(); if (!admitted()) throw new SourceSwitchIntentRecoveryError('pending', '换源操作已退役');
      if ((disk !== undefined && !this.sameIntent(disk, intent)) || (warm !== undefined && !this.sameIntent(warm, intent))) {
        throw new SourceSwitchIntentRecoveryError('blocked', '旧换源标识不能覆盖新待核对记录');
      }
      SourceSwitchIntentStore.warmIntent = intent;
      await this.write(intent);
    });
  }

  async confirm(intent: SourceSwitchIntent, receipt: SourceSwitchTransactionProjection): Promise<void> {
    await this.serial(async (): Promise<void> => {
      this.assertCurrent();
      const disk = await this.read(), warm = SourceSwitchIntentStore.warmIntent;
      this.assertCurrent();
      if ((disk !== undefined && !this.sameIntent(disk, intent)) || (warm !== undefined && !this.sameIntent(warm, intent)) ||
        receipt.operationId !== intent.operationId || receipt.sequence !== intent.sequence) {
        throw new SourceSwitchIntentRecoveryError('blocked', '换源回执与原标识不一致，已保留并停止覆盖');
      }
      const confirmed: SourceSwitchIntent = { ...intent, phase: 'confirmed', receipt };
      SourceSwitchIntentStore.warmIntent = confirmed;
      await this.write(confirmed);
    });
  }

  /** Exact Core proof plus actual clear fsync ACK precedes any next seq. */
  async clear(intent: SourceSwitchIntent): Promise<void> {
    await this.serial(async (): Promise<void> => {
      this.assertCurrent();
      const disk = await this.read(), warm = SourceSwitchIntentStore.warmIntent;
      this.assertCurrent();
      const proof = warm?.phase === 'confirmed' ? warm.receipt : disk?.receipt;
      if ((disk !== undefined && !this.sameIntent(disk, intent)) || (warm !== undefined && !this.sameIntent(warm, intent)) ||
        (warm?.phase ?? disk?.phase) !== 'confirmed' || proof === undefined || proof.phase === 'pending') {
        throw new SourceSwitchIntentRecoveryError('blocked', '换源结果未确认或标识已变，不能清除原记录');
      }
      try { await this.replace(''); }
      catch (_) { throw new SourceSwitchIntentRecoveryError('pending', '换源已确认，原标识清理尚未确认；请重试核对，不能开始下一次换源'); }
      this.assertCurrent();
      if (SourceSwitchIntentStore.warmIntent !== warm) throw new SourceSwitchIntentRecoveryError('pending', '旧换源服务不能清除新记录');
      SourceSwitchIntentStore.warmIntent = undefined;
    });
  }

  private async serial<T>(work: () => Promise<T>): Promise<T> {
    const prior = SourceSwitchIntentStore.tail;
    let release: (() => void) | undefined;
    SourceSwitchIntentStore.tail = new Promise<void>((resolve): void => { release = resolve; });
    await prior;
    try { return await work(); } finally { release?.(); }
  }
  private async read(): Promise<SourceSwitchIntent | undefined> {
    let raw: string;
    try { raw = await fileIo.readText(this.path()); }
    catch (error) {
      if ((error as BusinessError).code === 13900002) return undefined;
      throw new SourceSwitchIntentRecoveryError('pending', '换源待核对记录暂时不可读，已停止新操作；请重试核对');
    }
    if (raw === '') return undefined;
    let value: SourceSwitchIntent;
    try { value = JSON.parse(raw) as SourceSwitchIntent; } catch (_) { throw new SourceSwitchIntentRecoveryError('blocked', '换源待核对记录格式无效，已保留'); }
    if (value?.version !== 1 || typeof value.operationId !== 'string' || value.operationId.length === 0 ||
      value.operationId.length > 128 || !Number.isSafeInteger(value.sequence) || value.sequence <= 0 ||
      (value.phase !== 'pending' && value.phase !== 'confirmed') || value.params?.operationId !== value.operationId ||
      value.params?.sequence !== value.sequence || typeof value.params.from?.sourceId !== 'string' ||
      typeof value.params.from?.bookId !== 'string' || typeof value.params.target?.sourceId !== 'string' ||
      typeof value.params.target?.bookId !== 'string' || !Array.isArray(value.params.newToc) || value.params.newToc.length === 0 ||
      (value.phase === 'confirmed' && (value.receipt?.operationId !== value.operationId || value.receipt?.sequence !== value.sequence ||
        (value.receipt.phase !== 'pending' && value.receipt.phase !== 'finalized' && value.receipt.phase !== 'rolledBack')))) {
      throw new SourceSwitchIntentRecoveryError('blocked', '换源待核对记录身份或内容无效，已保留');
    }
    return value;
  }
  private async write(intent: SourceSwitchIntent): Promise<void> {
    this.assertCurrent(); const raw = JSON.stringify(intent);
    try { await this.replace(raw); }
    catch (_) { throw new SourceSwitchIntentRecoveryError('pending', '换源标识保存尚未确认，原操作已保留，请重试核对'); }
  }

  /** AtomicFile is the installed SDK/platform replacement primitive, already
   * used by BundledSourceLedger. Reader adds only durability acknowledgement:
   * sync the published base file and parent directory before dispatching Core.
   * finishWrite can have published before throwing: never call failWrite or
   * compensate once finish was invoked, and preserve the exact warm intent. */
  private async replace(raw: string): Promise<void> {
    const path = this.path(), writer = new fileIo.AtomicFile(path);
    let finishing = false;
    try {
      const stream = writer.startWrite();
      await new Promise<void>((resolve: () => void, reject: (reason?: Error) => void): void => {
        stream.on('error', (): void => reject(new Error('source switch intent stream write failed')));
        stream.end(raw, 'utf-8', resolve);
      });
      finishing = true;
      writer.finishWrite();
      const base = await fileIo.open(path, fileIo.OpenMode.READ_WRITE);
      try { await fileIo.fsync(base.fd); } finally { await fileIo.close(base); }
      const parent = await fileIo.open(this.runtime.getUIAbilityContext().filesDir, fileIo.OpenMode.READ_ONLY);
      try { await fileIo.fsync(parent.fd); } finally { await fileIo.close(parent); }
    } catch (error) {
      if (!finishing) { try { writer.failWrite(); } catch (_) {} }
      throw error as Error;
    }
  }
  private sameIntent(left: SourceSwitchIntent, right: SourceSwitchIntent): boolean {
    return left.operationId === right.operationId && left.sequence === right.sequence &&
      JSON.stringify(left.params) === JSON.stringify(right.params);
  }
  private assertCurrent(): void {
    if (!ReaderRuntimeOwner.isCurrent(this.runtime)) throw new SourceSwitchIntentRecoveryError('pending', '换源服务已退役，请由当前服务核对保留记录');
  }
  private path(): string { return `${this.runtime.getUIAbilityContext().filesDir}/${INTENT_FILE}`; }
}
