import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import type { LocalReadingAnchor, LocalReadingLayout, LocalReadingProgress, LocalReadingProgressState } from './LocalReadingFlowGateway';
import type { ReaderCoreErrorEvent } from '@reader/core-harmony';

interface ProgressWriteFailure {
  name?: string;
  command?: string;
  event?: ReaderCoreErrorEvent;
  causeValue?: unknown;
}

export interface ReadingSessionProgressAccess {
  read: (isCurrent: () => boolean) => Promise<LocalReadingProgressState>;
  write: (title: string | undefined, anchor: LocalReadingAnchor, layout: LocalReadingLayout,
    isCurrent: () => boolean, expectedProgressRevision?: string) => Promise<LocalReadingProgress>;
}

class PresentedProgressIntent {
  sequence: number;
  title: string | undefined;
  anchor: LocalReadingAnchor;
  layout: LocalReadingLayout;
  valid: () => boolean;
  access: ReadingSessionProgressAccess;
  baseline: LocalReadingProgressState | undefined = undefined;
  writeDispatched: boolean = false;
  state: 'pending' | 'failed' | 'confirmed' = 'pending';
  completion: Promise<LocalReadingProgress>;
  resolve: (value: LocalReadingProgress) => void = (): void => {};
  reject: (reason: Error) => void = (): void => {};

