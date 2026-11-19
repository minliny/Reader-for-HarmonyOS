import { ReaderUIVerificationProbe } from '../../../app/diagnostics/ReaderUIVerificationProbe';
import type { ReaderControlRuntimeRebase } from './ReaderControlRuntime';
import { readerControlTargetLocation, type ReaderControlSessionState } from './ReaderControlSessionState';

export type ReaderControlVerificationDirection = 'open' | 'dismiss';
export type ReaderControlVerificationOrigin = 'paged-tap' | 'continuous-tap' | 'system-back';

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

/** Read-only observation of the host's normal page and control owners. */
export class ReaderControlVerificationSession {
  private readingId: string = '';
  private lastReadyMode: string = '';
  private request: ReaderControlVerificationRequest | undefined = undefined;
  private committed: boolean = false;
  private sawVisualProgress: boolean = false;

  start(): void {
    if (!ReaderUIVerificationProbe.enabled()) return;
    this.readingId = ReaderUIVerificationProbe.nextIdentity('reading');
    this.lastReadyMode = '';
    this.request = undefined;
    this.committed = false;
    this.sawVisualProgress = false;
  }

  ready(mode: 'paged' | 'continuous', state: ReaderControlSessionState, openRevision: number,
    localBook: boolean, reduceMotion: boolean): void {
    if (this.readingId.length === 0 || this.lastReadyMode === mode || !ReaderUIVerificationProbe.enabled()) return;
    this.lastReadyMode = mode;
    ReaderUIVerificationProbe.emit('reading.ready', 'business', {
      readingId: this.readingId,
      mode: mode,
      interactionHostId: mode === 'paged' ? 'reader-reading-interaction-host-paged' :
        'reader-reading-interaction-host-continuous',
      localBook: localBook,
      reduceMotion: reduceMotion,
      state: stateFact(state, openRevision),
    });
  }

  accept(origin: ReaderControlVerificationOrigin, previous: ReaderControlSessionState,
    next: ReaderControlSessionState, nextOpenRevision: number): void {
    if (this.readingId.length === 0 || !ReaderUIVerificationProbe.enabled()) return;
    const direction: ReaderControlVerificationDirection = origin === 'system-back' ? 'dismiss' : 'open';
    const before = stateFact(previous, direction === 'open' ? nextOpenRevision - 1 : nextOpenRevision);
    const accepted = stateFact(next, nextOpenRevision);
    const expectedSource = direction === 'open' ? 'hidden' : 'home';
    const expectedTarget = direction === 'open' ? 'home' : 'hidden';
    if (accepted.epoch <= before.epoch || before.level !== expectedSource || before.transition !== '' ||
      before.heldPointerId >= 0 || accepted.targetLevel !== expectedTarget) return;
    this.committed = false;
    this.sawVisualProgress = false;
    const request: ReaderControlVerificationRequest = {
      readingId: this.readingId,
      transitionId: ReaderUIVerificationProbe.nextIdentity(direction),
      direction: direction,
      origin: origin,
      before: before,
      accepted: accepted,
      durationMs: next.transition?.durationMs ?? 0,
    };
    this.request = request;
    ReaderUIVerificationProbe.emit('reading.control-requested', 'business', request);
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
    if (request === undefined || this.sawVisualProgress || state.transition === undefined ||
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
    ReaderUIVerificationProbe.emit('reading.control-committed', 'business', {
      readingId: request.readingId,
      transitionId: request.transitionId,
      direction: request.direction,
      state: stateFact(state, openRevision),
    });
  }

  stop(): void {
    this.readingId = '';
    this.lastReadyMode = '';
    this.request = undefined;
  }
}
