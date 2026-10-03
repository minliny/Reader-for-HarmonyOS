import type { JsonObject } from '@reader/core-harmony';
import { isReaderCoreTransactionPendingError } from '@reader/core-harmony';
import type { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import type { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';

export interface SettingsCacheClearReport {
  scope: 'cache';
  cacheEntriesRemoved: number;
  chapterEntriesRemoved: number;
  queueEntriesRemoved: number;
  removedContentBytes: number;
}

/** Canonical text-cache command; no source/parser/cache algorithm is reimplemented. */
export class SettingsCacheGateway {
  private readonly owner: ReaderRuntimeOwner;
  constructor(owner: ReaderRuntimeOwner) { this.owner = owner; }

  async clear(evidence: ReaderWriteEvidence, current: () => boolean): Promise<SettingsCacheClearReport> {
    if (!current()) throw new Error('CACHE_CLEANUP_PRESENTATION_RETIRED');
    // This is the real command admission boundary, not an inference from catch.
    // Request cancellation after admission does not prove that Core rolled back.
    evidence.dispatched();
    let data: JsonObject;
    try {
      data = (await this.owner.request('cache.clear', { scope: 'cache' }, {
        shouldCancel: (): boolean => !current(),
      })).data;
    } catch (error) {
      // The SDK's exact TRANSACTION_PENDING protocol says no execution started.
      // Generic cancellations, timeouts and malformed ACKs stay unknown.
      if (isReaderCoreTransactionPendingError(error)) evidence.rejectedBeforeExecution();
      throw error;
    }
    if (data['scope'] !== 'cache') throw new Error('cache.clear returned an unexpected scope');
    const report: SettingsCacheClearReport = {
      scope: 'cache',
      cacheEntriesRemoved: this.count(data, 'cacheEntriesRemoved'),
      chapterEntriesRemoved: this.count(data, 'chapterEntriesRemoved'),
      queueEntriesRemoved: this.count(data, 'queueEntriesRemoved'),
      removedContentBytes: this.count(data, 'removedContentBytes'),
    };
    evidence.confirmed();
    return report;
  }

  private count(data: JsonObject, key: string): number {
    const value = data[key];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
      throw new Error(`cache.clear returned invalid ${key}`);
    return value;
  }
}
