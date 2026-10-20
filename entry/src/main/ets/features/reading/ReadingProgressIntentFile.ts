import fileIo from '@ohos.file.fs';
import type { BusinessError } from '@ohos.base';
import { replaceReaderAtomicSnapshot } from '../../app/ReaderAtomicSnapshotFile';
import type { ReadingProgressJournalStorage } from './ReadingProgressJournal';

/** Production IO only; the journal/CAS owner is independently testable. */
export class ReadingProgressIntentFile implements ReadingProgressJournalStorage {
  private static lane: Promise<void> = Promise.resolve();
  private readonly parent: string;
  private readonly path: string;
  private readonly current: () => boolean;
  constructor(filesDir: string, current: () => boolean) {
    this.parent = filesDir; this.path = `${filesDir}/reader-progress-pending-v1.json`;
    this.current = current;
  }
  async read(): Promise<string> {
    return this.serial(async (): Promise<string> => {
      this.assertCurrent();
      try { const raw = await fileIo.readText(this.path); this.assertCurrent(); return raw; }
      catch (error) { if ((error as BusinessError).code === 13900002) return ''; throw error; }
    });
  }
  async write(raw: string): Promise<void> {
    await this.serial(async (): Promise<void> => {
      this.assertCurrent(); await replaceReaderAtomicSnapshot(this.path, this.parent, raw); this.assertCurrent();
    });
  }
  private assertCurrent(): void { if (!this.current()) throw new Error('READING_PROGRESS_RUNTIME_RETIRED'); }
  private async serial<T>(work: () => Promise<T>): Promise<T> {
    const operation = ReadingProgressIntentFile.lane.then(work);
    ReadingProgressIntentFile.lane = operation.then((): void => {}, (): void => {});
    return operation;
  }
}
