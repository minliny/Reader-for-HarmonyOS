import { BookRequestNotDispatchedError, type BookRequestOptions } from '../../app/BookRequestScheduler';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import type { LocalReadingAnchor, LocalReadingLayout, LocalReadingProgress, LocalReadingProgressState } from './LocalReadingFlowGateway';
import type { ReaderCoreErrorEvent } from '@reader/core-harmony';
import type { ReadingProgressCheckpoint, ReadingProgressCheckpointIntent } from './ReadingProgressJournal';

interface ProgressWriteFailure {
  name?: string;
  command?: string;
  event?: ReaderCoreErrorEvent;
  causeValue?: unknown;
}

/** Receipt truth can outlive the visible page; history is not current UI authority. */
export interface ReadingSessionProgressReceipt extends LocalReadingProgress {
  sourceSwitchTransactionId?: string;
  sourceCanonicalHistorical?: boolean;
  progressRevision?: string;
}

export interface ReadingSessionProgressAccess {
  /** Original canonical transaction identity, persisted with this exact write. */
  transactionId?: string;
  /** Source canonical ACK must be the exact immutable original write receipt. */
  requireWriteReceipt?: boolean;
  receiptIsCurrent?: (stored: LocalReadingProgress) => Promise<boolean>;
  read: (isCurrent: () => boolean) => Promise<LocalReadingProgressState>;
  write: (title: string | undefined, anchor: LocalReadingAnchor, layout: LocalReadingLayout,
    isCurrent: () => boolean, expectedProgressRevision?: string, dispatch?: BookRequestOptions) => Promise<LocalReadingProgress>;
}

class PresentedProgressIntent {
  sequence: number;
  title: string | undefined;
  anchor: LocalReadingAnchor;
  layout: LocalReadingLayout;
  valid: () => boolean;
  admitted: () => boolean;
  access: ReadingSessionProgressAccess;
  baseline: LocalReadingProgressState | undefined = undefined;
  writeDispatched: boolean = false;
  background: boolean = false;
  restored: boolean = false;
  recoveryValidated: boolean = false;
  state: 'pending' | 'failed' | 'confirmed' = 'pending';
  completion: Promise<LocalReadingProgress>;
  resolve: (value: LocalReadingProgress) => void = (): void => {};
  reject: (reason: Error) => void = (): void => {};

  constructor(sequence: number, title: string | undefined, anchor: LocalReadingAnchor,
    layout: LocalReadingLayout, valid: () => boolean, access: ReadingSessionProgressAccess,
    admitted: () => boolean) {
    this.sequence = sequence; this.title = title; this.anchor = { ...anchor }; this.layout = { ...layout }; this.valid = valid; this.access = access; this.admitted = admitted;
    this.completion = new Promise<LocalReadingProgress>((resolve, reject): void => {
      this.resolve = resolve; this.reject = reject;
    });
    // A superseded tail can be rejected before its caller attaches a handler.
    void this.completion.catch((): void => {});
  }
}

/** One dispatched/unknown position plus the latest unsent displayed target.
 * This owns no chapter/page/image and reuses the gateway's existing serial lane.
 * Core CAS, not locationRevision or a Host sequence, guards durable writes.
 */
export class ReadingSessionProgressOwner {
  private runtime: ReadingGatewayRuntime;
  private sourceId: string;
  private bookId: string;
  private serialize: (operation: () => Promise<void>) => Promise<void>;
  private sequence: number = 0;
  private runningSequence: number = 0;
  private active: PresentedProgressIntent | undefined = undefined;
  private tail: PresentedProgressIntent | undefined = undefined;
  private latest: PresentedProgressIntent | undefined = undefined;
  private work: Promise<LocalReadingProgress | undefined> | undefined = undefined;
  private drainRequested: boolean = false;
  private serialBoundaries: number = 0;
  private restoration: Promise<void> | undefined;
  private restoreAccess: ((transactionId?: string) => ReadingSessionProgressAccess) | undefined;
  private backgroundTimer: number = -1;
  private backgroundAttempts: number = 0;

  constructor(runtime: ReadingGatewayRuntime, sourceId: string, bookId: string,
    serialize: (operation: () => Promise<void>) => Promise<void>) {
    this.runtime = runtime; this.sourceId = sourceId; this.bookId = bookId; this.serialize = serialize;
  }

