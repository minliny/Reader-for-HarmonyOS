import type { LocalReadingAnchor, LocalReadingLayout, LocalReadingProgress, LocalReadingProgressState } from './LocalReadingFlowGateway';
import { observeReaderProgressOperation, reconcileReaderControlSelectionProgress } from './ReaderControlSelectionTransaction.ts';

export interface ReaderProgressProducerGateway {
  runProgressCommitSerial: (operation: () => Promise<void>) => Promise<void>;
  persistPresentedProgress: (bookId: string, title: string | undefined, anchor: LocalReadingAnchor,
    layout: LocalReadingLayout, isAdmitted?: () => boolean) => Promise<LocalReadingProgress>;
  loadProgress: (bookId: string, isCurrent: () => boolean) => Promise<LocalReadingProgressState>;
}

export interface ReaderProgressProducerReceipt {
  readonly sourceId?: string;
  readonly bookId: string;
  readonly chapterIndex: number;
  readonly chapterOffset: number;
  readonly updatedAt: number;
  readonly locationRevision?: string;
}

/** A captured UI intent, distinct from the durable owner retained by Gateway. */
export interface ReaderProgressProducerIntent {
  readonly sourceId: string;
  readonly bookId: string;
  readonly title: string | undefined;
  readonly anchor: LocalReadingAnchor;
  readonly layout: LocalReadingLayout;
  readonly gateway: ReaderProgressProducerGateway;
  readonly isOwner: () => boolean;
  readonly isCurrent: () => boolean;
  readonly committed: () => ReaderProgressProducerReceipt | undefined;
  readonly publish: (stored: LocalReadingProgress) => void;
}

export interface ReaderContinuousProgressDependencies {
  readonly active: () => boolean;
  readonly capture: () => ReaderProgressProducerIntent | undefined;
  readonly newerSample: (intent: ReaderProgressProducerIntent) => boolean;
  readonly completed: () => void;
  readonly settled: () => void;
  readonly failed: (error: Error) => void;
  readonly observationTimeoutMs?: number;
}

/** Reading producer arbitration only. The existing session progress owner
 * remains the single durable/CAS/serial owner for all three producer families.
 * This host retains an actual continuous drain across observer timeouts and
 * never dispatches a second writer to pretend an unknown result was cancelled. */
export class ReaderProgressProducerHost {
  continuousInFlight: boolean = false;
  continuousPending: boolean = false;
  continuousPromise: Promise<void> | undefined = undefined;
  continuousUnknownTarget: LocalReadingAnchor | undefined = undefined;
  continuousUnknownOrigin: ReaderProgressProducerReceipt | undefined = undefined;
  private continuousUnknownSourceId: string | undefined = undefined;
  private continuousUnknownBookId: string | undefined = undefined;
  private continuousDemand: ReaderContinuousProgressDependencies | undefined = undefined;

  retireContinuous(): void {
    this.continuousPending = false;
    this.continuousDemand = undefined;
    // Already-dispatched durable work/unknown receipts stay owned. A new mount
    // may queue a demand, but cannot start an overlapping progress drain.
  }

  async commitContinuous(dependencies: ReaderContinuousProgressDependencies): Promise<void> {
    if (!dependencies.active()) return;
    this.continuousPending = true;
    this.continuousDemand = dependencies;
    if (this.continuousPromise === undefined) {
      this.continuousInFlight = true;
      const operation = this.drainContinuous();
      this.continuousPromise = operation;
      const finish = (): void => {
        if (this.continuousPromise === operation) {
          this.continuousPromise = undefined;
          this.continuousInFlight = false;
        }
        const latest = this.continuousDemand;
        if (latest !== undefined && latest.active()) latest.settled();
      };
      void operation.then(finish, finish);
    }
    if (await observeReaderProgressOperation(this.continuousPromise, dependencies.observationTimeoutMs) === 'unknown')
      throw new Error('READING_CONTINUOUS_PROGRESS_UNKNOWN');
  }

  private async drainContinuous(): Promise<void> {
    while (this.continuousPending) {
      const dependencies = this.continuousDemand;
      if (dependencies === undefined || !dependencies.active()) return;
      this.continuousPending = false;
      await this.persistContinuous(dependencies);
    }
  }

  private async persistContinuous(dependencies: ReaderContinuousProgressDependencies): Promise<void> {
    const intent = dependencies.capture();
    if (intent === undefined || !intent.isOwner()) return;
    const anchor = intent.anchor;
    if (this.continuousUnknownTarget !== undefined) {
      await this.reconcileContinuous(intent);
      if (!intent.isCurrent()) return;
    }
    const committed = intent.committed();
    if (committed?.sourceId === intent.sourceId && committed.bookId === intent.bookId &&
      committed.chapterIndex === anchor.chapterIndex && committed.chapterOffset === anchor.chapterOffset) {
      dependencies.completed();
      return;
    }
    let attemptedWrite = false;
    try {
      if (!intent.isCurrent()) return;
      attemptedWrite = true;
      const stored = await intent.gateway.persistPresentedProgress(intent.bookId, intent.title,
        anchor, intent.layout, intent.isCurrent);
      this.requireExactReceipt(stored, intent, 'READING_CONTINUOUS_PROGRESS_ANCHOR_MISMATCH');
      if (!intent.isCurrent()) return;
      intent.publish(stored);
      if (intent.isCurrent()) dependencies.completed();
    } catch (error) {
      if (error instanceof Error && error.message === 'READING_PRESENTED_PROGRESS_SUPERSEDED') return;
      dependencies.failed(error as Error);
      // This projection conservatively retains a requested target; the actual
      // session owner knows whether its write dispatched and owns CAS recovery.
      // A retired UI cannot discard that owner or its unknown predecessor.
      if (!attemptedWrite) {
        if (intent.isOwner()) throw error;
        return;
      }
      this.continuousUnknownTarget = { ...anchor };
      this.continuousUnknownOrigin = committed;
      this.continuousUnknownSourceId = intent.sourceId;
      this.continuousUnknownBookId = intent.bookId;
      if (!intent.isOwner()) return;
      const targetConfirmed = await this.reconcileContinuous(intent, intent.isOwner);
      if (intent.isCurrent() && targetConfirmed) dependencies.completed();
      else if (intent.isCurrent()) throw new Error('READING_CONTINUOUS_PROGRESS_UNKNOWN');
    } finally {
      if (dependencies.active() && dependencies.newerSample(intent)) this.continuousPending = true;
    }
  }

