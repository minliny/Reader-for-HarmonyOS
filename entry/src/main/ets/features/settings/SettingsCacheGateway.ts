import { CacheClearOperationIntentStore, type ReadingOperationIntent, type ReadingRecoveredOperation } from '../reading/ReadingOperationIntents';
import type { JsonObject } from '@reader/core-harmony';
import type { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import type { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import type { SettingsTextCleanupJournal } from '../downloads/SharedDownloadStorageGateway';

export interface SettingsCacheClearReport {
  scope: 'cache' | 'text';
  cacheEntriesRemoved?: number;
  chapterEntriesRemoved?: number;
  queueEntriesRemoved?: number;
  removedContentBytes: number;
  deletedBytes?: number;
  deletedFiles?: number;
  cleanupError?: string;
}
interface SettingsCacheRecoveredCleanup { data: JsonObject; }
export class SettingsCacheCleanupFailure extends Error {
  readonly unconfirmed: boolean;
  readonly blocked: boolean = true;
  readonly confirmed: boolean;
  readonly intent?: ReadingOperationIntent;
  constructor(message: string, unconfirmed: boolean, confirmed: boolean = false, intent?: ReadingOperationIntent) {
    super(message); this.unconfirmed = unconfirmed; this.confirmed = confirmed; this.intent = intent;
  }
}

/** Safe text-only cleanup shares the production storage owner. The old
 * cache.clear journal is read/settled for compatibility, never replayed. */
export class SettingsCacheGateway {
  private readonly owner: ReaderRuntimeOwner;
  private readonly intents: CacheClearOperationIntentStore;
  constructor(owner: ReaderRuntimeOwner) { this.owner = owner; this.intents = new CacheClearOperationIntentStore(owner); }

  async clear(evidence: ReaderWriteEvidence, current: () => boolean): Promise<SettingsCacheClearReport> {
    if (!current()) throw new Error('CACHE_CLEANUP_PRESENTATION_RETIRED');
    const legacy = await this.intents.pending();
    if (legacy !== undefined) throw new SettingsCacheCleanupFailure('历史清理结果尚未确认，请核对；不会继续旧的全局清理', true, false, legacy);
    const previous = await this.owner.readSettingsTextCleanup();
    if (previous?.phase === 'pending')
      throw new SettingsCacheCleanupFailure('清理结果尚未确认，原状态已保留；不会自动再次清理', true);
    try {
      const actual = await this.owner.clearTextRebuildableCache(evidence, current);
      return this.decode({ scope: 'text', removedContentBytes: actual.removedContentBytes,
        deletedBytes: actual.deletedBytes, deletedFiles: actual.deletedFiles,
        ...(actual.cleanupError === undefined ? {} : { cleanupError: '部分清理未完成，请稍后重试' }) });
    } catch (error) {
      if (evidence.confirmation() === 'unknown')
        throw new SettingsCacheCleanupFailure('清理结果尚未确认，原状态已保留；不会自动再次清理', true);
      if (evidence.confirmation() === 'confirmed')
        throw new SettingsCacheCleanupFailure('正文清理已确认，结果保存尚未完成，请核对', false, true);
      throw new Error('清理未执行，请稍后重试');
    }
  }
  async pending(): Promise<ReadingOperationIntent | SettingsTextCleanupJournal | undefined> {
    return await this.intents.pending() ?? await this.owner.readSettingsTextCleanup();
  }
  async reconcile(current: () => boolean, _evidence?: ReaderWriteEvidence,
    _continueOriginal: boolean = false): Promise<ReadingRecoveredOperation | SettingsCacheRecoveredCleanup | undefined> {
    if (!current()) return undefined;
    const legacy = await this.intents.pending();
    if (legacy !== undefined) {
      // Existing qualified committed receipts may settle metadata. A missing
      // old receipt never grants permission to re-execute its unsafe scope.
      return this.intents.reconcile({ sourceId: 'cache', bookId: 'global-text' },
        (data: JsonObject): SettingsCacheClearReport => this.decode(data), current);
    }
    const journal = await this.owner.readSettingsTextCleanup();
    if (journal === undefined) return undefined;
    if (journal.version !== 2 || journal.scope !== 'text' || journal.phase !== 'confirmed' || journal.result === undefined)
      throw new SettingsCacheCleanupFailure('清理结果尚未确认，原状态已保留；当前没有可核对的完整回执', true);
    const report = this.decode({ scope: 'text', removedContentBytes: journal.result.removedContentBytes,
      deletedBytes: journal.result.deletedBytes, deletedFiles: journal.result.deletedFiles,
      ...(journal.result.cleanupError === undefined ? {} : { cleanupError: '部分清理未完成，请稍后重试' }) });
    return { data: report as unknown as JsonObject };
  }
  decode(data: JsonObject): SettingsCacheClearReport {
    if (data['scope'] === 'text') {
      if (data['cleanupError'] !== undefined && typeof data['cleanupError'] !== 'string')
        throw new Error('storage cleanup returned an invalid partial result');
      return { scope: 'text', removedContentBytes: this.count(data, 'removedContentBytes'),
        deletedBytes: this.count(data, 'deletedBytes'), deletedFiles: this.count(data, 'deletedFiles'),
        cleanupError: data['cleanupError'] as string | undefined };
    }
    if (data['scope'] !== 'cache') throw new Error('cache.clear returned an unexpected scope');
    return { scope: 'cache', cacheEntriesRemoved: this.count(data, 'cacheEntriesRemoved'),
      chapterEntriesRemoved: this.count(data, 'chapterEntriesRemoved'), queueEntriesRemoved: this.count(data, 'queueEntriesRemoved'),
      removedContentBytes: this.count(data, 'removedContentBytes') };
  }
  private count(data: JsonObject, key: string): number {
    const value = data[key];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
      throw new Error(`storage cleanup returned invalid ${key}`);
    return value;
  }
}