  /** Called by the finite gateway adapter; cold records never retain a UI. */
  restore(access: (transactionId?: string) => ReadingSessionProgressAccess): Promise<void> {
    this.restoreAccess = access;
    if (this.restoration !== undefined) return this.restoration;
    const journal = this.runtime.getReadingProgressJournal?.();
    if (journal === undefined) return Promise.resolve();
    const operation = (async (): Promise<void> => {
      const record = await journal.read(this.sourceId, this.bookId);
      if (record === undefined) return;
      const valid = this.runtime.captureReadingContentValidity?.(this.sourceId, this.bookId) ?? ((): boolean => true);
      const revived = (saved: ReadingProgressCheckpointIntent): PresentedProgressIntent => {
        const intent = new PresentedProgressIntent(saved.sequence, saved.title, saved.anchor, saved.layout,
          valid, access(saved.transactionId), (): boolean => true);
        intent.baseline = saved.baseline; intent.writeDispatched = saved.writeDispatched;
        intent.state = saved.writeDispatched ? 'failed' : 'pending';
        intent.background = true; intent.restored = true; return intent;
      };
      // A new mounted producer may have queued its target while local IO was
      // loading. The unknown predecessor is retained, but never replaces it.
      const newer = this.tail;
      this.sequence = Math.max(this.sequence, record.sequence);
      if (newer !== undefined) newer.sequence = ++this.sequence;
      this.active = record.active === undefined ? undefined : revived(record.active);
      this.tail = newer ?? (record.tail === undefined ? undefined : revived(record.tail));
      this.latest = this.tail ?? this.active;
    })();
    this.restoration = operation;
    void operation.catch((): void => { if (this.restoration === operation) this.restoration = undefined; });
    return operation;
  }

  async restorePendingState(): Promise<void> {
    if (this.restoration === undefined && this.restoreAccess !== undefined) await this.restore(this.restoreAccess);
    else await this.restoration;
  }

  /** Transfer execution, not UI authority. Capture must happen before unmount.
   * No Core/IO promise is awaited by navigation. */
  handoff(): void {
    for (const intent of [this.active, this.tail]) {
      if (intent === undefined) continue;
      intent.background = true; intent.admitted = (): boolean => true;
    }
    this.backgroundAttempts = 0;
    void this.startDrain().catch((): void => this.scheduleBackground());
  }

  private scheduleBackground(): void {
    if (this.runtime.getReadingProgressJournal === undefined || this.backgroundTimer !== -1 || this.backgroundAttempts >= 3 ||
      (this.active?.background !== true && this.tail?.background !== true)) return;
    if (![this.active, this.tail].some(intent => intent !== undefined &&
      (intent.valid() || (intent.writeDispatched && intent.access.requireWriteReceipt === true)))) return;
    const delay = [1000, 5000, 30000][this.backgroundAttempts++];
    this.backgroundTimer = setTimeout((): void => {
      this.backgroundTimer = -1;
      void this.startDrain().catch((): void => this.scheduleBackground());
    }, delay);
  }

  private checkpointIntent(intent: PresentedProgressIntent | undefined): ReadingProgressCheckpointIntent | undefined {
    if (intent === undefined) return undefined;
    return { sequence: intent.sequence, title: intent.title, anchor: { ...intent.anchor }, layout: { ...intent.layout },
      baseline: intent.baseline, writeDispatched: intent.writeDispatched, transactionId: intent.access.transactionId };
  }

  private async checkpoint(): Promise<void> {
    const journal = this.runtime.getReadingProgressJournal?.();
    if (journal === undefined) return;
    const active = this.checkpointIntent(this.active), tail = this.checkpointIntent(this.tail);
    if (active === undefined && tail === undefined) await journal.clear(this.sourceId, this.bookId, this.sequence);
    else {
      const record: ReadingProgressCheckpoint = { sourceId: this.sourceId, bookId: this.bookId,
        sequence: this.sequence, active, tail };
      await journal.put(record);
    }
  }

  async runSerial(operation: () => Promise<void>): Promise<void> {
    const sequence = ++this.sequence;
    this.serialBoundaries += 1;
    try {
      await this.restorePendingState();
      await this.inLane(Math.max(sequence, ++this.sequence), async (): Promise<void> => {
        // No new ordinary intent may cross this transaction boundary. An
        // unknown earlier write must be reconciled before the transaction runs.
        await this.drain();
        await operation();
      });
    } finally {
      this.serialBoundaries -= 1;
    }
  }

