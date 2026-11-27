import type { LocalReadingProgressState } from '../application/LocalReadingFlowGateway';
import type { ReadingSessionChapter } from '../application/ReadingChapterWindow';
import type { RemoteReadingPositionContext } from '../application/RemoteReadingPositionMigration';
import {
  readerControlSelectionMayClose, readerControlSelectionOwnsReading, readerControlSelectionRecoveryAction,
  reconcileReaderControlSelectionProgress, type ReaderControlSelectionCommit, type ReaderControlSelectionDisplayAnchor,
  type ReaderControlSelectionOwner, type ReaderControlSelectionStoredProgress, type ReaderControlSelectionTicket,
} from '../application/ReaderControlSelectionTransaction.ts';
import type { ReaderTtsFollowLease } from '../ui/ReaderTtsPageFollow';
import type { ReaderControlDeferredCatalogSelection } from './ReaderControlSelectionRouting';

/** Request retained either by a page settlement or by the selection's retry. */
export class ReaderDeferredChapterSelection {
  chapterIndex: number;
  chapterOffset: number;
  requireChapterStart: boolean;
  stopTts: boolean;
  requestedProgress: number | undefined;
  controlOwnerRevision: number;
  closeControlOnCommit: boolean;
  refreshContent: boolean;
  positionContext?: RemoteReadingPositionContext;
  ttsOwner?: ReaderTtsFollowLease;

  constructor(
    chapterIndex: number,
    chapterOffset: number,
    requireChapterStart: boolean,
    stopTts: boolean,
    requestedProgress: number | undefined,
    controlOwnerRevision: number,
    closeControlOnCommit: boolean = true,
    refreshContent: boolean = false,
    positionContext?: RemoteReadingPositionContext,
    ttsOwner?: ReaderTtsFollowLease,
  ) {
    this.ttsOwner = ttsOwner;
    this.chapterIndex = chapterIndex;
    this.chapterOffset = chapterOffset;
    this.requireChapterStart = requireChapterStart;
    this.stopTts = stopTts;
    this.requestedProgress = requestedProgress;
    this.controlOwnerRevision = controlOwnerRevision;
    this.closeControlOnCommit = closeControlOnCommit;
    this.refreshContent = refreshContent;
    this.positionContext = positionContext;
  }
}

export interface ReaderChapterSelectionScope {
  sourceId: string;
  bookId: string;
  lifecycleToken: number;
  selectionToken: number;
}

export interface ReaderChapterSelectionDispatch {
  prepare(request: ReaderDeferredChapterSelection): boolean;
  scope(): ReaderChapterSelectionScope;
  owner(): ReaderControlSelectionOwner;
  nextSelection(): number;
  adoptControlRevision(): number;
  openRevision(): number;
  selectionActive(lifecycleToken: number, selectionToken: number): boolean;
  isKnown(chapterIndex: number): boolean;
  catalogPending(): boolean;
  deferCatalog(capture: () => ReaderControlDeferredCatalogSelection): void;
  chapterAt(chapterIndex: number): ReadingSessionChapter | undefined;
  queueOnSettlement(request: ReaderDeferredChapterSelection): boolean;
  interruptPlayback(stopTts: boolean): void;
  resetObservations(): void;
  load(request: ReaderDeferredChapterSelection, lifecycleToken: number, selectionToken: number): void;
  closeControl(): void;
}

export interface ReaderChapterSelectionProgressGateway {
  runProgressCommitSerial(operation: () => Promise<void>): Promise<void>;
  loadProgress(bookId: string, isCurrent: () => boolean): Promise<LocalReadingProgressState>;
}

