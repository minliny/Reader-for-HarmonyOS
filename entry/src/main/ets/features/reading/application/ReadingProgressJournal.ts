import type { LocalReadingAnchor, LocalReadingLayout, LocalReadingProgressState } from './LocalReadingFlowGateway';

export interface ReadingProgressCheckpointIntent {
  sequence: number;
  title?: string;
  anchor: LocalReadingAnchor;
  layout: LocalReadingLayout;
  baseline?: LocalReadingProgressState;
  writeDispatched: boolean;
  transactionId?: string;
}
export interface ReadingProgressCheckpoint {
  sourceId: string;
  bookId: string;
  sequence: number;
  active?: ReadingProgressCheckpointIntent;
  tail?: ReadingProgressCheckpointIntent;
}
export interface ReadingProgressJournalStorage {
  read(): Promise<string>;
  write(raw: string): Promise<void>;
}

/** One finite checkpoint per book, sharing the platform AtomicFile adapter.
 * This stores position/CAS facts only, never a page, body, image or callback. */
export class ReadingProgressJournal {
  private readonly storage: ReadingProgressJournalStorage;
  private records: ReadingProgressCheckpoint[] | undefined;
  private lane: Promise<void> = Promise.resolve();
  constructor(storage: ReadingProgressJournalStorage) { this.storage = storage; }

  async all(): Promise<ReadingProgressCheckpoint[]> {
    return this.serial(async (): Promise<ReadingProgressCheckpoint[]> => {
      await this.load(); return this.copy(this.records as ReadingProgressCheckpoint[]);
    });
  }
  async read(sourceId: string, bookId: string): Promise<ReadingProgressCheckpoint | undefined> {
    return (await this.all()).find(record => record.sourceId === sourceId && record.bookId === bookId);
  }
  async put(record: ReadingProgressCheckpoint): Promise<void> {
    const captured = this.copy(record);
    await this.serial(async (): Promise<void> => {
      await this.load();
      const records = this.records as ReadingProgressCheckpoint[];
      const old = records.find(value => this.sameBook(value, captured));
      if (old !== undefined && old.sequence > captured.sequence) return;
      this.records = [...records.filter(value => !this.sameBook(value, captured)), captured];
      await this.storage.write(JSON.stringify({ version: 1, records: this.records }));
    });
  }
  async clear(sourceId: string, bookId: string, sequence: number): Promise<void> {
    await this.serial(async (): Promise<void> => {
      await this.load();
      const records = this.records as ReadingProgressCheckpoint[];
      const old = records.find(value => value.sourceId === sourceId && value.bookId === bookId);
      if (old === undefined || old.sequence > sequence) return;
      this.records = records.filter(value => value !== old);
      await this.storage.write(JSON.stringify({ version: 1, records: this.records }));
    });
  }
  private async load(): Promise<void> {
    if (this.records !== undefined) return;
    const raw = await this.storage.read();
    if (raw === '') { this.records = []; return; }
    const value = JSON.parse(raw) as { version: number; records: ReadingProgressCheckpoint[] };
    if (value.version !== 1 || !Array.isArray(value.records)) throw new Error('READING_PROGRESS_JOURNAL_INVALID');
    const keys = new Set<string>();
    for (const record of value.records) {
      const key = JSON.stringify([record.sourceId, record.bookId]);
      if (typeof record.sourceId !== 'string' || record.sourceId.length === 0 ||
        typeof record.bookId !== 'string' || record.bookId.length === 0 || keys.has(key) ||
        !Number.isSafeInteger(record.sequence) || record.sequence < 1 || (!record.active && !record.tail))
        throw new Error('READING_PROGRESS_JOURNAL_INVALID');
      keys.add(key);
      for (const intent of [record.active, record.tail]) {
        if (intent === undefined) continue;
        const anchor = intent.anchor;
        if (!Number.isSafeInteger(intent.sequence) || intent.sequence < 1 || intent.sequence > record.sequence ||
          typeof intent.writeDispatched !== 'boolean' || !anchor ||
          !Number.isSafeInteger(anchor.chapterIndex) || anchor.chapterIndex < 0 ||
          !Number.isSafeInteger(anchor.chapterOffset) || anchor.chapterOffset < 0 ||
          !Number.isFinite(anchor.chapterProgress) || anchor.chapterProgress < 0 || anchor.chapterProgress > 1 ||
          !intent.layout || !Number.isFinite(intent.layout.viewportWidth) || intent.layout.viewportWidth <= 0 ||
          !Number.isFinite(intent.layout.viewportHeight) || intent.layout.viewportHeight <= 0 ||
          (intent.baseline !== undefined && !intent.baseline.progressRevision) ||
          (intent.writeDispatched && intent.baseline === undefined) ||
          (intent.transactionId !== undefined && (typeof intent.transactionId !== 'string' || !intent.transactionId)))
          throw new Error('READING_PROGRESS_JOURNAL_INVALID');
      }
    }
    this.records = value.records;
  }
  private sameBook(a: ReadingProgressCheckpoint, b: ReadingProgressCheckpoint): boolean {
    return a.sourceId === b.sourceId && a.bookId === b.bookId;
  }
  private copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
  private async serial<T>(work: () => Promise<T>): Promise<T> {
    const operation = this.lane.then(work);
    this.lane = operation.then((): void => {}, (): void => {});
    return operation;
  }
}