  pendingProgress(): LocalReadingProgressState | undefined {
    const intent = this.latest;
    if (intent === undefined) return undefined;
    // A cold unsent record has no right to hide a different current Core row.
    // Its original target remains in the journal until a fresh producer owns
    // this book, but cannot become an unproved resume projection.
    if (intent.restored && !intent.recoveryValidated) return undefined;
    if (!intent.writeDispatched && !intent.admitted()) { this.latest = undefined; return undefined; }
    if (!intent.valid()) { this.latest = undefined; return undefined; }
    return { kind: 'restored', presentationPending: true, progress: {
      bookId: this.bookId, chapterIndex: intent.anchor.chapterIndex, chapterOffset: intent.anchor.chapterOffset,
      chapterProgress: intent.anchor.chapterProgress, bodyVersion: intent.anchor.bodyVersion,
      processingVersion: intent.anchor.processingVersion,
      updatedAt: intent.baseline?.kind === 'restored' ? intent.baseline.progress.updatedAt : 0,
    } };
  }

  persistPresented(title: string | undefined, anchor: LocalReadingAnchor, layout: LocalReadingLayout,
    access: ReadingSessionProgressAccess, admitted: () => boolean = (): boolean => true,
    baseline?: LocalReadingProgressState): Promise<LocalReadingProgress> {
    if (this.serialBoundaries > 0) return Promise.reject(anchor.retainedProgressReceipt !== undefined ?
      new BookRequestNotDispatchedError('READING_RETAINED_RECENCY_NOT_DISPATCHED') :
      new Error('READING_PRESENTED_PROGRESS_TRANSACTION_PENDING'));
    if (!admitted()) return Promise.reject(new Error('READING_PRESENTED_PROGRESS_SUPERSEDED'));
    const valid = this.runtime.captureReadingContentValidity?.(this.sourceId, this.bookId) ?? ((): boolean => true);
    const intent = new PresentedProgressIntent(++this.sequence, title, anchor, layout, valid, access, admitted);
    intent.baseline = baseline;
    this.tail?.reject(new Error('READING_PRESENTED_PROGRESS_SUPERSEDED'));
    this.tail = intent;
    this.latest = intent;
    this.drainRequested = true;
    void this.restorePendingState().then((): Promise<void> => this.checkpoint()).catch((): void => {});
    this.startDrain();
    return intent.completion;
  }

  /** Only an actually serialized later commit can retire an older UI intent. */
  noteCommitted(): void {
    if (this.latest !== undefined && this.runningSequence >= this.latest.sequence) this.latest = undefined;
  }

  async awaitPersistence(): Promise<LocalReadingProgress | undefined> {
    await this.restorePendingState();
    let confirmed: LocalReadingProgress | undefined = undefined;
    const running = this.work;
    if (running !== undefined) {
      try { confirmed = await running; } catch (_) { /* This boundary performs one explicit reconciliation below. */ }
    }
    if (this.active === undefined && this.tail === undefined) return confirmed;
    return this.startDrain();
  }

  private startDrain(): Promise<LocalReadingProgress | undefined> {
    if (this.work !== undefined) return this.work;
    const operation = this.inLane(this.sequence, (): Promise<LocalReadingProgress | undefined> => this.drain());
    this.work = operation;
    void operation.then((): void => this.finishWork(operation), (error: Error): void => this.finishWork(operation, error));
    return operation;
  }

  private finishWork(operation: Promise<LocalReadingProgress | undefined>, error?: Error): void {
    if (this.work !== operation) return;
    this.work = undefined;
    if (error !== undefined) {
      this.scheduleBackground();
    }
    if (this.active === undefined && this.tail === undefined && this.backgroundTimer !== -1) {
      clearTimeout(this.backgroundTimer); this.backgroundTimer = -1;
    }
    if (this.drainRequested && this.serialBoundaries === 0) this.startDrain();
  }

