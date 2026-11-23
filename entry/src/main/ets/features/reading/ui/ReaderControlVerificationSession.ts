import { ReaderUIVerificationProbe } from '../../../app/diagnostics/ReaderUIVerificationProbe';
import type { ReaderControlRuntimeRebase, ReaderControlVerificationCancelMotion,
  ReaderControlVerificationReleaseMotion } from './ReaderControlRuntime';
import { copyReaderControlLocation, readerControlContentLocation, readerControlTargetLocation,
  type ReaderControlLocation, type ReaderControlSessionState, type ReaderControlTransitionIntent,
  type ReaderControlTransitionKind, type ReaderControlTransitionSnapshot } from './ReaderControlSessionState';

export type ReaderControlVerificationDirection = ReaderControlTransitionKind;
export type ReaderControlVerificationOrigin = 'paged-tap' | 'continuous-tap' | 'system-back' |
  'module-button' | 'module-back' | 'directory-tab' | 'header-collapse' | 'replace-expand' |
  'grabber-down' | 'grabber-move' | 'grabber-release' | 'grabber-cancel' | 'grabber-accessibility' |
  'backdrop' | 'host-dismiss' | 'runtime-resume';

export interface ReaderControlVerificationState {
  epoch: number;
  openRevision: number;
  closeRevision: number;
  level: string;
  targetLevel: string;
  transition: string;
  heldPointerId: number;
}

export interface ReaderControlVerificationRequest {
  readingId: string;
  transitionId: string;
  direction: ReaderControlVerificationDirection;
  origin: ReaderControlVerificationOrigin;
  before: ReaderControlVerificationState;
  accepted: ReaderControlVerificationState;
  durationMs: number;
  source: ReaderControlLocation;
  target: ReaderControlLocation;
  intent: ReaderControlTransitionIntent;
  legacy: boolean;
  transition?: ReaderControlTransitionSnapshot;
  releaseMotion?: ReaderControlVerificationReleaseMotion;
  cancelMotion?: ReaderControlVerificationCancelMotion;
}

function stateFact(state: ReaderControlSessionState, openRevision: number): ReaderControlVerificationState {
  return {
    epoch: state.epoch,
    openRevision: openRevision,
    closeRevision: state.closeRevision,
    level: state.location.level,
    targetLevel: readerControlTargetLocation(state).level,
    transition: state.transition?.kind ?? '',
    heldPointerId: state.heldPointerId,
  };
}

function sameLocation(before: ReaderControlLocation, after: ReaderControlLocation): boolean {
  return before.level === after.level && before.form === after.form && before.module === after.module &&
    before.directoryTab === after.directoryTab;
}

function directDirection(source: ReaderControlLocation, target: ReaderControlLocation): ReaderControlVerificationDirection {
  if (target.level === 'hidden') return 'dismiss';
  if (source.level === 'hidden') return 'open';
  if (source.level === target.level && source.module === target.module && source.form !== target.form) return 'morph';
  return 'navigate';
}

/** Read-only observation of the host's normal page and control owners. */
export class ReaderControlVerificationSession {
  private readingId: string = '';
  private lastReadyMode: string = '';
  private request: ReaderControlVerificationRequest | undefined = undefined;
  private lastActiveLayer: { epoch: number; location: ReaderControlLocation } | undefined = undefined;
  private committed: boolean = false;
  private sawVisualProgress: boolean = false;

  start(): void {
    if (!ReaderUIVerificationProbe.enabled()) return;
    this.readingId = ReaderUIVerificationProbe.nextIdentity('reading');
    this.lastReadyMode = '';
    this.request = undefined;
    this.lastActiveLayer = undefined;
    this.committed = false;
    this.sawVisualProgress = false;
  }

  ready(mode: 'paged' | 'continuous', state: ReaderControlSessionState, openRevision: number,
    localBook: boolean, reduceMotion: boolean, chapterIndex: number = -1): void {
    if (this.readingId.length === 0 || this.lastReadyMode === mode || !ReaderUIVerificationProbe.enabled()) return;
    this.lastReadyMode = mode;
    ReaderUIVerificationProbe.emit('reading.ready', 'business', {
      readingId: this.readingId,
      mode: mode,
      interactionHostId: mode === 'paged' ? 'reader-reading-interaction-host-paged' :
        'reader-reading-interaction-host-continuous',
      localBook: localBook,
      reduceMotion: reduceMotion,
      chapterIndex: localBook && chapterIndex >= 0 ? chapterIndex : undefined,
      state: stateFact(state, openRevision),
    });
  }

