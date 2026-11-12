import fileIo from '@ohos.file.fs';
import type { BusinessError } from '@ohos.base';
import util from '@ohos.util';
import { ReaderCoreRequestError, isReaderCoreTransactionPendingError } from '@reader/core-harmony';
import { BookRequestNotDispatchedError } from '../../../app/BookRequestScheduler';
import { replaceReaderAtomicSnapshot } from '../../../app/ReaderAtomicSnapshotFile';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import type { RemoteReadingIdentity } from '../../reading/application/RemoteReadingContract';
import { MANGA_SWITCH_RECEIPT_CAPABILITY, mangaSwitchCommitParams, MangaSourceSwitchGateway,
  type MangaSwitchCommitParams, type MangaSwitchOperationId, type MangaSwitchProposal } from './MangaSourceSwitchGateway';

interface MangaSwitchIntent {
  version: 1;
  operationId: string;
  sequence?: number;
  params: MangaSwitchCommitParams;
}

interface MangaSwitchReconciliationTarget {
  from: RemoteReadingIdentity;
  target: RemoteReadingIdentity;
}

interface MangaSwitchIntentSnapshot {
  records: MangaSwitchIntent[];
  persistedOperationIds: Set<string>;
}

export interface MangaSwitchRecoveryItem {
  operationId: string;
  fact: 'unknown' | 'unsupported' | 'confirmed' | 'cleanupPending';
}

export class MangaSwitchRecoveryError extends Error {
  readonly confirmed: boolean;
  constructor(message: string, confirmed: boolean = false) { super(message); this.confirmed = confirmed; }
}

/** Durable association for the existing manga shelf transaction. Legacy
 * writes can settle only from the original live response. Modern writes can
 * also settle from the exact Core receipt, without replay or shelf inference. */
export class MangaSourceSwitchIntents {
  private static tail: Promise<void> = Promise.resolve();
  private static readonly warm: Map<string, MangaSwitchIntent[]> = new Map();
  private static readonly confirmedCleanup: Map<string, Set<string>> = new Map();
  private readonly runtime: ReaderRuntimeOwner;
  private readonly gateway: MangaSourceSwitchGateway;
  constructor(runtime: ReaderRuntimeOwner) { this.runtime = runtime; this.gateway = new MangaSourceSwitchGateway(runtime); }

  assertAvailable(from: RemoteReadingIdentity, target: RemoteReadingIdentity): Promise<void> {
    return this.serial(async (): Promise<void> => this.assertAvailableFor((await this.load()).records, from, target));
  }

  commit(proposal: MangaSwitchProposal, admitted: () => boolean): Promise<void> {
    return this.serial(async (): Promise<void> => {
      const current = (): boolean => this.current() && admitted();
      if (!current()) throw new BookRequestNotDispatchedError('MANGA_SWITCH_CANCELLED');
      const params = JSON.parse(JSON.stringify(mangaSwitchCommitParams(proposal, true))) as MangaSwitchCommitParams;
      const from: RemoteReadingIdentity = { sourceId: params.fromSourceId, bookId: params.fromBookId };
      const records = (await this.load()).records;
      this.assertAvailableFor(records, from, params.firstImage.chapter);
      const modern = this.runtime.supportsCoreCapability(MANGA_SWITCH_RECEIPT_CAPABILITY);
      const sequence = modern ? (await this.gateway.readHead(current)) + 1 : undefined;
      if (sequence !== undefined && (!Number.isSafeInteger(sequence) || sequence < 1))
        throw new MangaSwitchRecoveryError('漫画换源流水号不可用，原记录已保留');
      if (!current()) throw new BookRequestNotDispatchedError('MANGA_SWITCH_CANCELLED');
      const nonce = util.generateRandomUUID();
      const intent: MangaSwitchIntent = { version: 1, operationId: sequence === undefined ? nonce : `${nonce}/${sequence}`, sequence, params };
      const pending = records.concat(intent);
      MangaSourceSwitchIntents.warm.set(this.path(), pending);
      try { await this.save(pending); }
      catch (_) { throw new MangaSwitchRecoveryError('漫画换源记录保存未确认，本次请求未发送'); }
      const operation = this.operation(intent);
      let entered = false;
      const ack = await this.gateway.commitSaved(params, operation, current, (): void => { entered = true; })
        .catch(async (error: Error): Promise<never> => {
          if (!entered || this.knownRejection(error)) {
            await this.save(records);
            if (error instanceof BookRequestNotDispatchedError) throw error;
            throw new BookRequestNotDispatchedError('MANGA_SWITCH_REJECTED');
          }
          throw new MangaSwitchRecoveryError('漫画换源结果尚未确认，原操作已保留');
        });
      try {
        if (operation !== undefined) {
          const receipt = await this.gateway.readReceipt(params, operation, (): boolean => this.current());
          if (receipt === undefined || receipt.binding?.payloadFingerprint !== ack.binding?.payloadFingerprint)
            throw new MangaSwitchRecoveryError('漫画换源精确回执暂不可读，原操作已保留');
        }
      } catch (_) {
        throw new MangaSwitchRecoveryError('漫画换源精确回执暂不可读，原操作已保留');
      }
      await this.saveAfterConfirmation(intent, records);
    });
  }