  private async drain(): Promise<LocalReadingProgress | undefined> {
    const prerequisiteActive = this.active, prerequisiteTail = this.tail;
    try {
      await this.restorePendingState();
      await this.checkpoint();
    } catch (error) {
      // Reject only the callers which actually owned the failed local IO.
      // A new sample arriving after their rejection must not inherit an old
      // error or be mistaken for an unlimited implicit retry request.
      prerequisiteActive?.reject(error as Error); prerequisiteTail?.reject(error as Error);
      if (this.tail === prerequisiteTail) this.drainRequested = false;
      throw error;
    }
    let confirmed: LocalReadingProgress | undefined = undefined;
    while (this.active !== undefined || this.tail !== undefined) {
      if (this.active === undefined) {
        this.active = this.tail;
        this.tail = undefined;
        this.drainRequested = false;
      }
      const intent = this.active as PresentedProgressIntent;
      // Unsent work can be coalesced. A dispatched/unknown write is retained
      // independently of the latest presentation and can never take this exit.
      if (!intent.writeDispatched && (this.latest !== intent || !intent.admitted())) {
        intent.reject(new Error('READING_PRESENTED_PROGRESS_SUPERSEDED'));
        this.active = undefined;
        continue;
      }
      if (!intent.valid() && !(intent.writeDispatched && intent.access.requireWriteReceipt === true)) {
        intent.reject(new Error('READING_PRESENTED_PROGRESS_INVALIDATED'));
        if (this.latest === intent) this.latest = undefined;
        this.active = undefined;
        continue;
      }
      const retry = intent.state === 'failed';
      try {
        try {
          confirmed = await this.execute(intent, retry);
        } catch (error) {
          intent.state = 'failed';
          // This is optional same-position recency, not an unsaved new page.
          // Only a provably unsent intent may be released without an ACK.
          if (!intent.writeDispatched && intent.anchor.retainedProgressReceipt !== undefined) {
            intent.reject(new BookRequestNotDispatchedError('READING_RETAINED_RECENCY_NOT_DISPATCHED'));
            if (this.latest === intent) this.latest = undefined;
            this.active = undefined;
            continue;
          }
          intent.reject(error as Error);
          // A new displayed target may have arrived during the submitted write.
          // Read its predecessor's facts once before allowing that target out.
          if (!retry && intent.writeDispatched && this.tail !== undefined && intent.valid()) {
            confirmed = await this.execute(intent, true);
          } else {
            throw error;
          }
        }
        intent.state = 'confirmed';
        if (intent.background && intent.valid() &&
          (confirmed as ReadingSessionProgressReceipt).sourceCanonicalHistorical !== true) {
          try { this.runtime.notifyBackgroundReadingProgressConfirmed?.(this.sourceId, this.bookId); }
          catch (_) { /* A projection listener cannot revoke the durable ACK. */ }
        }
        intent.resolve(confirmed);
        if (this.latest === intent) this.latest = undefined;
        this.active = undefined;
        // A recovered coalesced tail may inherit only this exact predecessor's
        // acknowledged CAS row, never an unrelated fresh baseline.
        if (this.tail?.restored && confirmed.progressRevision !== undefined) {
          this.tail.baseline = { kind: 'restored', progress: { ...confirmed }, progressRevision: confirmed.progressRevision };
        }
        await this.checkpoint();
      } catch (error) {
        intent.state = 'failed';
        intent.reject(error as Error);
        if (intent.background && this.tail !== undefined && intent.access.requireWriteReceipt !== true &&
          error instanceof Error && error.message === 'READING_PRESENTED_PROGRESS_RETRY_CONFLICT') {
          // Core has advanced the original CAS generation: an old delayed
          // command can no longer win. A new displayed target may use that
          // new row; the old unknown receipt has no authority over its UI.
          this.active = undefined;
          continue;
        }
        if (intent.background && !intent.writeDispatched && error instanceof Error &&
          error.message === 'READING_PRESENTED_PROGRESS_RECOVERY_CONFLICT') {
          // A proven-unsent stale CAS target cannot delay a new session or
          // content transaction. Keep the newer authoritative Core position.
          if (this.latest === intent) this.latest = undefined;
          this.active = undefined;
          await this.checkpoint();
          continue;
        }
        if ((!intent.writeDispatched && (this.latest !== intent || !intent.admitted())) || (!intent.valid() && !(intent.writeDispatched && intent.access.requireWriteReceipt === true))) {
          if (this.latest === intent) this.latest = undefined;
          this.active = undefined;
          continue;
        }
        // Keep both the unknown predecessor and latest target for an explicit
        // retry boundary; never retry indefinitely or silently skip the former.
        this.tail?.reject(error as Error);
        this.drainRequested = false;
        if (intent.background) this.scheduleBackground();
        throw error;
      }
    }
    this.drainRequested = false;
    await this.checkpoint();
    return confirmed;
  }