  private async reconcileContinuous(intent: ReaderProgressProducerIntent,
    isCurrent: () => boolean = intent.isCurrent): Promise<boolean> {
    const target = this.continuousUnknownTarget;
    if (target === undefined) return false;
    if ((this.continuousUnknownSourceId !== undefined && this.continuousUnknownSourceId !== intent.sourceId) ||
      (this.continuousUnknownBookId !== undefined && this.continuousUnknownBookId !== intent.bookId))
      throw new Error('READING_CONTINUOUS_PROGRESS_FOREIGN');
    const result = await reconcileReaderControlSelectionProgress({ isCurrent,
      runSerial: (operation: () => Promise<void>): Promise<void> => intent.gateway.runProgressCommitSerial(operation),
      readProgress: async (): Promise<LocalReadingProgress | undefined> => {
        const state = await intent.gateway.loadProgress(intent.bookId, isCurrent);
        return state.kind === 'restored' ? state.progress : undefined;
      },
    });
    if (!isCurrent()) return false;
    const stored = result.progress;
    if (result.kind !== 'verified' || stored === undefined || stored.bookId !== intent.bookId)
      throw new Error('READING_CONTINUOUS_PROGRESS_UNKNOWN');
    const targetConfirmed = this.sameAnchor(stored, target);
    const origin = this.continuousUnknownOrigin;
    const originConfirmed = origin !== undefined && stored.chapterIndex === origin.chapterIndex &&
      stored.chapterOffset === origin.chapterOffset && stored.updatedAt === origin.updatedAt &&
      stored.locationRevision === origin.locationRevision;
    if (!targetConfirmed && !originConfirmed) throw new Error('READING_CONTINUOUS_PROGRESS_FOREIGN');
    this.continuousUnknownTarget = undefined;
    this.continuousUnknownOrigin = undefined;
    this.continuousUnknownSourceId = undefined;
    this.continuousUnknownBookId = undefined;
    if (targetConfirmed) intent.publish(stored as LocalReadingProgress);
    return targetConfirmed;
  }

  async commitTts(intent: ReaderProgressProducerIntent): Promise<void> {
    await this.commitAdmitted(intent, 'READING_TTS_PROGRESS_ANCHOR_MISMATCH');
  }

  async commitVisible(intent: ReaderProgressProducerIntent): Promise<void> {
    await this.commitAdmitted(intent, 'READING_VISIBLE_PROGRESS_ANCHOR_MISMATCH');
  }

  private async commitAdmitted(intent: ReaderProgressProducerIntent, mismatchCode: string): Promise<void> {
    if (!intent.isCurrent()) return;
    try {
      const stored = await intent.gateway.persistPresentedProgress(intent.bookId, intent.title,
        intent.anchor, intent.layout, intent.isCurrent);
      this.requireExactReceipt(stored, intent, mismatchCode);
      if (intent.isCurrent()) intent.publish(stored);
    } catch (error) {
      // This owner-generated outcome proves the older intent never dispatched.
      if (error instanceof Error && error.message === 'READING_PRESENTED_PROGRESS_SUPERSEDED') return;
      throw error;
    }
  }

  async persistPresented(intent: ReaderProgressProducerIntent, mismatchCode: string): Promise<LocalReadingProgress> {
    // No component admission function is passed to this durable dispatch.
    // Its Gateway owner survives a presentation disappearing or advancing.
    const stored = await intent.gateway.persistPresentedProgress(intent.bookId, intent.title, intent.anchor, intent.layout);
    this.requireExactReceipt(stored, intent, mismatchCode);
    if (intent.isCurrent()) intent.publish(stored);
    return stored;
  }

  private requireExactReceipt(stored: LocalReadingProgress, intent: ReaderProgressProducerIntent, code: string): void {
    if (stored.bookId !== intent.bookId || !this.sameAnchor(stored, intent.anchor)) throw new Error(code);
  }

  private sameAnchor(stored: LocalReadingProgress | ReaderProgressProducerReceipt, anchor: LocalReadingAnchor): boolean {
    return stored.chapterIndex === anchor.chapterIndex && stored.chapterOffset === anchor.chapterOffset &&
      (anchor.bodyVersion === undefined || (stored as LocalReadingProgress).bodyVersion === anchor.bodyVersion) &&
      (anchor.processingVersion === undefined || (stored as LocalReadingProgress).processingVersion === anchor.processingVersion);
  }
}