  /** The active switch may only reconcile its original and target books. */
  reconcile(identities: MangaSwitchReconciliationTarget): Promise<boolean> {
    return this.serial(async (): Promise<boolean> => {
      const snapshot = await this.load();
      const candidates = snapshot.records.filter(record => record.params.fromSourceId === identities.from.sourceId &&
        record.params.fromBookId === identities.from.bookId &&
        record.params.firstImage.chapter.sourceId === identities.target.sourceId &&
        record.params.firstImage.chapter.bookId === identities.target.bookId);
      if (candidates.length > 1)
        throw new MangaSwitchRecoveryError('存在多条匹配的漫画换源记录，已保留原记录');
      if (candidates.length === 0) return false;
      const record = candidates[0];
      if (this.hasConfirmedCleanup(record.operationId)) {
        await this.cleanupConfirmedReceipt(record, snapshot);
      } else {
        const operation = this.recoveryOperation(record);
        if (operation === undefined)
          throw new MangaSwitchRecoveryError('当前 Core 无法核对此次漫画换源，原记录已保留');
        await this.settleReceipt(record, operation, snapshot);
      }
      return true;
    });
  }

  inspectMangaRecovery(): Promise<MangaSwitchRecoveryItem[]> {
    return this.serial(async (): Promise<MangaSwitchRecoveryItem[]> => {
      const snapshot = await this.load();
      const items: MangaSwitchRecoveryItem[] = [];
      for (const record of snapshot.records) {
        if (this.canRecover(record.operationId, snapshot)) items.push(await this.recoveryItem(record, snapshot));
      }
      this.assertCurrent();
      return items;
    });
  }

  retryMangaRecovery(operationId: string): Promise<MangaSwitchRecoveryItem | undefined> {
    return this.serial(async (): Promise<MangaSwitchRecoveryItem | undefined> => {
      const snapshot = await this.load();
      this.assertCurrent();
      if (!this.canRecover(operationId, snapshot)) return undefined;
      const record = snapshot.records.find(item => item.operationId === operationId);
      return record === undefined ? undefined : this.recoveryItem(record, snapshot);
    });
  }

  private canRecover(operationId: string, snapshot: MangaSwitchIntentSnapshot): boolean {
    // A rename may be visible before the directory sync succeeds. Keep only
    // receipt-proven operations eligible when that cleanup is still in doubt.
    return snapshot.persistedOperationIds.has(operationId) || this.hasConfirmedCleanup(operationId);
  }

  private hasConfirmedCleanup(operationId: string): boolean {
    return MangaSourceSwitchIntents.confirmedCleanup.get(this.path())?.has(operationId) === true;
  }

