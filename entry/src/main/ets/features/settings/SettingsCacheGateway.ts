import { CacheClearOperationIntentStore, type ReadingOperationIntent, type ReadingRecoveredOperation } from '../reading/ReadingOperationIntents';
import type { JsonObject } from '@reader/core-harmony';
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
  private readonly intents: CacheClearOperationIntentStore;
  constructor(owner: ReaderRuntimeOwner) { this.owner = owner; this.intents = new CacheClearOperationIntentStore(owner); }

  async clear(evidence: ReaderWriteEvidence, current: () => boolean): Promise<SettingsCacheClearReport> {
    if (!current()) throw new Error('CACHE_CLEANUP_PRESENTATION_RETIRED');
    return this.intents.execute('cache.clear', { scope: 'cache' }, { sourceId: 'cache', bookId: 'global-text' },
      (data): SettingsCacheClearReport => this.decode(data), evidence, current);
  }
  async pending(): Promise<ReadingOperationIntent | undefined> { return this.intents.pending(); }
  async reconcile(current: () => boolean, evidence?: ReaderWriteEvidence,
    continueOriginal: boolean = false): Promise<ReadingRecoveredOperation | undefined> {
    const context = { sourceId: 'cache', bookId: 'global-text' };
    const qualify = (data: JsonObject): SettingsCacheClearReport => this.decode(data);
    return continueOriginal ? this.intents.continueOriginal(context, qualify, evidence, current) : this.intents.reconcile(context, qualify, current);
  }
  decode(data: JsonObject): SettingsCacheClearReport {
    if (data['scope'] !== 'cache') throw new Error('cache.clear returned an unexpected scope');
    return { scope: 'cache', cacheEntriesRemoved: this.count(data, 'cacheEntriesRemoved'),
      chapterEntriesRemoved: this.count(data, 'chapterEntriesRemoved'), queueEntriesRemoved: this.count(data, 'queueEntriesRemoved'),
      removedContentBytes: this.count(data, 'removedContentBytes') };
  }

  private count(data: JsonObject, key: string): number {
    const value = data[key];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
      throw new Error(`cache.clear returned invalid ${key}`);
    return value;
  }
}
