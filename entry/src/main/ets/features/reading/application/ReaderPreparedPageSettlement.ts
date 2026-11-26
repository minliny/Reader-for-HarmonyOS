import type { LocalReadingProgress, LocalReadingProgressState } from './LocalReadingFlowGateway';
import { observeReaderProgressOperation, reconcileReaderControlSelectionProgress } from './ReaderControlSelectionTransaction.ts';

// A lost visual endpoint, slot receipt, or frame callback must leave a
// bounded recovery route for both commit and rollback.
const SETTLEMENT_DEADLINE_MS = 2000;

interface ReaderPageTurnTimer {
  set(delayMs: number, callback: () => void): number;
  clear(handle: number): void;
}

export interface ReaderPageTurnProgressTarget {
  readonly chapterIndex: number;
  readonly chapterOffset: number;
  readonly bodyVersion?: string;
  readonly processingVersion?: string;
}

export interface ReaderPageTurnOriginReceipt extends ReaderPageTurnProgressTarget {
  readonly updatedAt: number;
  readonly locationRevision?: string;
}

export interface ReaderPageTurnProgressGateway {
  runProgressCommitSerial(operation: () => Promise<void>): Promise<void>;
  loadProgress(bookId: string, isCurrent: () => boolean): Promise<LocalReadingProgressState>;
  handoffPendingProgress(): void;
}

export interface ReaderPreparedPageSettlementHost<TPrepared> {
  current(prepared: TPrepared, lifecycle: number, generation: number): boolean;
  canPresent(prepared: TPrepared): boolean;
  persistPresented(prepared: TPrepared, lifecycle: number): Promise<void>;
  write(prepared: TPrepared, current: () => boolean): Promise<LocalReadingProgress>;
  acquireWrite(lifecycle: number): () => void;
  gateway(): ReaderPageTurnProgressGateway;
  bookId(): string;
  position(prepared: TPrepared): ReaderPageTurnProgressTarget;
  origin(): ReaderPageTurnOriginReceipt | undefined;
  releaseUnknownInput(): void;
  finish(generation: number, presented?: boolean): void;
  reportFailure(error: Error): void;
}

export interface ReaderPageTurnDeadlineEvidence {
  terminalReleased(): boolean;
  awaitingSlots(): boolean;
  slotsCommitted(): boolean;
  phase(): string;
}

export type ReaderPageTurnDeadlineAction =
  'terminal-ack' | 'slots-ack' | 'fallback' | 'cleanup-surface' |
  'handoff-unknown' | 'finish-receipt' | 'rollback' | 'finish-rollback';

interface ReaderPreparedPagePromotion<TPrepared> {
  readonly action: 'promote';
  readonly prepared: TPrepared;
  readonly stored: LocalReadingProgress | undefined;
}

interface ReaderPreparedPagePendingJoin {
  readonly action: 'wait' | 'rollback';
}

export type ReaderPreparedPageJoin<TPrepared> = ReaderPreparedPagePromotion<TPrepared> | ReaderPreparedPagePendingJoin;

/** The prepared destination and its persistence receipt remain together until
 * a visual endpoint joins them. The host owns CAS, frame admission and input. */
export class ReaderPreparedPageSettlement<TPrepared> {
  private destination: TPrepared | undefined = undefined;
  private stored: LocalReadingProgress | undefined = undefined;
  private started: boolean = false;
  private finished: boolean = false;
  private succeeded: boolean = false;
  private deadline: number = -1;
  private readonly host: ReaderPreparedPageSettlementHost<TPrepared>;
  private readonly timer: ReaderPageTurnTimer;
  private readonly observationTimeoutMs: number | undefined;

  constructor(host: ReaderPreparedPageSettlementHost<TPrepared>, timer: ReaderPageTurnTimer, observationTimeoutMs?: number) {
    this.host = host;
    this.timer = timer;
    this.observationTimeoutMs = observationTimeoutMs;
  }

  get prepared(): TPrepared | undefined { return this.destination; }
  get commitStarted(): boolean { return this.started; }
  get commitFinished(): boolean { return this.finished; }
  get commitSucceeded(): boolean { return this.succeeded; }

  stage(prepared: TPrepared): void {
    this.destination = prepared;
    this.stored = undefined;
    this.clearResult();
    this.releaseCommit();
  }

  discardDestination(): void {
    this.destination = undefined;
    this.stored = undefined;
  }

  clearResult(): void {
    this.finished = false;
    this.succeeded = false;
  }

  releaseCommit(): void { this.started = false; }