  constructor(sequence: number, title: string | undefined, anchor: LocalReadingAnchor,
    layout: LocalReadingLayout, valid: () => boolean, access: ReadingSessionProgressAccess) {
    this.sequence = sequence; this.title = title; this.anchor = { ...anchor }; this.layout = { ...layout }; this.valid = valid; this.access = access;
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

  constructor(runtime: ReadingGatewayRuntime, sourceId: string, bookId: string,
    serialize: (operation: () => Promise<void>) => Promise<void>) {
    this.runtime = runtime; this.sourceId = sourceId; this.bookId = bookId; this.serialize = serialize;
  }

  async runSerial(operation: () => Promise<void>): Promise<void> {
    const sequence = ++this.sequence;
    this.serialBoundaries += 1;
    try {
      await this.inLane(sequence, async (): Promise<void> => {
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
    if (!intent.valid()) { this.latest = undefined; return undefined; }
    return { kind: 'restored', presentationPending: true, progress: {
      bookId: this.bookId, chapterIndex: intent.anchor.chapterIndex, chapterOffset: intent.anchor.chapterOffset,
      chapterProgress: intent.anchor.chapterProgress, bodyVersion: intent.anchor.bodyVersion,
      processingVersion: intent.anchor.processingVersion,
      updatedAt: intent.baseline?.kind === 'restored' ? intent.baseline.progress.updatedAt : 0,
    } };
  }

  persistPresented(title: string | undefined, anchor: LocalReadingAnchor, layout: LocalReadingLayout,
    access: ReadingSessionProgressAccess): Promise<LocalReadingProgress> {
    if (this.serialBoundaries > 0) return Promise.reject(new Error('READING_PRESENTED_PROGRESS_TRANSACTION_PENDING'));
    const valid = this.runtime.captureReadingContentValidity?.(this.sourceId, this.bookId) ?? ((): boolean => true);
    const intent = new PresentedProgressIntent(++this.sequence, title, anchor, layout, valid, access);
    this.tail?.reject(new Error('READING_PRESENTED_PROGRESS_SUPERSEDED'));
    this.tail = intent;
    this.latest = intent;
    this.drainRequested = true;
    this.startDrain();
    return intent.completion;
  }

  /** Only an actually serialized later commit can retire an older UI intent. */
  noteCommitted(): void {
    if (this.latest !== undefined && this.runningSequence >= this.latest.sequence) this.latest = undefined;
  }

  async awaitPersistence(): Promise<LocalReadingProgress | undefined> {
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
    void operation.then((): void => this.finishWork(operation), (): void => this.finishWork(operation));
    return operation;
  }

  private finishWork(operation: Promise<LocalReadingProgress | undefined>): void {
    if (this.work !== operation) return;
    this.work = undefined;
    if (this.drainRequested && this.serialBoundaries === 0) this.startDrain();
  }

  private async drain(): Promise<LocalReadingProgress | undefined> {
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
      if (!intent.writeDispatched && this.latest !== intent) {
        intent.reject(new Error('READING_PRESENTED_PROGRESS_SUPERSEDED'));
        this.active = undefined;
        continue;
      }
      if (!intent.valid()) {
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
        intent.resolve(confirmed);
        if (this.latest === intent) this.latest = undefined;
        this.active = undefined;
      } catch (error) {
        intent.state = 'failed';
        intent.reject(error as Error);
        if ((!intent.writeDispatched && this.latest !== intent) || !intent.valid()) {
          if (this.latest === intent) this.latest = undefined;
          this.active = undefined;
          continue;
        }
        // Keep both the unknown predecessor and latest target for an explicit
        // retry boundary; never retry indefinitely or silently skip the former.
        this.tail?.reject(error as Error);
        this.drainRequested = false;
        throw error;
      }
    }
    this.drainRequested = false;
    return confirmed;
  }

  private async execute(intent: PresentedProgressIntent, retry: boolean): Promise<LocalReadingProgress> {
    const current = await intent.access.read(intent.valid);
    if (!intent.valid()) throw new Error('READING_PRESENTED_PROGRESS_INVALIDATED');
    if (!intent.writeDispatched && this.latest !== intent) throw new Error('READING_PRESENTED_PROGRESS_SUPERSEDED');
    const hasCas = this.runtime.supportsCoreCapability?.('reading.progress.compareAndSet.v1') === true;
    if (hasCas && (current.progressRevision === undefined || current.progressRevision.length === 0)) {
      throw new Error('READING_PRESENTED_PROGRESS_REVISION_MISSING');
    }
    if (retry && intent.writeDispatched) {
      // An anchor alone is not an operation generation. Without CAS a read
      // cannot exclude an old submitted command writing after a later target.
      if (!hasCas) throw new Error('READING_PRESENTED_PROGRESS_CAS_REQUIRED');
      if (current.kind === 'restored' && this.matchesTarget(current.progress, intent.anchor) &&
        current.progressRevision !== intent.baseline?.progressRevision) return current.progress;
      if (intent.baseline === undefined || current.progressRevision !== intent.baseline.progressRevision) {
        throw new Error('READING_PRESENTED_PROGRESS_RETRY_CONFLICT');
      }
    } else {
      intent.baseline = current.kind === 'restored' ?
        { kind: 'restored', progress: { ...current.progress }, progressRevision: current.progressRevision } :
        { kind: 'missing', progressRevision: current.progressRevision };
    }
    const priorWriteUnknown = intent.writeDispatched;
    intent.writeDispatched = true;
    let stored: LocalReadingProgress;
    try {
      stored = await intent.access.write(intent.title, intent.anchor, intent.layout, intent.valid,
        hasCas ? intent.baseline?.progressRevision : undefined);
    } catch (error) {
      // Core rejected this CAS before changing either position or history. A
      // fresh attempt can read a new baseline, or yield to the newer tail.
      // A rejected retry must not erase an earlier request's unknown result.
      if (!priorWriteUnknown && hasCas && this.isProgressCasRejected(error)) {
        intent.writeDispatched = false;
        intent.baseline = undefined;
      }
      throw error;
    }
    if (!intent.valid()) throw new Error('READING_PRESENTED_PROGRESS_INVALIDATED');
    if (!this.matchesTarget(stored, intent.anchor)) throw new Error('READING_INITIAL_PROGRESS_ANCHOR_MISMATCH');
    return stored;
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
      event.error.details?.['reason'] === 'READING_PROGRESS_CHANGED';
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
