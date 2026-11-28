import {
  createReaderPageGestureState, type ReaderPageGesturePhase, type ReaderPageGestureState,
  type ReaderPageTurnDirection, type ReaderPageTurnOutcome,
} from '../ui/ReaderPageGestureState.ts';
import { ReaderPageSettlementTimeline } from './ReaderPageSettlementTimeline.ts';
import { ReaderPreparedPageSettlement, type ReaderPreparedPageJoin } from './ReaderPreparedPageSettlement.ts';
import type { ReadingPaginationKey } from './ReadingPaginationIndex';
import {
  beginReaderRapidPageTurn, cancelReaderRapidPageTurn, completeReaderRapidPageTurn,
  createReaderRapidPageTurnState, enqueueReaderRapidPageTurn, reachReaderRapidPageBoundary,
  readerRapidPageTurnDirection, readerRapidPageTurnHasWork, readerRapidPageTurnRetryExhausted,
  requestReaderRapidPageControl, retryReaderRapidPageTurn, type ReaderRapidPageTurnState,
} from './ReaderRapidPageTurnState.ts';

export interface ReaderRapidPageTurnHost {
  invalidateSpeechFollow(): void;
  lifecycleActive(): boolean;
  interactionEnabled(): boolean;
  controlVisible(): boolean;
  directBoundary(direction: ReaderPageTurnDirection): ReaderPageTurnOutcome | undefined;
  finishDirectGesture(): void;
  pointerHeld(): boolean;
  workInFlight(): boolean;
  openControl(): void;
  canTurnPage(): boolean;
  continuous(): boolean;
  requiresPreparedPage(): boolean;
  prepared(direction: ReaderPageTurnDirection): boolean;
  prepare(direction: ReaderPageTurnDirection): void;
  prioritize(direction: ReaderPageTurnDirection): void;
  perform(direction: ReaderPageTurnDirection): ReaderPageTurnOutcome;
  recordStarted(): void;
}

export interface ReaderPageTurnSlideHost {
  mounted(): boolean;
  generation(): number;
  now(): number;
  publishOffset(offset: number): void;
  postFrame(next: () => void): void;
  finished(generation: number): void;
  animateOffset?: (target: number, durationMs: number, onFinish: () => void) => (() => void) | undefined;
}

export interface ReaderPageTurnSlideOrigin {
  readonly offset: number;
  readonly width: number;
  readonly velocity: number;
  readonly gestureUndecided: boolean;
}

export interface ReaderFrozenPageTurnProjection<TLayout, TPage> {
  readonly revision: number;
  readonly layout: TLayout;
  readonly current: TPage;
  readonly previous: TPage | undefined;
  readonly next: TPage | undefined;
}

export interface ReaderPreparedNeighbourIdentity {
  readonly generation: number;
  readonly originChapterIndex: number;
  readonly originPageStartScalar: number;
  readonly key: ReadingPaginationKey;
  readonly context: ReaderPreparedNeighbourContent;
}

interface ReaderPreparedNeighbourContent {
  readonly contentVersion: string;
}

export interface ReaderPreparedNeighbourOwner {
  mounted(): boolean;
  generation(): number;
  visibleChapter(): number | undefined;
  visiblePageStart(): number | undefined;
  sourceId(): string;
  bookId(): string;
  layoutSignature(): string;
  contentVersion(chapterIndex: number): string | undefined;
}

export type ReaderPageTurnPresentationPhase = 'idle' | 'tracking' | 'settling' | 'rollback' |
  'logicalPromoted' | 'arkuiPresented' | 'surfaceHidden' | 'released';

export type ReaderPageTurnNativeEvent = 'surfaceReady' | 'textureReady' | 'framePresented' | 'commitEndpoint' |
  'rollbackComplete' | 'slotsCommitted' | 'terminalReleased' | 'surfaceFailed';

export interface ReaderPageTurnNativeEvidence {
  mounted(): boolean;
  surfaceMounted(): boolean;
  simulation(): boolean;
  active(): boolean;
  surfaceGeneration(): number;
  automaticStartPending(): boolean;
  awaitingSlots(): boolean;
  phase(): ReaderPageTurnPresentationPhase;
}

export interface ReaderPageTurnFrameEvidence {
  readonly active: boolean;
  readonly simulation: boolean;
  readonly surfaceGeneration: number;
  readonly awaitingSlots: boolean;
  readonly expectedRevision: number;
  readonly readyRevision: number;
  readonly scheduledRevision: number;
  readonly phase: ReaderPageTurnPresentationPhase;
}