  begin(prepared: TPrepared, lifecycle: number, generation: number): void {
    if (this.started) return;
    if (this.host.canPresent(prepared) && this.host.current(prepared, lifecycle, generation)) {
      this.started = true;
      this.finished = true;
      this.succeeded = true;
      void this.host.persistPresented(prepared, lifecycle);
      this.host.finish(generation, true);
      return;
    }
    this.started = true;
    const operation = this.persist(prepared, lifecycle, generation).then((succeeded: boolean | undefined): void => {
      this.admit(prepared, lifecycle, generation, succeeded);
    });
    // Timing out the UI observation does not cancel the serialized writer.
    void observeReaderProgressOperation(operation, this.observationTimeoutMs).then((result: 'completed' | 'unknown'): void => {
      if (result === 'unknown') this.handoffUnknown(prepared, lifecycle, generation);
    }).catch((): void => this.handoffUnknown(prepared, lifecycle, generation));
  }

  handoffUnknown(prepared: TPrepared, lifecycle: number, generation: number): void {
    this.admit(prepared, lifecycle, generation, undefined);
  }

  private admit(prepared: TPrepared, lifecycle: number, generation: number, succeeded: boolean | undefined): void {
    if (!this.host.current(prepared, lifecycle, generation)) return;
    if (succeeded === undefined) {
      this.host.gateway().handoffPendingProgress();
      this.host.releaseUnknownInput();
      return;
    }
    this.finished = true;
    this.succeeded = succeeded;
    this.host.finish(generation);
  }

  private async persist(prepared: TPrepared, lifecycle: number, generation: number): Promise<boolean | undefined> {
    if (!this.host.current(prepared, lifecycle, generation)) return false;
    const release = this.host.acquireWrite(lifecycle);
    try {
      if (!this.host.current(prepared, lifecycle, generation)) return undefined;
      const current = (): boolean => this.host.current(prepared, lifecycle, generation);
      const stored = await this.host.write(prepared, current);
      if (!current()) return undefined;
      const target = this.host.position(prepared);
      if (stored.chapterIndex !== target.chapterIndex || stored.chapterOffset !== target.chapterOffset) {
        throw new Error('READING_PAGE_TURN_PROGRESS_ANCHOR_MISMATCH');
      }
      this.stored = stored;
      return current();
    } catch (error) {
      this.host.reportFailure(error as Error);
      return this.reconcile(prepared, lifecycle, generation);
    } finally {
      release();
    }
  }

  private async reconcile(prepared: TPrepared, lifecycle: number, generation: number): Promise<boolean | undefined> {
    const gateway = this.host.gateway();
    const current = (): boolean => this.host.current(prepared, lifecycle, generation);
    const result = await reconcileReaderControlSelectionProgress({ isCurrent: current,
      runSerial: (operation: () => Promise<void>): Promise<void> => gateway.runProgressCommitSerial(operation),
      readProgress: async (): Promise<LocalReadingProgress | undefined> => {
        const state = await gateway.loadProgress(this.host.bookId(), current);
        return state.kind === 'restored' ? state.progress : undefined;
      },
    });
    const stored = result.progress;
    if (!current() || result.kind !== 'verified' || stored === undefined || stored.bookId !== this.host.bookId()) return undefined;
    if (sameTarget(stored, this.host.position(prepared))) {
      this.stored = stored;
      return true;
    }
    const origin = this.host.origin();
    return origin !== undefined && sameTarget(stored, origin) && stored.updatedAt === origin.updatedAt &&
      stored.locationRevision === origin.locationRevision ? false : undefined;
  }

  join(visualComplete: boolean, presented: boolean, fresh: (prepared: TPrepared) => boolean): ReaderPreparedPageJoin<TPrepared> {
    const prepared = this.destination;
    if (!visualComplete || !this.finished || prepared === undefined) return { action: 'wait' };
    const stored = this.stored;
    if (!this.succeeded || (!presented && stored === undefined) || !fresh(prepared)) {
      this.discardDestination();
      this.releaseCommit();
      return { action: 'rollback' };
    }
    return { action: 'promote', prepared, stored };
  }

  armDeadline(callback: () => void): void {
    this.cancelDeadline();
    this.deadline = this.timer.set(SETTLEMENT_DEADLINE_MS, (): void => {
      this.deadline = -1;
      callback();
    });
  }

  cancelDeadline(): void {
    if (this.deadline < 0) return;
    this.timer.clear(this.deadline);
    this.deadline = -1;
  }

  deadlineAction(evidence: ReaderPageTurnDeadlineEvidence): ReaderPageTurnDeadlineAction {
    if (evidence.terminalReleased()) return 'terminal-ack';
    if (evidence.awaitingSlots()) return evidence.slotsCommitted() ? 'slots-ack' : 'fallback';
    const phase = evidence.phase();
    if (phase === 'surfaceHidden') return 'cleanup-surface';
    if (phase === 'logicalPromoted') return 'fallback';
    if (this.destination === undefined) return 'finish-rollback';
    if (this.finished) return 'finish-receipt';
    return this.started ? 'handoff-unknown' : 'rollback';
  }
}

function sameTarget(stored: LocalReadingProgress, target: ReaderPageTurnProgressTarget): boolean {
  return stored.chapterIndex === target.chapterIndex && stored.chapterOffset === target.chapterOffset &&
    stored.bodyVersion === target.bodyVersion && stored.processingVersion === target.processingVersion;
}
