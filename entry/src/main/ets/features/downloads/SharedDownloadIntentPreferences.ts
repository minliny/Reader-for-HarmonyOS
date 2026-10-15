import common from '@ohos.app.ability.common';
import preferences from '@ohos.data.preferences';
import type { SettingsTextCleanupJournal } from './SharedDownloadStorageGateway';
import type { SharedDownloadIntent, SharedDownloadIntentPersistence } from './SharedDownloadCoordinator';

/** Platform persistence for accepted complete download ranges. Core remains
 * the durable chapter queue; this file stores only Reader's user intent. */
export class SharedDownloadIntentPreferences implements SharedDownloadIntentPersistence {
  private static tail: Promise<void> = Promise.resolve();
  private readonly context: common.UIAbilityContext;
  private store?: preferences.Preferences;

  constructor(context: common.UIAbilityContext) { this.context = context; }

  load(): Promise<SharedDownloadIntent[]> {
    return this.serialized(async (): Promise<SharedDownloadIntent[]> => {
      const store = await this.ensureStore();
      const encoded = await store.get('intents_v1', '') as string;
      if (encoded === '') return [];
      const decoded = JSON.parse(encoded) as SharedDownloadIntent[];
      if (!Array.isArray(decoded)) throw new Error('下载记录无法读取，原记录已保留');
      return decoded;
    });
  }

  save(intents: SharedDownloadIntent[]): Promise<void> {
    // Freeze before the platform await; an accepted ACK requires flush.
    const encoded = JSON.stringify(intents);
    return this.serialized(async (): Promise<void> => {
      const store = await this.ensureStore();
      await store.put('intents_v1', encoded);
      await store.flush();
    });
  }

  /** Absence is distinct from a completed empty migration. Old completed
   * queues did not distinguish auto preparation from explicit downloads. */
  loadLegacyProtection(): Promise<{ sourceId: string; bookId: string; chapterIndex: number; }[] | undefined> {
    return this.serialized(async () => {
      const encoded = await (await this.ensureStore()).get('legacy_unknown_intent_v1', '') as string;
      if (encoded === '') return undefined;
      const decoded = JSON.parse(encoded);
      if (!Array.isArray(decoded)) throw new Error('DOWNLOAD_LEGACY_PROTECTION_INVALID');
      return decoded;
    });
  }

  saveLegacyProtection(chapters: { sourceId: string; bookId: string; chapterIndex: number; }[]): Promise<void> {
    const encoded = JSON.stringify(chapters);
    return this.serialized(async (): Promise<void> => {
      const store = await this.ensureStore();
      await store.put('legacy_unknown_intent_v1', encoded);
      await store.flush();
    });
  }

  loadSettingsTextCleanup(): Promise<SettingsTextCleanupJournal | undefined> {
    return this.serialized(async () => {
      const encoded = await (await this.ensureStore()).get('settings_text_cleanup_v2', '') as string;
      if (encoded === '') return undefined;
      const journal = JSON.parse(encoded) as SettingsTextCleanupJournal;
      if (journal.version !== 2 || journal.scope !== 'text' ||
        (journal.phase !== 'pending' && journal.phase !== 'confirmed')) throw new Error('TEXT_CACHE_CLEANUP_JOURNAL_INVALID');
      return journal;
    });
  }
  saveSettingsTextCleanup(journal: SettingsTextCleanupJournal | undefined): Promise<void> {
    const encoded = journal === undefined ? '' : JSON.stringify(journal);
    return this.serialized(async (): Promise<void> => {
      const store = await this.ensureStore();
      await store.put('settings_text_cleanup_v2', encoded);
      await store.flush();
    });
  }

  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = SharedDownloadIntentPreferences.tail.then(operation);
    SharedDownloadIntentPreferences.tail = result.then((): void => {}, (): void => {});
    return result;
  }

  private async ensureStore(): Promise<preferences.Preferences> {
    if (this.store === undefined) this.store = await preferences.getPreferences(this.context, 'reader_download_intents_v1');
    return this.store;
  }
}
