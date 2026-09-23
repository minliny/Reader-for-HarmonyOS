import type { ReaderTtsState, ReaderTtsContentVersion } from './ReaderTtsState';

export type ReaderPageTurnOrigin = 'manual' | 'autoTimer' | 'ttsFollow';

export interface ReaderTtsFollowScope {
  sourceId: string;
  bookId: string;
  lifecycleToken: number;
}

/** A UI navigation lease, independent of the audio transport and cached pages. */
export interface ReaderTtsFollowLease extends ReaderTtsFollowScope {
  generation: number;
  sessionGeneration: number;
  positionGeneration: number;
}

export interface ReaderTtsFollowTarget extends ReaderTtsFollowLease {
  chapterKey: string;
  chapterIndex: number;
  contentVersion: ReaderTtsContentVersion;
  scalar: number;
  utteranceGeneration: number;
  allowBackward: boolean;
}

export function readerTtsFollowActive(state: ReaderTtsState): boolean {
  return state.status === 'playing' || state.status === 'preparing' || state.status === 'resuming';
}

/** Exactly one latest semantic target. This never queues physical next-page steps. */
export class ReaderTtsPageFollow {
  private generation: number = 0;
  private latest: ReaderTtsFollowTarget | undefined = undefined;
  private observed: ReaderTtsFollowTarget | undefined = undefined;
  private suppressed: ReaderTtsFollowTarget | undefined = undefined;
  private failedAttempts: number = 0;

  lease(scope: ReaderTtsFollowScope, state: ReaderTtsState): ReaderTtsFollowLease {
    return { ...scope, generation: this.generation, sessionGeneration: state.sessionGeneration,
      positionGeneration: state.positionGeneration ?? 0 };
  }

  owns(lease: ReaderTtsFollowLease, scope: ReaderTtsFollowScope, state: ReaderTtsState): boolean {
    return lease.generation === this.generation && sameScope(lease, scope) &&
      lease.sessionGeneration === state.sessionGeneration &&
      lease.positionGeneration === (state.positionGeneration ?? 0);
  }

  pending(): ReaderTtsFollowTarget | undefined { return this.latest; }
  canAttempt(): boolean { return this.failedAttempts < 3; }

  failed(owner: ReaderTtsFollowLease): void {
    if (this.latest?.generation === owner.generation &&
      this.latest.sessionGeneration === owner.sessionGeneration &&
      this.latest.positionGeneration === owner.positionGeneration) this.failedAttempts += 1;
  }

  offer(scope: ReaderTtsFollowScope, state: ReaderTtsState): void {
    const positionGeneration = state.positionGeneration ?? 0;
    const prior = this.observed;
    const sameSession = prior !== undefined && sameScope(prior, scope) &&
      prior.sessionGeneration === state.sessionGeneration;
    if (prior !== undefined && sameScope(prior, scope) && state.sessionGeneration < prior.sessionGeneration) return;
    if (prior !== undefined && sameSession && (positionGeneration < prior.positionGeneration ||
      state.utteranceGeneration < prior.utteranceGeneration)) return;
    if (this.latest !== undefined && !this.owns(this.latest, scope, state)) this.latest = undefined;
    if (!readerTtsFollowActive(state)) { this.latest = undefined; return; }
    if (state.charStart === undefined || state.chapterIndex === undefined ||
      !Number.isSafeInteger(state.charStart) || state.charStart < 0) return;
    const newPosition = !sameSession || (prior !== undefined && positionGeneration > prior.positionGeneration);
    const chapterKey = state.chapterKey ?? `${state.chapterIndex}`;
    if (!newPosition && prior !== undefined && prior.chapterKey === chapterKey && state.charStart < prior.scalar) return;
    const suppressed = this.suppressed;
    if (suppressed !== undefined && sameScope(suppressed, scope) &&
      suppressed.sessionGeneration === state.sessionGeneration &&
      suppressed.positionGeneration === positionGeneration &&
      state.utteranceGeneration <= suppressed.utteranceGeneration) return;
    const target: ReaderTtsFollowTarget = { ...this.lease(scope, state), chapterKey,
      chapterIndex: state.chapterIndex, contentVersion: state.contentVersion,
      scalar: state.charStart, utteranceGeneration: state.utteranceGeneration,
      allowBackward: newPosition || (prior?.allowBackward === true && prior.generation === this.generation) };
    if (prior === undefined || newPosition || prior.scalar !== target.scalar ||
      prior.chapterKey !== target.chapterKey || prior.utteranceGeneration !== target.utteranceGeneration) this.failedAttempts = 0;
    this.observed = target;
    this.latest = target;
  }

  /** Called only when the admitted visible page really contains this target. */
  aligned(target: ReaderTtsFollowTarget): void {
    if (this.latest !== target) return;
    this.latest = undefined;
    this.observed = { ...target, allowBackward: false };
    this.failedAttempts = 0;
  }

  /** Manual navigation/reflow rejects repeats of the current utterance, not future speech. */
  invalidate(scope: ReaderTtsFollowScope, state: ReaderTtsState): void {
    this.generation += 1;
    this.latest = undefined;
    this.failedAttempts = 0;
    this.suppressed = { ...this.lease(scope, state), chapterKey: state.chapterKey ?? '',
      chapterIndex: state.chapterIndex ?? -1, contentVersion: state.contentVersion,
      scalar: state.charStart ?? -1, utteranceGeneration: state.utteranceGeneration,
      allowBackward: false };
    if (this.observed !== undefined) this.observed = { ...this.observed, allowBackward: false };
  }
}

function sameScope(left: ReaderTtsFollowScope, right: ReaderTtsFollowScope): boolean {
  return left.sourceId === right.sourceId && left.bookId === right.bookId &&
    left.lifecycleToken === right.lifecycleToken;
}