export interface ReaderChapterSelectionPresentation<Display, Origin extends Display> {
  captureVisibleOrigin(): Origin | undefined;
  anchor(display: Display | undefined): ReaderControlSelectionDisplayAnchor | undefined;
  matchesLayout(display: Display): boolean;
  beginFailure(error: Error): void;
  invalidateUnverifiedDisplay(): void;
  showFailure(ticket: ReaderControlSelectionTicket, error: Error, detail: string): void;
  restore(display: Display, stored: ReaderControlSelectionStoredProgress): void;
  completeRestoredTarget(ticket: ReaderControlSelectionTicket, display: Display, stored: ReaderControlSelectionStoredProgress): void;
  notifyRestored(ticket: ReaderControlSelectionTicket, display: Display, stored: ReaderControlSelectionStoredProgress): void;
  reopenRefreshed(ticket: ReaderControlSelectionTicket, stored: ReaderControlSelectionStoredProgress,
    context: RemoteReadingPositionContext): Promise<void>;
}

/** Retains origin, candidate and retry as one selection until a measured receipt
 * or the same serialized Core progress owner decides which display is valid. */
export class ReaderChapterSelectionOwner<Display, Origin extends Display, Candidate extends Display> {
  private activeTicket: ReaderControlSelectionTicket | undefined = undefined;
  private retainedOrigin: Origin | undefined = undefined;
  private measuredTarget: Candidate | undefined = undefined;
  private retryRequest: ReaderDeferredChapterSelection | undefined = undefined;
  private reconciling: boolean = false;
  private readonly dispatch: ReaderChapterSelectionDispatch;
  private readonly presentation: ReaderChapterSelectionPresentation<Display, Origin>;
  private readonly gateway: () => ReaderChapterSelectionProgressGateway;

  constructor(dispatch: ReaderChapterSelectionDispatch, presentation: ReaderChapterSelectionPresentation<Display, Origin>,
    gateway: () => ReaderChapterSelectionProgressGateway) {
    this.dispatch = dispatch;
    this.presentation = presentation;
    this.gateway = gateway;
  }

  get ticket(): ReaderControlSelectionTicket | undefined { return this.activeTicket; }
  get origin(): Origin | undefined { return this.retainedOrigin; }
  get candidate(): Candidate | undefined { return this.measuredTarget; }

  reset(): void {
    this.retireDisplays();
    this.retryRequest = undefined;
    this.reconciling = false;
  }

  select(request: ReaderDeferredChapterSelection): void {
    if (!this.dispatch.prepare(request)) return;
    const scope = this.dispatch.scope();
    const proof = request.positionContext?.directoryTargetProof;
    const hasExactProof = proof !== undefined && proof.sourceId === scope.sourceId &&
      proof.bookId === scope.bookId && proof.chapterIndex === request.chapterIndex;
    if (!this.dispatch.isKnown(request.chapterIndex)) {
      if (!this.dispatch.catalogPending()) return;
      if (!hasExactProof) {
        this.deferSelection(request);
        return;
      }
    }
    const existing = this.dispatch.chapterAt(request.chapterIndex);
    let context = request.positionContext;
    if (context === undefined && request.requestedProgress === undefined && existing?.bodyVersion !== undefined &&
      existing.processingVersion !== undefined) context = { bodyVersion: existing.bodyVersion,
        processingVersion: existing.processingVersion,
        anchors: [{ id: 'requested', offset: request.requireChapterStart ? 0 : request.chapterOffset }] };
    const controlRevision = this.selectionControlRevision(request);
    const admitted = this.withPosition(request, controlRevision, context);
    if (this.dispatch.queueOnSettlement(admitted)) return;
    const lifecycleToken = scope.lifecycleToken;
    const origin = controlRevision >= 0 ? this.captureOrigin() : undefined;
    this.dispatch.interruptPlayback(admitted.stopTts);
    const selectionToken = this.dispatch.nextSelection();
    this.dispatch.resetObservations();
    if (controlRevision < 0) this.activeTicket = undefined;
    else {
      const scope = this.dispatch.scope();
      this.activeTicket = { sourceId: scope.sourceId, bookId: scope.bookId, lifecycleToken, selectionToken,
        controlOpenRevision: controlRevision, targetChapterIndex: admitted.chapterIndex,
        closeOnCommit: admitted.closeControlOnCommit, refreshContent: admitted.refreshContent };
    }
    this.retainedOrigin = origin;
    this.measuredTarget = undefined;
    this.retryRequest = admitted;
    this.reconciling = false;
    this.dispatch.load(admitted, lifecycleToken, selectionToken);
  }