  private async recoveryItem(record: MangaSwitchIntent, snapshot: MangaSwitchIntentSnapshot): Promise<MangaSwitchRecoveryItem> {
    this.assertCurrent();
    const operationId = record.operationId;
    try {
      if (this.hasConfirmedCleanup(operationId)) {
        await this.cleanupConfirmedReceipt(record, snapshot);
      } else {
        if (record.sequence === undefined) return { operationId, fact: 'unsupported' };
        await this.runtime.start();
        this.assertCurrent();
        const operation = this.recoveryOperation(record);
        if (operation === undefined) return { operationId, fact: 'unsupported' };
        await this.settleReceipt(record, operation, snapshot);
      }
    } catch (error) {
      this.assertCurrent();
      const confirmed = this.hasConfirmedCleanup(operationId);
      return { operationId, fact: confirmed || (error instanceof MangaSwitchRecoveryError && error.confirmed) ? 'cleanupPending' : 'unknown' };
    }
    this.assertCurrent();
    return { operationId, fact: 'confirmed' };
  }

  private async settleReceipt(record: MangaSwitchIntent, operation: MangaSwitchOperationId,
    snapshot: MangaSwitchIntentSnapshot): Promise<void> {
    const receipt = await this.gateway.readReceipt(record.params, operation, (): boolean => this.current());
    if (receipt === undefined) throw new MangaSwitchRecoveryError('漫画换源结果尚未确认，原操作已保留');
    await this.cleanupConfirmedReceipt(record, snapshot);
  }

  private async cleanupConfirmedReceipt(record: MangaSwitchIntent, snapshot: MangaSwitchIntentSnapshot): Promise<void> {
    const remaining = snapshot.records.filter(item => item.operationId !== record.operationId);
    // Preserve unrelated memory-only admission guards without publishing them.
    const durable = remaining.filter(item => snapshot.persistedOperationIds.has(item.operationId));
    await this.saveAfterConfirmation(record, durable, remaining);
    snapshot.records = remaining;
  }

  private async saveAfterConfirmation(record: MangaSwitchIntent, durable: MangaSwitchIntent[],
    retained: MangaSwitchIntent[] = durable): Promise<void> {
    const path = this.path();
    try { await this.save(durable, retained); }
    catch (_) {
      const pending = MangaSourceSwitchIntents.confirmedCleanup.get(path) ?? new Set<string>();
      pending.add(record.operationId);
      MangaSourceSwitchIntents.confirmedCleanup.set(path, pending);
      // A failed directory sync may leave the replacement visible already.
      // Retain the proved DTO even when the first read came only from disk.
      const warm = MangaSourceSwitchIntents.warm.get(path) ?? [];
      if (!warm.some(item => item.operationId === record.operationId)) MangaSourceSwitchIntents.warm.set(path, warm.concat(record));
      throw new MangaSwitchRecoveryError('漫画换源已保存，核对记录尚未清理', true);
    }
    const pending = MangaSourceSwitchIntents.confirmedCleanup.get(path);
    pending?.delete(record.operationId);
    if (pending?.size === 0) MangaSourceSwitchIntents.confirmedCleanup.delete(path);
  }

  private assertAvailableFor(records: MangaSwitchIntent[], from: RemoteReadingIdentity, target: RemoteReadingIdentity): void {
    if (records.some(record => this.touches(record, from) || this.touches(record, target) ||
      (record.sequence !== undefined && this.runtime.supportsCoreCapability(MANGA_SWITCH_RECEIPT_CAPABILITY))))
      throw new MangaSwitchRecoveryError('上一次漫画换源仍需核对，原操作已保留');
  }

  private touches(record: MangaSwitchIntent, identity: RemoteReadingIdentity): boolean {
    const params = record.params, target = params.firstImage.chapter;
    return (params.fromSourceId === identity.sourceId && params.fromBookId === identity.bookId) ||
      (target.sourceId === identity.sourceId && target.bookId === identity.bookId);
  }

  private operation(record: MangaSwitchIntent): MangaSwitchOperationId | undefined {
    return record.sequence === undefined ? undefined : { operationId: record.operationId, sequence: record.sequence };
  }

  private recoveryOperation(record: MangaSwitchIntent): MangaSwitchOperationId | undefined {
    const operation = this.operation(record);
    return operation !== undefined && this.runtime.supportsCoreCapability(MANGA_SWITCH_RECEIPT_CAPABILITY) ? operation : undefined;
  }