export interface ReaderPageTurnDeferredViewport {
  readonly width: number;
  readonly height: number;
}

export interface ReaderPageTurnDeferredWork<TSelection, TAppearance, TWindowSettings> {
  readonly exit: boolean;
  readonly requestChanged: boolean;
  readonly selection: TSelection | undefined;
  readonly replaceReload: boolean;
  readonly projectionChapter: number;
  readonly appearance: TAppearance | undefined;
  readonly viewport: ReaderPageTurnDeferredViewport | undefined;
  readonly windowReflow: boolean;
  readonly windowSettings: TWindowSettings | undefined;
}

class ReaderPageTurnDeferredState<TSelection, TAppearance, TWindowSettings> {
  exit: boolean = false;
  requestChanged: boolean = false;
  selection: TSelection | undefined = undefined;
  replaceReload: boolean = false;
  projectionChapter: number = -1;
  appearance: TAppearance | undefined = undefined;
  viewport: ReaderPageTurnDeferredViewport | undefined = undefined;
  windowReflow: boolean = false;
  windowSettings: TWindowSettings | undefined = undefined;
}

export type ReaderPageTurnGestureAction = 'bookmark' | 'simulation' | 'direct' | 'slideDrag' |
  'rollback' | 'reset' | 'hold';

export interface ReaderPageTurnGestureRenderer {
  simulation(): boolean;
  slide(): boolean;
}

export type ReaderPageTurnDeferredChapterAction = 'requested' | 'selected' | 'replace' | 'projection' | 'none';

/** Owns one manual rapid destination, the currently measured gesture receipt,
 * and the slide clock. ArkUI still owns frame scheduling and pointer events;
 * the prepared settlement owner continues to serialize Core writes. */
export class ReadingPageTurnCoordinator<TLayout, TPage, TPrepared extends ReaderPreparedNeighbourIdentity, TSelection, TAppearance, TWindowSettings> {
  private deferred = new ReaderPageTurnDeferredState<TSelection, TAppearance, TWindowSettings>();
  generation: number = 0;
  animationFinished: boolean = false;
  private rapid: ReaderRapidPageTurnState = createReaderRapidPageTurnState();
  private pendingPointer: boolean = false;
  private slide: ReaderPageSettlementTimeline | undefined = undefined;
  private slideCancel: (() => void) | undefined = undefined;
  private projection: ReaderFrozenPageTurnProjection<TLayout, TPage> | undefined = undefined;
  private admitted: TPrepared | undefined = undefined;
  private previous: TPrepared | undefined = undefined;
  private next: TPrepared | undefined = undefined;
  gesture: ReaderPageGestureState = createReaderPageGestureState();
  private readonly settlement: ReaderPreparedPageSettlement<TPrepared>;

  constructor(settlement: ReaderPreparedPageSettlement<TPrepared>) {
    this.settlement = settlement;
  }

  get pendingDelta(): number { return this.rapid.pendingDelta; }
  get inFlightDirection(): ReaderPageTurnDirection | undefined { return this.rapid.inFlightDirection; }
  get deferredPointerReserved(): boolean { return this.pendingPointer; }
  direction(): ReaderPageTurnDirection | undefined { return readerRapidPageTurnDirection(this.rapid); }
  hasRapidWork(): boolean { return readerRapidPageTurnHasWork(this.rapid); }
  cancelRapid(): void { this.rapid = cancelReaderRapidPageTurn(this.rapid); }
  reachBoundary(direction: ReaderPageTurnDirection): void { this.rapid = reachReaderRapidPageBoundary(this.rapid, direction); }

  request(direction: ReaderPageTurnDirection, host: ReaderRapidPageTurnHost): ReaderPageTurnOutcome {
    host.invalidateSpeechFollow();
    if (!host.lifecycleActive()) return { kind: 'blocked', reason: 'lifecycle' };
    if (!host.interactionEnabled()) return { kind: 'blocked', reason: host.controlVisible() ? 'control' : 'overlay' };
    const boundary = host.directBoundary(direction);
    if (boundary !== undefined && this.rapid.inFlightDirection === undefined) {
      this.reachBoundary(direction);
      host.finishDirectGesture();
      return boundary;
    }
    this.rapid = enqueueReaderRapidPageTurn(this.rapid, direction);
    if (!host.pointerHeld() && !this.pendingPointer) host.prioritize(this.direction() ?? direction);
    return this.drain(host);
  }

