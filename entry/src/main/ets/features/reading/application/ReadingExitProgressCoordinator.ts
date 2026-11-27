import { BookRequestNotDispatchedError } from '../../../app/BookRequestScheduler.ts';
import { ReadingCommit } from './ReadingCommit.ts';
import { CoreReadingAnchor } from './ReadingMeasurementFacts.ts';
import type { ReadingSessionChapter } from './ReadingChapterWindow';
import type { LocalReadingAnchor, LocalReadingLayout, LocalReadingProgress, LocalReadingProgressState } from './LocalReadingFlowGateway';
import type { ReadingSessionCommittedProgress } from './ReadingSessionFlowGateway';
import type { ReaderTtsProgressCommit } from './ReaderTtsSessionCoordinator';
import type { ReaderProgressProducerGateway, ReaderProgressProducerHost, ReaderProgressProducerIntent } from './ReaderProgressProducerHost';

export interface ReadingProgressIdentity {
  readonly sourceId: string;
  readonly bookId: string;
}

interface ReadingProgressPublication {
  readonly identity: () => ReadingProgressIdentity;
  readonly gateway: () => ReaderProgressProducerGateway;
  readonly layout: () => LocalReadingLayout;
  readonly publish: (stored: LocalReadingProgress) => void;
}

export interface ReadingVisibleProgressSample {
  readonly chapter: ReadingSessionChapter;
  readonly pageStart: number;
  readonly scalarCount: () => number;
  readonly isCurrent: () => boolean;
  readonly mayRenewVisit: () => boolean;
  readonly deviceId: () => Promise<string>;
}

export interface ReadingVisibleProgressHost extends ReadingProgressPublication {
  readonly ready: () => boolean;
  readonly mounted: () => boolean;
  readonly capture: () => ReadingVisibleProgressSample | undefined;
  readonly reportFailure: (error: Error) => string;
}

export interface ReadingContinuousProgressSample {
  readonly chapter: ReadingSessionChapter;
  readonly scalar: number;
  readonly scalarCount: number;
  readonly revision: number;
  readonly ownsSample: () => boolean;
}

export interface ReadingContinuousProgressHost extends ReadingProgressPublication {
  readonly active: () => boolean;
  readonly capture: () => ReadingContinuousProgressSample | undefined;
  readonly latestSample: () => ReadingSessionChapter | undefined;
  readonly revision: () => number;
  readonly visibleScalar: () => number;
  readonly completed: () => void;
  readonly settled: () => void;
  readonly failed: (error: Error) => void;
}

export interface ReadingExitProgressGateway {
  handoffPendingProgress(): void;
  handoffPresentedProgress(bookId: string, title: string | undefined, anchor: LocalReadingAnchor,
    layout: LocalReadingLayout, baseline?: LocalReadingProgressState): void;
}

export interface ReadingExitProgressSample {
  readonly identity: ReadingProgressIdentity;
  readonly chapter: ReadingSessionChapter;
  readonly continuous: boolean;
  readonly continuousScalar: () => number;
  readonly visibleScalar: () => number | undefined;
  readonly visibleCurrent: () => boolean;
  readonly ttsOwnsPosition: (committed: ReadingCommit | undefined) => boolean;
  readonly scalarCount: () => number;
  readonly layout: () => LocalReadingLayout;
}

export interface ReadingExitSpeech {
  capture(): ReaderTtsProgressCommit | undefined;
  stop(): Promise<void>;
}

type ReadingExitInputPhase = 'idle' | 'tracking' | 'dragging' | 'settling';
export type ReadingExitFailure = 'duration' | 'progress' | 'speech' | 'retention';

export interface ReadingExitHost {
  isActive(): boolean;
  isMounted(): boolean;
  cancelRapidInput(): void;
  unknownTurnWrite(): boolean;
  handoffTurnWrite(): void;
  deferExit(pending: boolean): void;
  releaseTurnRecoveryInput(): void;
  inputPhase(): ReadingExitInputPhase;
  cancelTracking(): boolean;
  retireBookmarkGesture?(): boolean;
  rollbackUncommittedTurn(): boolean;
  markRequested(): void;
  observePrefetch(): void;
  retireInputEffects(): void;
  handoffDuration(): void;
  speech(): ReadingExitSpeech | undefined;
  handoffProgress(spoken: ReaderTtsProgressCommit | undefined): void;
  retainEntry(): void;
  exit(): void;
  reportFailure(phase: ReadingExitFailure, error: Error): void;
}

export class ReadingExitProgressCoordinator {
  private progress: ReadingCommit | undefined = undefined;
  private visit: ReadingCommit | undefined = undefined;
  private visitVisible: boolean = false;
  private visitSkipped: boolean = false;
  private writeInFlight: boolean = false;
  private writeGeneration: number = 0;
  private exitDelivered: boolean = false;
  private exitGeneration: number = 0;
  private readonly producers: ReaderProgressProducerHost;

  constructor(producers: ReaderProgressProducerHost) {
    this.producers = producers;
  }