  private async execute(intent: PresentedProgressIntent, retry: boolean): Promise<LocalReadingProgress> {
    if (!intent.writeDispatched && !intent.admitted()) throw new Error('READING_PRESENTED_PROGRESS_SUPERSEDED');
    if (!intent.writeDispatched && intent.anchor.retainedProgressReceipt !== undefined && intent.anchor.deviceId === undefined) {
      const record = this.runtime.getReadingRecordGateway?.();
      if (record === undefined) throw new BookRequestNotDispatchedError('READING_RETAINED_RECENCY_NOT_DISPATCHED');
      intent.anchor.deviceId = await record.currentDeviceId();
    }
    const exactReplay = intent.writeDispatched && intent.access.requireWriteReceipt === true;
    const current = await intent.access.read(exactReplay ? (): boolean => true : intent.valid);
    if (!intent.valid() && !exactReplay) throw new Error('READING_PRESENTED_PROGRESS_INVALIDATED');
    if (!intent.writeDispatched && this.latest !== intent) throw new Error('READING_PRESENTED_PROGRESS_SUPERSEDED');
    // UI/selection admission applies only before the first dispatch. A later
    // retirement never discards or cancels an already-dispatched/unknown write.
    if (!intent.writeDispatched && !intent.admitted()) throw new Error('READING_PRESENTED_PROGRESS_SUPERSEDED');
    // A retained page renews only its original receipt. Using a newly read CAS
    // revision alone would authorize rewinding a position advanced elsewhere
    // before this visit reached the serial lane. This guard is Host-only and
    // is bypassed after dispatch so an unknown ACK can still be reconciled.
    const retained = intent.anchor.retainedProgressReceipt;
    if (!intent.writeDispatched && retained !== undefined && (!retained.progressRevision ||
      current.progressRevision !== retained.progressRevision || current.kind !== 'restored' ||
      !this.matchesTarget(current.progress, intent.anchor) ||
      current.progress.chapterProgress !== intent.anchor.chapterProgress ||
      current.progress.updatedAt !== retained.updatedAt || current.progress.locationRevision !== retained.locationRevision)) {
      throw new Error('READING_RETAINED_PROGRESS_CHANGED');
    }
    const hasCas = this.runtime.supportsCoreCapability?.('reading.progress.compareAndSet.v1') === true;
    if (intent.restored && !intent.writeDispatched && intent.baseline === undefined)
      throw new Error('READING_PRESENTED_PROGRESS_RECOVERY_BASELINE_MISSING');
    if (intent.restored && !intent.writeDispatched && current.progressRevision !== intent.baseline?.progressRevision)
      throw new Error('READING_PRESENTED_PROGRESS_RECOVERY_CONFLICT');
    if (retained !== undefined && !hasCas) throw new Error('READING_RETAINED_PROGRESS_CAS_REQUIRED');
    if (hasCas && (current.progressRevision === undefined || current.progressRevision.length === 0)) {
      throw new Error('READING_PRESENTED_PROGRESS_REVISION_MISSING');
    }
    if (retry && intent.writeDispatched && intent.access.requireWriteReceipt !== true) {
      // An anchor alone is not an operation generation. Without CAS a read
      // cannot exclude an old submitted command writing after a later target.
      if (!hasCas) throw new Error('READING_PRESENTED_PROGRESS_CAS_REQUIRED');
      if (current.kind === 'restored' && this.matchesTarget(current.progress, intent.anchor) &&
        current.progressRevision !== intent.baseline?.progressRevision) return current.progress;
      if (intent.baseline === undefined || current.progressRevision !== intent.baseline.progressRevision) {
        throw new Error('READING_PRESENTED_PROGRESS_RETRY_CONFLICT');
      }
    } else if (!intent.writeDispatched && !intent.restored) {
      intent.baseline = current.kind === 'restored' ?
        { kind: 'restored', progress: { ...current.progress }, progressRevision: current.progressRevision } :
        { kind: 'missing', progressRevision: current.progressRevision };
    }
    intent.recoveryValidated = true;
    const priorWriteUnknown = intent.writeDispatched;
    intent.writeDispatched = true;
    // The original baseline/transaction tuple is durably retained before Core
    // can accept it. Observer timeout, unmount and cold launch reuse it.
    await this.checkpoint();
    let stored: LocalReadingProgress;
    try {
      stored = await intent.access.write(intent.title, intent.anchor, intent.layout,
        exactReplay ? (): boolean => true : intent.valid,
        hasCas ? intent.baseline?.progressRevision : undefined, {
          canDispatch: (): boolean => exactReplay || (intent.valid() && intent.admitted() && this.latest === intent),
          onDispatch: (): void => { intent.writeDispatched = true; },
        });
    } catch (error) {
      // Core rejected this CAS before changing either position or history. A
      // fresh attempt can read a new baseline, or yield to the newer tail.
      // A rejected retry must not erase an earlier request's unknown result.
      if (!priorWriteUnknown && (this.isNotDispatched(error) || (hasCas && this.isProgressCasRejected(error)))) {
        intent.writeDispatched = false;
        if (!intent.background && !intent.restored) intent.baseline = undefined;
        else intent.restored = true;
        await this.checkpoint();
      }
      throw error;
    }
    if (!intent.valid() && intent.access.requireWriteReceipt !== true) throw new Error('READING_PRESENTED_PROGRESS_INVALIDATED');
    if (!this.matchesTarget(stored, intent.anchor)) throw new Error('READING_INITIAL_PROGRESS_ANCHOR_MISMATCH');
    if (exactReplay && intent.access.receiptIsCurrent !== undefined) {
      let currentReceipt = false;
      try { currentReceipt = await intent.access.receiptIsCurrent(stored); } catch (_) { /* ACK stays confirmed; current projection may remain unavailable. */ }
      if (!currentReceipt) return { ...stored, sourceCanonicalHistorical: true } as ReadingSessionProgressReceipt;
    }
    return stored;
  }