  drain(host: ReaderRapidPageTurnHost): ReaderPageTurnOutcome {
    if (!host.interactionEnabled()) {
      this.cancelRapid();
      return { kind: 'blocked', reason: !host.lifecycleActive() ? 'lifecycle' : (host.controlVisible() ? 'control' : 'overlay') };
    }
    if (host.pointerHeld() || this.pendingPointer || this.rapid.inFlightDirection !== undefined || host.workInFlight()) {
      return { kind: 'busy' };
    }
    if (this.rapid.controlRequested) {
      host.openControl();
      return { kind: 'blocked', reason: 'control' };
    }
    const direction = this.direction();
    if (direction === undefined || !host.canTurnPage() && !host.continuous()) return { kind: 'busy' };
    // Continuous reading uses its live scroller, not adjacent page textures.
    if (!host.continuous() && host.requiresPreparedPage() && !host.prepared(direction)) {
      host.prepare(direction);
      return { kind: 'preparing' };
    }
    const result = host.perform(direction);
    if (result.kind === 'started') {
      host.recordStarted();
      this.rapid = beginReaderRapidPageTurn(this.rapid, direction);
    } else if (result.kind === 'boundary') {
      this.reachBoundary(direction);
    } else if (result.kind === 'blocked') {
      this.cancelRapid();
    }
    return result;
  }

  completeRapid(expectedDirection?: ReaderPageTurnDirection): void {
    const direction = this.rapid.inFlightDirection;
    if (direction === undefined || expectedDirection !== undefined && expectedDirection !== direction) return;
    this.rapid = completeReaderRapidPageTurn(this.rapid, direction);
  }

  retryRapid(reportExhausted: () => void): void {
    const direction = this.rapid.inFlightDirection;
    if (direction === undefined) return;
    this.rapid = retryReaderRapidPageTurn(this.rapid, direction);
    if (readerRapidPageTurnRetryExhausted(this.rapid)) {
      reportExhausted();
      this.cancelRapid();
    }
  }

  reserveDeferredPointer(): boolean {
    if (this.pendingPointer) return false;
    this.pendingPointer = true;
    return true;
  }

  releaseDeferredPointer(): void { this.pendingPointer = false; }

  requestControl(): void { this.rapid = requestReaderRapidPageControl(this.rapid); }

  deferExit(pending: boolean): void { this.deferred.exit = pending; }
  get exitPending(): boolean { return this.deferred.exit; }
  deferRequestedChapter(): void { this.deferred.requestChanged = true; }
  deferChapterSelection(selection: TSelection): void { this.deferred.selection = selection; }
  discardDeferredSelectionIf(stale: (selection: TSelection) => boolean): void {
    const selection = this.deferred.selection;
    if (selection !== undefined && stale(selection)) this.deferred.selection = undefined;
  }
  deferReplaceReload(): void { this.deferred.replaceReload = true; }
  deferContentProjection(chapterIndex: number): void { this.deferred.projectionChapter = chapterIndex; }
  deferAppearance(appearance: TAppearance): void { this.deferred.appearance = appearance; }
  deferViewport(width: number, height: number): void { this.deferred.viewport = { width, height }; }
  deferWindowReflow(): void { this.deferred.windowReflow = true; }
  deferWindowSettings(settings: TWindowSettings): void { this.deferred.windowSettings = settings; }

  takeDeferredWork(active: boolean, mounted: boolean): ReaderPageTurnDeferredWork<TSelection, TAppearance, TWindowSettings> | undefined {
    if (active || !mounted) return undefined;
    const work = this.deferred;
    this.clearDeferredWork();
    return work;
  }

  clearDeferredWork(): void {
    this.deferred = new ReaderPageTurnDeferredState<TSelection, TAppearance, TWindowSettings>();
  }

  deferredChapterAction(work: ReaderPageTurnDeferredWork<TSelection, TAppearance, TWindowSettings>): ReaderPageTurnDeferredChapterAction {
    if (work.requestChanged) return 'requested';
    if (work.selection !== undefined) return 'selected';
    if (work.replaceReload) return 'replace';
    return work.projectionChapter >= 0 ? 'projection' : 'none';
  }