  get committed(): ReadingCommit | undefined { return this.progress; }
  get retainedVisit(): ReadingCommit | undefined { return this.visit; }
  get retainedVisitVisible(): boolean { return this.visitVisible; }
  get retainedVisitSkipped(): boolean { return this.visitSkipped; }
  get writeActive(): boolean { return this.writeInFlight; }

  retainCommittedVisit(): void { this.visit = this.progress; }
  presentRetainedVisit(): void { this.visitVisible = true; }
  clearCommitted(): void { this.progress = undefined; }

  retireRetainedVisit(): void {
    this.visit = undefined;
    this.visitVisible = false;
  }

  resetProgress(): void {
    this.clearCommitted();
    this.retireRetainedVisit();
    this.visitSkipped = false;
  }

  resetExitDelivery(): void { this.exitDelivered = false; }
  resetWriteActivity(): void { this.writeInFlight = false; }

  invalidateWrite(): void {
    this.writeGeneration += 1;
    this.resetWriteActivity();
  }

  acquireWrite(mounted: () => boolean): () => void {
    const generation = ++this.writeGeneration;
    this.writeInFlight = true;
    return (): void => {
      if (mounted() && this.writeGeneration === generation) this.resetWriteActivity();
    };
  }

  admitCommitted(identity: ReadingProgressIdentity, stored: ReadingSessionCommittedProgress,
    settle: () => void, publish: (commit: ReadingCommit) => void): void {
    const commit = new ReadingCommit(identity.sourceId, identity.bookId, stored.chapterIndex,
      stored.chapterOffset, stored.chapterProgress, stored.locationRevision, stored.updatedAt,
      stored.sourceSwitchTransactionId, stored.bodyVersion, stored.processingVersion, stored.progressRevision);
    this.progress = commit;
    settle();
    // Any acknowledged writer has renewed this visit.
    this.retireRetainedVisit();
    this.visitSkipped = false;
    publish(commit);
  }

  private samePosition(identity: ReadingProgressIdentity, chapter: ReadingSessionChapter, scalar: number): boolean {
    const committed = this.progress;
    return committed?.sourceId === identity.sourceId && committed.bookId === identity.bookId &&
      committed.chapterIndex === chapter.chapterIndex && committed.chapterOffset === scalar;
  }

  private renewal(): boolean {
    return this.visitVisible && this.visit === this.progress;
  }

  private anchor(chapter: ReadingSessionChapter, scalar: number, count: number,
    retained?: ReadingCommit): CoreReadingAnchor {
    const anchor = new CoreReadingAnchor(chapter.chapterIndex, scalar,
      retained === undefined ? (count === 0 ? 0 : scalar / count) : retained.chapterProgress,
      chapter.bodyVersion, chapter.processingVersion);
    if (retained !== undefined) anchor.retainedProgressReceipt = {
      progressRevision: retained.progressRevision,
      updatedAt: retained.updatedAt,
      locationRevision: retained.locationRevision,
    };
    return anchor;
  }

  intent(chapter: ReadingSessionChapter, anchor: LocalReadingAnchor, layout: LocalReadingLayout,
    identity: () => ReadingProgressIdentity, gateway: () => ReaderProgressProducerGateway,
    isOwner: () => boolean, isCurrent: () => boolean, publish: (stored: LocalReadingProgress) => void): ReaderProgressProducerIntent {
    const captured = identity();
    const owner = (): boolean => {
      const live = identity();
      return live.sourceId === captured.sourceId && live.bookId === captured.bookId && isOwner();
    };
    return {
      sourceId: captured.sourceId, bookId: captured.bookId, title: chapter.chapterTitle, anchor, layout, gateway: gateway(),
      isOwner: owner, isCurrent: (): boolean => owner() && isCurrent(),
      committed: (): ReadingCommit | undefined => this.progress,
      publish: (stored: LocalReadingProgress): void => { if (owner()) publish(stored); },
    };
  }

  async commitVisible(host: ReadingVisibleProgressHost): Promise<void> {
    if (!host.ready() || this.writeActive) return;
    const sample = host.capture();
    if (sample === undefined || !sample.isCurrent()) return;
    const same = this.samePosition(host.identity(), sample.chapter, sample.pageStart);
    const renewal = same && this.renewal();
    if (same && !renewal) return;
    const committed = this.progress;
    const release = this.acquireWrite(host.mounted);
    let requested = false;
    try {
      const scalarCount = sample.scalarCount();
      const current = (): boolean => sample.isCurrent() &&
        (!renewal || (sample.mayRenewVisit() && this.visit === committed && this.progress === committed));
      const anchor = this.anchor(sample.chapter, sample.pageStart, scalarCount, renewal ? committed : undefined);
      if (renewal && committed !== undefined) anchor.deviceId = await sample.deviceId();
      const intent = this.intent(sample.chapter, anchor, host.layout(), host.identity, host.gateway,
        current, current, host.publish);
      requested = true;
      await this.producers.commitVisible(intent);
    } catch (error) {
      if (renewal && (!requested || (error instanceof BookRequestNotDispatchedError &&
        error.message === 'READING_RETAINED_RECENCY_NOT_DISPATCHED'))) {
        if (this.visit === committed) {
          this.retireRetainedVisit();
          this.visitSkipped = true;
        }
        return;
      }
      throw new Error(host.reportFailure(error as Error));
    } finally {
      release();
    }
  }