  accept(origin: ReaderControlVerificationOrigin, previous: ReaderControlSessionState,
    next: ReaderControlSessionState, nextOpenRevision: number,
    releaseMotion?: ReaderControlVerificationReleaseMotion, cancelMotion?: ReaderControlVerificationCancelMotion): void {
    if (this.readingId.length === 0 || !ReaderUIVerificationProbe.enabled()) return;
    const source = readerControlContentLocation(previous);
    const target = readerControlTargetLocation(next);
    // Pointer tracking and layout rebases update progress inside one accepted
    // transition epoch. They are observations of that request, not new
    // requests. A crossover starts another segment and increments the epoch.
    if (next.epoch === previous.epoch && next.transition !== undefined) return;
    if (next.epoch === previous.epoch && sameLocation(source, target)) return;

    // A touch may pause a running operation without creating a new one.
    // The old epoch is retired even if a later UP restores its logical goal.
    this.interrupt(previous, next, origin);
    const transition = next.transition;
    if (transition === undefined && sameLocation(source, target)) return;
    if (origin === 'grabber-down') return;

    const direction = transition?.kind ?? directDirection(source, target);
    const before = stateFact(previous, direction === 'open' && source.level === 'hidden' ?
      nextOpenRevision - 1 : nextOpenRevision);
    const accepted = stateFact(next, nextOpenRevision);
    const legacy = before.transition === '' && before.heldPointerId < 0 &&
      ((direction === 'open' && source.level === 'hidden' && target.level === 'home' &&
        (origin === 'paged-tap' || origin === 'continuous-tap')) ||
        (direction === 'dismiss' && source.level === 'home' && target.level === 'hidden' && origin === 'system-back'));
    this.committed = false;
    this.sawVisualProgress = false;

    const request: ReaderControlVerificationRequest = {
      readingId: this.readingId,
      transitionId: ReaderUIVerificationProbe.nextIdentity(direction),
      direction: direction,
      origin: origin,
      before: before,
      accepted: accepted,
      durationMs: transition?.durationMs ?? 0,
      source: copyReaderControlLocation(source),
      target: copyReaderControlLocation(target),
      intent: transition?.intent ?? (direction === 'dismiss' ? 'dismiss' :
        target.level === 'home' || target.form === 'quick' && source.form === 'full' ? 'back' : 'forward'),
      legacy: legacy,
      transition: transition,
      releaseMotion: releaseMotion,
      cancelMotion: origin === 'grabber-cancel' ? cancelMotion : undefined,
    };
    this.request = request;
    if (legacy) ReaderUIVerificationProbe.emit('reading.control-requested', 'business', request);
    ReaderUIVerificationProbe.emit('reading.control-transition-requested', 'business', request);
  }

  private interrupt(previous: ReaderControlSessionState, next: ReaderControlSessionState,
    origin: ReaderControlVerificationOrigin): void {
    const request = this.current(previous);
    if (request === undefined || this.committed || request.accepted.epoch === next.epoch) return;
    this.request = undefined;
    ReaderUIVerificationProbe.emit('reading.control-transition-interrupted', 'business', {
      readingId: request.readingId,
      transitionId: request.transitionId,
      origin: origin,
      epoch: previous.epoch,
      successorEpoch: next.epoch,
      successorTarget: readerControlTargetLocation(next),
      heldPointerId: next.heldPointerId,
    });
  }

  observationIdentity(): string { return this.readingId; }

  observing(): boolean {
    return this.readingId.length > 0 && ReaderUIVerificationProbe.enabled();
  }

  effect(kind: string, phase: string, facts: Object, channel: 'business' | 'motion' = 'business'): void {
    if (this.readingId.length === 0 || !ReaderUIVerificationProbe.enabled()) return;
    ReaderUIVerificationProbe.emit('reading.control-effect', channel, {
      readingId: this.readingId, kind: kind, phase: phase, facts: facts,
    });
  }