  nativeEvent(event: ReaderPageTurnNativeEvent, generation: number, evidence: ReaderPageTurnNativeEvidence):
    ReaderPageTurnNativeEvent | undefined {
    if (!evidence.mounted()) return undefined;
    switch (event) {
      case 'surfaceReady':
      case 'surfaceFailed':
        return evidence.surfaceMounted() ? event : undefined;
      case 'textureReady':
        return event;
      case 'framePresented': {
        if (!evidence.simulation() || generation !== evidence.surfaceGeneration()) return undefined;
        const phase = evidence.phase();
        return phase === 'tracking' || phase === 'settling' || phase === 'rollback' ? event : undefined;
      }
      case 'commitEndpoint':
        return evidence.active() && generation === this.generation && generation === evidence.surfaceGeneration() &&
          !evidence.automaticStartPending() ? event : undefined;
      case 'rollbackComplete':
        return evidence.active() && generation === evidence.surfaceGeneration() ? event : undefined;
      case 'slotsCommitted':
        return evidence.awaitingSlots() && generation === this.generation ? event : undefined;
      case 'terminalReleased':
        return evidence.active() && generation === this.generation && generation === evidence.surfaceGeneration() ? event : undefined;
    }
  }

  confirmFrame(generation: number, evidence: ReaderPageTurnFrameEvidence): boolean {
    return evidence.active && generation === this.generation && generation === evidence.surfaceGeneration &&
      !evidence.awaitingSlots && evidence.readyRevision === evidence.expectedRevision &&
      evidence.scheduledRevision === evidence.expectedRevision &&
      (evidence.phase === 'logicalPromoted' || evidence.phase === 'rollback');
  }

  canScheduleFrame(generation: number, evidence: ReaderPageTurnFrameEvidence): boolean {
    return evidence.active && evidence.simulation && generation === this.generation && generation === evidence.surfaceGeneration;
  }

  canRegrab(active: boolean, direction: ReaderPageTurnDirection | undefined): boolean {
    return active && !this.settlement.commitStarted && !this.animationFinished && direction !== undefined;
  }

  canStagePrepared(fresh: boolean, width: number): boolean {
    return fresh && this.settlement.prepared === undefined && !(width <= 0);
  }

  gesturePresentationPhase(phase: ReaderPageGesturePhase, rollback: boolean, settlementActive: boolean):
    ReaderPageTurnPresentationPhase | undefined {
    if (phase === 'tracking' || phase === 'dragging') return 'tracking';
    if (phase === 'settling') return rollback ? 'rollback' : 'settling';
    return settlementActive ? undefined : 'idle';
  }

  gestureAction(state: ReaderPageGestureState, renderer: ReaderPageTurnGestureRenderer): ReaderPageTurnGestureAction {
    // The vertical bookmark owner may be settling, but its rebound must
    // never enter either of the horizontal page renderers.
    if (state.owner === 'bookmark') return 'bookmark';
    if (renderer.simulation()) return 'simulation';
    if (!renderer.slide()) return 'direct';
    if (state.phase === 'dragging' && state.direction !== undefined) return 'slideDrag';
    if (state.phase === 'settling' && state.settleTarget === 'rollback') return 'rollback';
    return state.phase === 'tracking' || state.phase === 'idle' ? 'reset' : 'hold';
  }

  phase(settlementActive: boolean, gesture: ReaderPageGesturePhase): ReaderPageGesturePhase {
    return settlementActive || this.settlement.prepared !== undefined ? 'settling' : gesture;
  }

  neighbour(direction: ReaderPageTurnDirection): TPrepared | undefined {
    return direction === 'previous' ? this.previous : this.next;
  }

  setNeighbour(direction: ReaderPageTurnDirection, candidate: TPrepared): void {
    if (direction === 'previous') this.previous = candidate;
    else this.next = candidate;
  }

  clearNeighbours(): void {
    this.previous = undefined;
    this.next = undefined;
  }

  clearUnprotectedNeighbours(held: TPrepared | undefined): void {
    const settling = this.settlement.prepared;
    if (this.previous !== settling && this.previous !== held) this.previous = undefined;
    if (this.next !== settling && this.next !== held) this.next = undefined;
  }

  admitPrepared(candidate: TPrepared): void { this.admitted = candidate; }
  admittedPrepared(): TPrepared | undefined { return this.admitted; }

  freeze(read: () => ReaderFrozenPageTurnProjection<TLayout, TPage>): void {
    this.projection = undefined;
    this.projection = read();
  }

  clearProjection(): void {
    this.projection = undefined;
    this.admitted = undefined;
  }

  frozen(revision: number): ReaderFrozenPageTurnProjection<TLayout, TPage> | undefined {
    return this.projection?.revision === revision ? this.projection : undefined;
  }