  private deferSelection(request: ReaderDeferredChapterSelection): void {
    this.dispatch.deferCatalog((): ReaderControlDeferredCatalogSelection => {
      const scope = this.dispatch.scope();
      const ownerRevision = this.selectionControlRevision(request);
      return {
        isCurrent: (): boolean => this.dispatch.selectionActive(scope.lifecycleToken, scope.selectionToken) &&
          !this.dispatch.catalogPending() && !(ownerRevision >= 0 && ownerRevision !== this.dispatch.openRevision()),
        dispatch: (): void => this.select(this.withPosition(request, ownerRevision, request.positionContext)),
      };
    });
  }

  private selectionControlRevision(request: ReaderDeferredChapterSelection): number {
    return request.controlOwnerRevision === -2 ? this.dispatch.adoptControlRevision() : request.controlOwnerRevision;
  }

  private withPosition(request: ReaderDeferredChapterSelection, controlRevision: number,
    positionContext?: RemoteReadingPositionContext): ReaderDeferredChapterSelection {
    return new ReaderDeferredChapterSelection(request.chapterIndex, request.chapterOffset, request.requireChapterStart,
      request.stopTts, request.requestedProgress, controlRevision, request.closeControlOnCommit,
      request.refreshContent, positionContext, request.ttsOwner);
  }

  captureOrigin(): Origin | undefined {
    const visible = this.presentation.captureVisibleOrigin();
    if (visible !== undefined) return visible;
    const ticket = this.activeTicket;
    if (ticket === undefined) return undefined;
    const scope = this.dispatch.scope();
    // A later in-flight choice inherits the last committed display, never an intermediate body.
    if (ticket.sourceId === scope.sourceId && ticket.bookId === scope.bookId &&
      ticket.lifecycleToken === scope.lifecycleToken && ticket.selectionToken === scope.selectionToken) return this.retainedOrigin;
    return undefined;
  }

  captureCandidate(selectionToken: number, capture: () => Candidate): void {
    if (this.activeTicket?.selectionToken === selectionToken) this.measuredTarget = capture();
  }

  complete(selectionToken: number, lifecycleToken: number, commit: () => ReaderControlSelectionCommit,
    report: (ticket: ReaderControlSelectionTicket, owner: ReaderControlSelectionOwner) => void): void {
    const ticket = this.activeTicket;
    if (ticket === undefined || ticket.selectionToken !== selectionToken || ticket.lifecycleToken !== lifecycleToken) return;
    const owner = this.dispatch.owner();
    const mayClose = readerControlSelectionMayClose(ticket, owner, commit());
    report(ticket, owner);
    this.reset();
    if (mayClose) this.dispatch.closeControl();
  }

  recover(error: Error, lifecycleToken: number): boolean {
    const ticket = this.activeTicket;
    if (ticket === undefined || ticket.lifecycleToken !== lifecycleToken ||
      !readerControlSelectionOwnsReading(ticket, this.dispatch.owner())) return false;
    if (this.reconciling) return true;
    // Retire failed continuations while preserving both displays for exact Core readback.
    const selectionToken = this.dispatch.nextSelection();
    const replacement: ReaderControlSelectionTicket = {
      sourceId: ticket.sourceId, bookId: ticket.bookId, lifecycleToken: ticket.lifecycleToken,
      selectionToken, controlOpenRevision: ticket.controlOpenRevision,
      targetChapterIndex: ticket.targetChapterIndex, closeOnCommit: ticket.closeOnCommit, refreshContent: ticket.refreshContent,
    };
    this.activeTicket = replacement;
    this.reconciling = true;
    this.presentation.beginFailure(error);
    void this.reconcile(replacement, error).catch((recoveryError: Error): void => {
      if (!this.current(replacement)) return;
      this.reconciling = false;
      this.presentation.invalidateUnverifiedDisplay();
      this.presentation.showFailure(replacement, error, `位置核实或画面恢复未完成：${recoveryError.message}`);
    });
    return true;
  }

