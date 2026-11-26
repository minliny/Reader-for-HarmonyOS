import { readerHostFilesDirectory, readerHostPreferencesName } from '../../../app/diagnostics/ReaderPublicFixtureScope';
import { replaceReaderAtomicSnapshot } from '../../../app/ReaderAtomicSnapshotFile';
import common from '@ohos.app.ability.common';
import preferences from '@ohos.data.preferences';
import fileIo from '@ohos.file.fs';
import type { BusinessError } from '@ohos.base';
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
      let encoded: string;
      try {
        encoded = await fileIo.readText(this.settingsCleanupPath());
        if (encoded === 'null') return undefined;
        if (encoded === '') throw new Error('TEXT_CACHE_CLEANUP_JOURNAL_INVALID');
      }
      catch (error) {
        if ((error as BusinessError).code !== 13900002) throw error;
        encoded = await (await this.ensureStore()).get('settings_text_cleanup_v2', '') as string;
      }
      if (encoded === '') return undefined;
      const journal = JSON.parse(encoded) as SettingsTextCleanupJournal;
      if (journal === null || journal.version !== 2 || journal.scope !== 'text' ||
        (journal.phase !== 'pending' && journal.phase !== 'confirmed' &&
        journal.phase !== 'core_confirmed' && journal.phase !== 'host_completed'))
        throw new Error('TEXT_CACHE_CLEANUP_JOURNAL_INVALID');
      if (journal.phase === 'core_confirmed' || journal.phase === 'host_completed') {
        const files = journal.beforeTextFiles;
        if (typeof journal.removedContentBytes !== 'number' || !Number.isSafeInteger(journal.removedContentBytes) ||
          journal.removedContentBytes < 0 || !Array.isArray(files) || files.some(file => file === null ||
            typeof file.path !== 'string' || typeof file.physicalKey !== 'string' || !Number.isSafeInteger(file.size) ||
            file.size < 0 || typeof file.mtime !== 'string' || !this.cleanupChapter(file.textOwner)) ||
          (journal.phase === 'core_confirmed' && (!Array.isArray(journal.pendingHostChapters) ||
          journal.pendingHostChapters.some(chapter => !this.cleanupChapter(chapter)))))
          throw new Error('TEXT_CACHE_CLEANUP_JOURNAL_INVALID');
      }
      return journal;
    });
  }
  saveSettingsTextCleanup(journal: SettingsTextCleanupJournal | undefined): Promise<void> {
    const encoded = JSON.stringify(journal ?? null);
    // A staged file ledger can exceed the Preferences value limit. The
    // atomic file takes precedence, including its explicit empty state.
    return this.serialized((): Promise<void> => replaceReaderAtomicSnapshot(this.settingsCleanupPath(),
      readerHostFilesDirectory(this.context.filesDir), encoded));
  }

  private settingsCleanupPath(): string {
    return `${readerHostFilesDirectory(this.context.filesDir)}/reader-settings-text-cleanup-v2.json`;
  }

  private cleanupChapter(chapter: { sourceId: string; bookId: string; chapterIndex: number; } | undefined): boolean {
    return chapter !== undefined && chapter !== null && typeof chapter.sourceId === 'string' && chapter.sourceId.trim().length > 0 &&
      typeof chapter.bookId === 'string' && chapter.bookId.trim().length > 0 &&
      Number.isSafeInteger(chapter.chapterIndex) && chapter.chapterIndex >= 0;
  }

  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = SharedDownloadIntentPreferences.tail.then(operation);
    SharedDownloadIntentPreferences.tail = result.then((): void => {}, (): void => {});
    return result;
  }

  private async ensureStore(): Promise<preferences.Preferences> {
    if (this.store === undefined) this.store = await preferences.getPreferences(this.context, readerHostPreferencesName(this.context.filesDir, 'reader_download_intents_v1'));
    return this.store;
  }
}
