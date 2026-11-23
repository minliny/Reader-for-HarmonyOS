import {
  copyReaderAppearanceSnapshot,
  normalizeReaderAppearanceSnapshot,
  type ReaderAppearanceSnapshot,
} from './ReaderAppearanceState.ts';

export interface ReaderAppearancePersistence {
  load(): Promise<ReaderAppearanceSnapshot>;
  save(snapshot: ReaderAppearanceSnapshot): Promise<void>;
  /** Warm platform cache is not a durable acknowledgement. */
  hasUnconfirmedSave?(): boolean;
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

/** Read-only facts from the original accepted appearance/write owner. */
export class ReaderAppearanceSaveState {
  readonly revision: number;
  readonly unconfirmed: boolean;
  readonly saving: boolean;
  readonly retrying: boolean;
  readonly canRetry: boolean;

  constructor(revision: number = 0, unconfirmed: boolean = false, saving: boolean = false,
    retrying: boolean = false, canRetry: boolean = false) {
    this.revision = revision;
    this.unconfirmed = unconfirmed;
    this.saving = saving;
    this.retrying = retrying;
    this.canRetry = canRetry;
  }
}

/** Distinguishes accepted-but-incomplete saves from a rejected new selection. */
export class ReaderAppearanceSaveUnconfirmedError extends Error {
  readonly originalError: Error;

  constructor(originalError: Error) {
    super(originalError.message);
    this.name = 'ReaderAppearanceSaveUnconfirmedError';
    this.originalError = originalError;
  }
}

/** One application-lifetime owner for accepted appearance and ordered durable writes. */
export class ReaderAppearanceStore {
  private readonly persistence: ReaderAppearancePersistence;
  private snapshot: ReaderAppearanceSnapshot | undefined = undefined;
  private readonly listeners: Set<(snapshot: ReaderAppearanceSnapshot, revision: number) => void> = new Set();
  private loading: Promise<void> | undefined = undefined;
  private revision: number = 0;
  private savedRevision: number = 0;
  private pendingWrites: number = 0;
  private writeTail: Promise<void> = Promise.resolve();
  private changeTail: Promise<void> = Promise.resolve();
  private latestSave: Promise<void> = Promise.resolve();
  private saveFailed: boolean = false;
  private retryInFlight: boolean = false;
  private retryRevision: number = 0;
  private readonly saveListeners: Set<(state: ReaderAppearanceSaveState) => void> = new Set();

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

  subscribe(listener: (snapshot: ReaderAppearanceSnapshot, revision: number) => void): () => void {
    this.listeners.add(listener);
    if (this.snapshot !== undefined) {
      try { listener(this.current(), this.revision); } catch (_) { /* A view cannot reject an accepted preference. */ }
    }
    return (): void => { this.listeners.delete(listener); };
  }

  private publish(): void {
    this.listeners.forEach((listener: (snapshot: ReaderAppearanceSnapshot, revision: number) => void): void => {
      try { listener(this.current(), this.revision); } catch (_) { /* Continue the original save and later observers. */ }
    });
  }

  currentRevision(): number {
    return this.revision;
  }

  hasUnsavedChanges(): boolean {
    return this.savedRevision < this.revision;
  }

  saveState(): ReaderAppearanceSaveState {
    const unconfirmed = this.saveFailed && this.hasUnsavedChanges();
    return new ReaderAppearanceSaveState(this.revision, unconfirmed, this.pendingWrites > 0,
      this.retryInFlight && this.retryRevision === this.revision,
      unconfirmed && this.pendingWrites === 0 && !this.retryInFlight);
  }

  subscribeSaveState(listener: (state: ReaderAppearanceSaveState) => void): () => void {
    this.saveListeners.add(listener);
    this.deliverSaveState(listener, this.saveState());
    return (): void => { this.saveListeners.delete(listener); };
  }

  /** Continue the same accepted full-snapshot setter; never restore an old value. */
  async retrySave(expectedRevision: number): Promise<void> {
    const state = this.saveState();
    if (expectedRevision !== this.revision || !state.canRetry) return;
    this.retryInFlight = true;
    this.retryRevision = expectedRevision;
    this.publishSaveState();
    try {
      await this.flush();
    } finally {
      this.retryInFlight = false;
      this.retryRevision = 0;
      this.publishSaveState();
    }
  }

  private publishSaveState(): void {
    const state = this.saveState();
    this.saveListeners.forEach((listener: (state: ReaderAppearanceSaveState) => void): void => {
      this.deliverSaveState(listener, state);
    });
  }

  private deliverSaveState(listener: (state: ReaderAppearanceSaveState) => void,
    state: ReaderAppearanceSaveState): void {
    try { listener(state); } catch (_) { /* Presentation cannot change a durable write receipt. */ }
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
      this.publish();
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
        if (this.persistence.hasUnconfirmedSave?.() === true) {
          this.revision = 1;
          this.saveFailed = true;
        }
        this.publish();
        this.publishSaveState();
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
    this.publishSaveState();
    const save = this.writeTail.then((): Promise<void> => this.persistence.save(snapshot))
      .then((): void => {
        this.savedRevision = revision;
        if (!this.hasUnsavedChanges()) this.saveFailed = false;
      })
      .catch((error: Error): void => {
        this.saveFailed = true;
        throw error;
      })
      .finally((): void => {
        this.pendingWrites -= 1;
        this.publishSaveState();
      });
    // A rejected native put/flush may have persisted. Retain accepted intent;
    // no compensation or cached read may manufacture a durable receipt.
    // A later lifecycle flush/new choice writes the latest complete snapshot
    // through the same ordered, idempotent setter.
    this.writeTail = save.catch((): void => {});
    this.latestSave = save;
    return save;
  }
}