  private isNotDispatched(error: unknown): boolean {
    if (error instanceof BookRequestNotDispatchedError) return true;
    if (error === null || typeof error !== 'object') return false;
    return (error as ProgressWriteFailure).causeValue instanceof BookRequestNotDispatchedError;
  }

  private isProgressCasRejected(error: unknown): boolean {
    if (error === null || typeof error !== 'object') return false;
    let failure = error as ProgressWriteFailure;
    // Remote reading preserves the SDK error at this one feature boundary.
    if (failure.name === 'RemoteReadingGatewayError' && failure.command === 'reading.progress.update') {
      if (failure.causeValue === null || typeof failure.causeValue !== 'object') return false;
      failure = failure.causeValue as ProgressWriteFailure;
    }
    const event = failure.event;
    return event?.type === 'error' && event.error?.code === 'INVALID_PARAMS' &&
      ['READING_PROGRESS_CHANGED', 'POSITION_CONTEXT_STALE', 'DIRECTORY_TARGET_STALE'].includes(event.error.details?.['reason'] as string);
  }

  private matchesTarget(progress: LocalReadingProgress, anchor: LocalReadingAnchor): boolean {
    return progress.bookId === this.bookId && progress.chapterIndex === anchor.chapterIndex &&
      progress.chapterOffset === anchor.chapterOffset &&
      (anchor.bodyVersion === undefined || progress.bodyVersion === anchor.bodyVersion) &&
      (anchor.processingVersion === undefined || progress.processingVersion === anchor.processingVersion);
  }

  private async inLane<T>(sequence: number, operation: () => Promise<T>): Promise<T> {
    let result: T | undefined = undefined;
    await this.serialize(async (): Promise<void> => {
      this.runningSequence = sequence;
      try { result = await operation(); } finally { this.runningSequence = 0; }
    });
    return result as T;
  }
}

const owners: WeakMap<ReadingGatewayRuntime, Map<string, ReadingSessionProgressOwner>> = new WeakMap();

export function readingSessionProgressOwner(runtime: ReadingGatewayRuntime, sourceId: string, bookId: string,
  serialize: (operation: () => Promise<void>) => Promise<void>): ReadingSessionProgressOwner {
  let books = owners.get(runtime);
  if (books === undefined) { books = new Map(); owners.set(runtime, books); }
  const key = JSON.stringify([sourceId, bookId]);
  let owner = books.get(key);
  if (owner === undefined) { owner = new ReadingSessionProgressOwner(runtime, sourceId, bookId, serialize); books.set(key, owner); }
  return owner;
}