  private knownRejection(error: unknown): boolean {
    return error instanceof BookRequestNotDispatchedError || isReaderCoreTransactionPendingError(error) ||
      (error instanceof ReaderCoreRequestError && (error.event.error.code === 'INVALID_PARAMS' ||
        (error.event.error.details?.['nonExecution'] === true && error.event.error.details?.['domain'] === 'mangaSourceSwitch')));
  }

  private async load(): Promise<MangaSwitchIntentSnapshot> {
    this.assertCurrent();
    const path = this.path();
    let raw = '';
    try { raw = await fileIo.readText(path); }
    catch (error) {
      if ((error as BusinessError).code !== 13900002) throw new MangaSwitchRecoveryError('漫画换源记录暂不可读，已停止新操作');
    }
    this.assertCurrent();
    let disk: MangaSwitchIntent[];
    try { disk = raw === '' ? [] : JSON.parse(raw) as MangaSwitchIntent[]; }
    catch (_) { throw new MangaSwitchRecoveryError('漫画换源记录格式无效，已保留'); }
    if (!Array.isArray(disk) || disk.some(record => !this.valid(record)))
      throw new MangaSwitchRecoveryError('漫画换源记录身份无效，已保留');
    const persistedOperationIds = new Set(disk.map(record => record.operationId));
    if (persistedOperationIds.size !== disk.length ||
      disk.filter(record => record.sequence !== undefined).length > 1)
      throw new MangaSwitchRecoveryError('漫画换源记录身份无效，已保留');
    const records = disk.slice();
    for (const warm of MangaSourceSwitchIntents.warm.get(path) ?? []) {
      const stored = records.find(record => record.operationId === warm.operationId);
      if (stored === undefined) records.push(warm);
      else if (JSON.stringify(stored) !== JSON.stringify(warm))
        throw new MangaSwitchRecoveryError('漫画换源待核对标识冲突，已保留');
    }
    return { records, persistedOperationIds };
  }

  private valid(record: MangaSwitchIntent): boolean {
    const p = record?.params, image = p?.firstImage, target = image?.chapter;
    return record?.version === 1 && typeof record.operationId === 'string' && record.operationId.length > 0 &&
      record.operationId.length <= 128 && (record.sequence === undefined || (Number.isSafeInteger(record.sequence) &&
        record.sequence > 0 && record.operationId.endsWith(`/${record.sequence}`))) &&
      p?.acceptApproximate === true && p.targetPageOrdinal === 0 &&
      [p.fromSourceId, p.fromBookId, target?.sourceId, target?.bookId, target?.chapterId, image?.manifestVersion,
        image?.sourceRuleVersion, image?.decodeRevision, image?.pageId, image?.resourceRef, image?.imageRevision]
        .every(value => typeof value === 'string' && value.length > 0) &&
      [p.expectedFrom?.epoch, p.expectedFrom?.revision, p.expectedTarget?.epoch, p.expectedTarget?.revision,
        image?.chapterIndex, image?.width, image?.height].every(value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
  }

  private async save(records: MangaSwitchIntent[], retained: MangaSwitchIntent[] = records): Promise<void> {
    this.assertCurrent();
    const path = this.path();
    await replaceReaderAtomicSnapshot(path, this.runtime.getUIAbilityContext().filesDir, JSON.stringify(records));
    this.assertCurrent();
    MangaSourceSwitchIntents.warm.set(path, retained);
  }

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = MangaSourceSwitchIntents.tail.then(work);
    MangaSourceSwitchIntents.tail = result.then((): void => {}, (): void => {});
    return result;
  }

  private current(): boolean { return ReaderRuntimeOwner.isCurrent(this.runtime); }
  private assertCurrent(): void {
    if (!this.current()) throw new MangaSwitchRecoveryError('漫画换源服务已退役，原记录已保留');
  }
  private path(): string { return `${this.runtime.getUIAbilityContext().filesDir}/reader-manga-source-switch-intent-v1.json`; }
}