  async commitContinuous(host: ReadingContinuousProgressHost): Promise<void> {
    let capturedIntent: ReaderProgressProducerIntent | undefined = undefined;
    let capturedSample: ReadingContinuousProgressSample | undefined = undefined;
    await this.producers.commitContinuous({
      active: host.active,
      capture: (): ReaderProgressProducerIntent | undefined => {
        if (!host.active()) return undefined;
        const sample = host.capture();
        if (sample === undefined) return undefined;
        const offset = Math.max(0, Math.min(sample.scalarCount, sample.scalar));
        const current = (): boolean => sample.ownsSample() &&
          host.revision() === sample.revision && host.visibleScalar() === offset;
        capturedSample = sample;
        capturedIntent = this.intent(sample.chapter, this.anchor(sample.chapter, offset, sample.scalarCount),
          host.layout(), host.identity, host.gateway, sample.ownsSample, current, host.publish);
        return capturedIntent;
      },
      newerSample: (intent: ReaderProgressProducerIntent): boolean => capturedIntent === intent &&
        capturedSample !== undefined && host.latestSample() === capturedSample.chapter &&
        host.revision() !== capturedSample.revision,
      completed: host.completed,
      settled: host.settled,
      failed: host.failed,
    });
  }

  handoff(gateway: ReadingExitProgressGateway, spoken: ReaderTtsProgressCommit | undefined,
    capture: () => ReadingExitProgressSample | undefined): void {
    gateway.handoffPendingProgress();
    const sample = capture();
    if (sample === undefined) return;
    const chapter = sample.chapter;
    const identity = sample.identity;
    const spokenCurrent = spoken !== undefined && spoken.chapter.sourceId === identity.sourceId &&
      spoken.chapter.bookId === identity.bookId && spoken.chapter.chapterIndex === chapter.chapterIndex &&
      spoken.chapter.bodyVersion === chapter.bodyVersion && spoken.chapter.processingVersion === chapter.processingVersion;
    if (!spokenCurrent && sample.ttsOwnsPosition(this.progress)) return;
    const scalar = spokenCurrent ? spoken.charEnd : sample.continuous ? sample.continuousScalar() : sample.visibleScalar();
    if (scalar === undefined || (!sample.continuous && !spokenCurrent && !sample.visibleCurrent())) return;
    const count = sample.scalarCount();
    const offset = Math.max(0, Math.min(count, scalar));
    const committed = this.progress;
    const same = this.samePosition(identity, chapter, offset);
    const renewal = same && this.renewal();
    if (same && !renewal) return;
    const anchor = this.anchor(chapter, offset, count, renewal ? committed : undefined);
    const layout = sample.layout();
    const baseline: LocalReadingProgressState | undefined = committed?.progressRevision !== undefined &&
      committed.sourceId === identity.sourceId && committed.bookId === identity.bookId ?
      { kind: 'restored', progress: committed, progressRevision: committed.progressRevision } : undefined;
    gateway.handoffPresentedProgress(identity.bookId, chapter.chapterTitle, anchor, layout, baseline);
    if (renewal) this.retireRetainedVisit();
  }

  beginExit(host: ReadingExitHost): void {
    if (!host.isActive()) return;
    host.cancelRapidInput();
    if (host.unknownTurnWrite()) {
      host.handoffTurnWrite();
      host.deferExit(false);
      host.releaseTurnRecoveryInput();
    }
    if (host.retireBookmarkGesture?.() === true) return;
    const phase = host.inputPhase();
    if (phase === 'tracking' || phase === 'dragging') {
      host.deferExit(true);
      if (host.cancelTracking() && (!host.isActive() || host.inputPhase() !== 'idle')) return;
      host.deferExit(false);
    }
    if (host.inputPhase() === 'settling') {
      host.deferExit(true);
      if (host.rollbackUncommittedTurn()) return;
    }
    if (host.inputPhase() !== 'idle') {
      host.deferExit(true);
      return;
    }
    host.markRequested();
    host.observePrefetch();
    this.exitGeneration += 1;
    host.retireInputEffects();
    void this.finishExit(host);
  }

  private async finishExit(host: ReadingExitHost): Promise<void> {
    if (!host.isMounted() || this.exitDelivered) return;
    const generation = this.exitGeneration;
    // Runtime owns accepted writes. Neither disk nor the speech transport
    // joins the route's navigation dependency chain.
    try { host.handoffDuration(); } catch (error) { host.reportFailure('duration', error as Error); }
    const speech = host.speech();
    const spoken = speech?.capture();
    try { host.handoffProgress(spoken); } catch (error) { host.reportFailure('progress', error as Error); }
    if (speech !== undefined) {
      void speech.stop().catch((error: Error): void => host.reportFailure('speech', error));
    }
    if (!host.isMounted() || generation !== this.exitGeneration || this.exitDelivered) return;
    this.exitDelivered = true;
    try { host.retainEntry(); } catch (error) { host.reportFailure('retention', error as Error); }
    host.exit();
  }
}