  private current(ticket: ReaderControlSelectionTicket): boolean {
    return this.activeTicket === ticket && readerControlSelectionOwnsReading(ticket, this.dispatch.owner());
  }

  private async reconcile(ticket: ReaderControlSelectionTicket, error: Error): Promise<void> {
    const gateway = this.gateway();
    const isCurrent = (): boolean => this.current(ticket);
    const result = await reconcileReaderControlSelectionProgress({
      isCurrent,
      runSerial: (operation: () => Promise<void>): Promise<void> => gateway.runProgressCommitSerial(operation),
      readProgress: async (): Promise<ReaderControlSelectionStoredProgress | undefined> => {
        const state = await gateway.loadProgress(ticket.bookId, isCurrent);
        return state.kind === 'restored' ? state.progress : undefined;
      },
    });
    if (!isCurrent() || result.kind === 'obsolete') return;
    this.reconciling = false;
    const origin = this.retainedOrigin;
    const target = this.measuredTarget;
    const action = readerControlSelectionRecoveryAction(result, this.presentation.anchor(origin), this.presentation.anchor(target));
    const display: Display | undefined = action === 'target' ? target : (action === 'origin' ? origin : undefined);
    const stored = result.progress;
    if (display === undefined || stored === undefined || !this.presentation.matchesLayout(display)) {
      if (stored !== undefined && await this.recoverRefreshed(ticket, stored)) return;
      this.presentation.invalidateUnverifiedDisplay();
      const detail = result.kind === 'verified' ? '已保存位置与当前保留画面不同' :
        `无法核实已保存位置：${result.errorCode}`;
      this.presentation.showFailure(ticket, error, detail);
      return;
    }
    this.presentation.restore(display, stored);
    if (action === 'target') this.presentation.completeRestoredTarget(ticket, display, stored);
    else {
      this.retireDisplays();
      this.presentation.showFailure(ticket, error, '已核实并保留原阅读位置');
    }
    this.presentation.notifyRestored(ticket, display, stored);
  }

  private async recoverRefreshed(ticket: ReaderControlSelectionTicket,
    stored: ReaderControlSelectionStoredProgress): Promise<boolean> {
    const retry = this.retryRequest;
    const previous = retry?.positionContext;
    if (retry?.refreshContent !== true || previous === undefined || stored.bookId !== ticket.bookId ||
      stored.chapterIndex !== ticket.targetChapterIndex || stored.bodyVersion === undefined || stored.processingVersion === undefined ||
      (stored.bodyVersion === previous.bodyVersion && stored.processingVersion === previous.processingVersion) ||
      !readerControlSelectionOwnsReading(ticket, this.dispatch.owner())) return false;
    // The serialized read proves replacement content. Re-read that body once,
    // using a non-refresh retry so a layout failure cannot replay forceRefresh.
    const context: RemoteReadingPositionContext = { bodyVersion: stored.bodyVersion, processingVersion: stored.processingVersion,
      anchors: [{ id: 'requested', offset: stored.chapterOffset }] };
    this.retryRequest = new ReaderDeferredChapterSelection(stored.chapterIndex, stored.chapterOffset, false, retry.stopTts,
      undefined, retry.controlOwnerRevision, retry.closeControlOnCommit, false, context);
    await this.presentation.reopenRefreshed(ticket, stored, context);
    return true;
  }

  private retireDisplays(): void {
    this.activeTicket = undefined;
    this.retainedOrigin = undefined;
    this.measuredTarget = undefined;
  }

  retryAction(ticket: ReaderControlSelectionTicket): () => void {
    const retry = this.retryRequest;
    return (): void => { this.retry(ticket, retry); };
  }

  retryCurrent(): boolean { return this.retry(this.activeTicket, this.retryRequest); }

  private retry(ticket: ReaderControlSelectionTicket | undefined, request: ReaderDeferredChapterSelection | undefined): boolean {
    if (ticket === undefined || request === undefined || !readerControlSelectionOwnsReading(ticket, this.dispatch.owner())) return false;
    this.select(request);
    return true;
  }
}
