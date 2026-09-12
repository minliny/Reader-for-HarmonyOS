import {
  copyReaderAppearanceSnapshot,
  normalizeReaderAppearanceSnapshot,
  type ReaderAppearanceSnapshot,
} from './ReaderAppearanceState.ts';

export interface ReaderAppearancePersistence {
  load(): Promise<ReaderAppearanceSnapshot>;
  save(snapshot: ReaderAppearanceSnapshot): Promise<void>;
}

export type ReaderAppearanceChange = (current: ReaderAppearanceSnapshot) => ReaderAppearanceSnapshot;
export type ReaderAppearanceChangeGuard = (current: ReaderAppearanceSnapshot) => boolean;

export class ReaderAppearanceCommit {
  readonly revision: number;
  readonly saved: Promise<void>;

  constructor(revision: number, saved: Promise<void>) {
    this.revision = revision;
    this.saved = saved;
  }
}

/** One application-lifetime owner for accepted appearance and ordered durable writes. */
export class ReaderAppearanceStore {
  private readonly persistence: ReaderAppearancePersistence;
  private snapshot: ReaderAppearanceSnapshot | undefined = undefined;
  private loading: Promise<void> | undefined = undefined;
  private revision: number = 0;
  private savedRevision: number = 0;
  private pendingWrites: number = 0;
  private writeTail: Promise<void> = Promise.resolve();
  private changeTail: Promise<void> = Promise.resolve();
  private latestSave: Promise<void> = Promise.resolve();

  constructor(persistence: ReaderAppearancePersistence) {
    this.persistence = persistence;
  }

  async load(): Promise<ReaderAppearanceSnapshot> {
    await this.changeTail;
    await this.ensureLoaded();
    // A later page sees accepted user intent even while its disk write is pending.
    return this.current();
  }

  current(): ReaderAppearanceSnapshot {
    if (this.snapshot === undefined) throw new Error('APPEARANCE_NOT_LOADED');
    return copyReaderAppearanceSnapshot(this.snapshot);
  }

  currentRevision(): number {
    return this.revision;
  }

  hasUnsavedChanges(): boolean {
    return this.savedRevision < this.revision;
  }

  async change(change: ReaderAppearanceChange, guard?: ReaderAppearanceChangeGuard):
    Promise<ReaderAppearanceCommit | undefined> {
    const applied = this.changeTail.then(async (): Promise<ReaderAppearanceCommit | undefined> => {
      await this.ensureLoaded();
      const current = this.current();
      // Check automatic recovery at admission, after every asynchronous load.
      if (guard !== undefined && !guard(current)) return undefined;
      const next = normalizeReaderAppearanceSnapshot(change(current));
      if (JSON.stringify(next) === JSON.stringify(current)) {
        const saved = this.pendingWrites > 0 ? this.latestSave :
          this.hasUnsavedChanges() ? this.enqueueSave() : Promise.resolve();
        return new ReaderAppearanceCommit(this.revision, saved);
      }
      this.snapshot = next;
      this.revision += 1;
      return new ReaderAppearanceCommit(this.revision, this.enqueueSave());
    });
    this.changeTail = applied.then((): void => {}, (): void => {});
    return applied;
  }

  async flush(): Promise<void> {
    // Lifecycle flush must not initialize preferences for a reader never opened.
    while (true) {
      // Include intents waiting on the first preferences read at background/exit.
      const changes = this.changeTail;
      await changes;
      if (this.loading !== undefined) await this.loading;
      if (changes !== this.changeTail) continue;
      if (!this.hasUnsavedChanges()) return;
      const save = this.pendingWrites > 0 ? this.latestSave : this.enqueueSave();
      await save;
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (this.snapshot !== undefined) return;
    if (this.loading === undefined) {
      this.loading = this.persistence.load().then((snapshot: ReaderAppearanceSnapshot): void => {
        this.snapshot = normalizeReaderAppearanceSnapshot(snapshot);
      });
    }
    const loading = this.loading;
    try {
      await loading;
    } finally {
      if (this.loading === loading) this.loading = undefined;
    }
  }

  private enqueueSave(): Promise<void> {
    const snapshot = this.current();
    const revision = this.revision;
    this.pendingWrites += 1;
    const save = this.writeTail.then((): Promise<void> => this.persistence.save(snapshot))
      .then((): void => { this.savedRevision = revision; })
      .finally((): void => { this.pendingWrites -= 1; });
    // Failure belongs to this commit; it cannot poison later user writes.
    this.writeTail = save.catch((): void => {});
    this.latestSave = save;
    return save;
  }
}