  freshPrepared(identity: TPrepared, owner: ReaderPreparedNeighbourOwner): boolean {
    const known = owner.contentVersion(identity.key.chapterIndex);
    return owner.mounted() && identity.generation === owner.generation() &&
      identity.originChapterIndex === owner.visibleChapter() && identity.originPageStartScalar === owner.visiblePageStart() &&
      identity.key.sourceId === owner.sourceId() && identity.key.bookId === owner.bookId() &&
      identity.key.layoutSignature === owner.layoutSignature() && identity.key.contentVersion === identity.context.contentVersion &&
      (known === undefined || known === identity.key.contentVersion);
  }

  preparedPageTurn(direction: ReaderPageTurnDirection, pointerHeld: boolean, owner: ReaderPreparedNeighbourOwner): TPrepared | undefined {
    const candidate = this.neighbour(direction);
    if (candidate === undefined) return undefined;
    if (pointerHeld && this.canUseHeldPrepared(candidate, owner)) return candidate;
    return this.freshPrepared(candidate, owner) ? candidate : undefined;
  }

  private canUseHeldPrepared(candidate: TPrepared, owner: ReaderPreparedNeighbourOwner): boolean {
    return candidate === this.admitted && candidate.generation === owner.generation() &&
      candidate.originPageStartScalar === owner.visiblePageStart() && candidate.originChapterIndex === owner.visibleChapter() &&
      candidate.key.contentVersion === owner.contentVersion(candidate.key.chapterIndex);
  }

  recordVisualEndpoint(generation: number, lifecycle: number): void {
    if (generation !== this.generation) return;
    this.animationFinished = true;
    const destination = this.settlement.prepared;
    if (destination !== undefined && !this.settlement.commitStarted) this.settlement.begin(destination, lifecycle, generation);
  }

  finishSlide(generation: number, lifecycle: number): 'rollback' | 'persisting' | 'wait' {
    if (generation !== this.generation) return 'wait';
    this.animationFinished = true;
    const destination = this.settlement.prepared;
    if (destination === undefined) return 'rollback';
    this.settlement.begin(destination, lifecycle, generation);
    return 'persisting';
  }

  beginPersistence(candidate: TPrepared, lifecycle: number, generation: number): void {
    if (generation === this.generation) this.settlement.begin(candidate, lifecycle, generation);
  }

  joinPersistence(generation: number, presented: boolean,
    fresh: (candidate: TPrepared) => boolean): ReaderPreparedPageJoin<TPrepared> {
    if (generation !== this.generation) return { action: 'wait' };
    return this.settlement.join(this.animationFinished, presented, fresh);
  }

  hasSlide(): boolean { return this.slide !== undefined; }
  slidePosition(nowMs: number): number | undefined { return this.slide?.position(nowMs); }
  cancelSlide(): void {
    this.slide = undefined;
    const cancel = this.slideCancel;
    this.slideCancel = undefined;
    cancel?.();
  }

  startSlide(target: number, generation: number, origin: ReaderPageTurnSlideOrigin, host: ReaderPageTurnSlideHost): void {
    this.cancelSlide();
    const slide = new ReaderPageSettlementTimeline(origin.offset, target, origin.width, origin.velocity, host.now(),
      Math.abs(this.rapid.pendingDelta) > 1 && origin.gestureUndecided);
    this.slide = slide;
    if (slide.durationMs <= 0) {
      host.publishOffset(target);
      this.slide = undefined;
      host.finished(generation);
      return;
    }
    if (host.animateOffset !== undefined) {
      const cancel = host.animateOffset(target, slide.durationMs, (): void => {
        if (this.slide !== slide || !host.mounted() || generation !== host.generation()) return;
        this.slide = undefined;
        this.slideCancel = undefined;
        host.finished(generation);
      });
      if (cancel !== undefined) {
        this.slideCancel = cancel;
        return;
      }
    }
    this.advanceSlide(generation, host);
  }

  private advanceSlide(generation: number, host: ReaderPageTurnSlideHost): void {
    const slide = this.slide;
    if (!host.mounted() || slide === undefined || generation !== host.generation()) return;
    const now = host.now();
    host.publishOffset(slide.position(now));
    if (slide.finished(now)) {
      this.slide = undefined;
      host.finished(generation);
      return;
    }
    host.postFrame((): void => {
      if (this.slide === slide) this.advanceSlide(generation, host);
    });
  }
}