  layer(origin: string, active: boolean, generation: number, state: ReaderControlSessionState,
    inputKind: string = 'modal'): void {
    if (this.readingId.length === 0 || !ReaderUIVerificationProbe.enabled()) return;
    const location = readerControlContentLocation(state);
    if (active) this.lastActiveLayer = { epoch: state.epoch, location: copyReaderControlLocation(location) };
    ReaderUIVerificationProbe.emit('reading.control-layer', 'business', {
      readingId: this.readingId, origin: origin, active: active, generation: generation, inputKind: inputKind,
      epoch: state.epoch, location: location,
    });
  }

  backConsumer(consumer: string, state: ReaderControlSessionState): void {
    if (this.readingId.length === 0 || !ReaderUIVerificationProbe.enabled()) return;
    ReaderUIVerificationProbe.emit('reading.control-back-consumer', 'business', {
      readingId: this.readingId, consumer: consumer, epoch: state.epoch, location: readerControlContentLocation(state),
    });
  }

  backConsumerForLatestLayer(consumer: string): void {
    const layer = this.lastActiveLayer;
    if (this.readingId.length === 0 || !ReaderUIVerificationProbe.enabled() || layer === undefined) return;
    ReaderUIVerificationProbe.emit('reading.control-back-consumer', 'business', {
      readingId: this.readingId, consumer: consumer, epoch: layer.epoch, location: layer.location,
    });
  }

  current(state: ReaderControlSessionState): ReaderControlVerificationRequest | undefined {
    const request = this.request;
    if (!ReaderUIVerificationProbe.enabled() || request?.accepted.epoch !== state.epoch) return undefined;
    return request;
  }

  observeLayoutRebase(state: ReaderControlSessionState, rebase: ReaderControlRuntimeRebase): void {
    const request = this.current(state);
    if (request === undefined || this.committed || request.direction !== state.transition?.kind ||
      rebase.epoch !== state.epoch) return;
    ReaderUIVerificationProbe.emit('reading.control-rebased', 'motion', {
      readingId: request.readingId,
      transitionId: request.transitionId,
      direction: request.direction,
      source: 'ReaderControlRuntime.configure',
      epoch: rebase.epoch,
      fromTicket: rebase.fromTicket,
      toTicket: rebase.toTicket,
      beforeTickMs: rebase.beforeTickMs,
      ticketStartTickMs: rebase.ticketStartTickMs,
      rebaseReason: rebase.rebaseReason,
      anchorPreserved: rebase.anchorPreserved,
      before: rebase.before,
      after: rebase.after,
    });
  }

  observeVisual(state: ReaderControlSessionState, visibilityProgress: number): void {
    const request = this.current(state);
    if (request === undefined || !request.legacy || this.sawVisualProgress || state.transition === undefined ||
      visibilityProgress <= 0 || visibilityProgress >= 1) return;
    this.sawVisualProgress = true;
    ReaderUIVerificationProbe.emit('reading.control-visual', 'motion', {
      readingId: request.readingId,
      transitionId: request.transitionId,
      direction: request.direction,
      epoch: state.epoch,
      visibilityProgress: visibilityProgress,
      source: 'runtime-progress',
    });
  }

  observeHostState(state: ReaderControlSessionState, openRevision: number): void {
    const request = this.current(state);
    if (request === undefined || this.committed || state.transition !== undefined || state.heldPointerId >= 0) return;
    if (request.direction === 'dismiss' && state.closeRevision <= request.before.closeRevision) return;
    this.committed = true;
    const payload = {
      readingId: request.readingId,
      transitionId: request.transitionId,
      direction: request.direction,
      origin: request.origin,
      target: readerControlTargetLocation(state),
      state: stateFact(state, openRevision),
    };
    if (request.legacy) ReaderUIVerificationProbe.emit('reading.control-committed', 'business', payload);
    ReaderUIVerificationProbe.emit('reading.control-transition-committed', 'business', payload);
  }

  stop(): void {
    this.readingId = '';
    this.lastReadyMode = '';
    this.request = undefined;
    this.lastActiveLayer = undefined;
  }
}
