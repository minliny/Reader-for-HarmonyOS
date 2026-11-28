import { diagnosticCodeOf } from '../../../app/LogPrivacy.ts';
import type { ReaderTtsHostPlaybackState } from './ReaderTtsHostContract.ts';
import { type ReaderTtsState } from './ReaderTtsState.ts';
import {
  type ReaderTtsCallbackResult,
  type ReaderTtsQueueSnapshot,
  type ReaderTtsSlicePlan,
} from './ReaderTtsGateway.ts';
import {
  MAX_RETAINED_COMPLETED_UTTERANCES,
  type CorrelatedUtterance,
  type ReaderTtsAuditionCode,
  type ReaderTtsAuditionInput,
  type ReaderTtsAuditionPhase,
  type ReaderTtsAuditionSession,
  type ReaderTtsAuditionState,
  type ReaderTtsCoordinatorGateway,
  type ReaderTtsStartInput,
} from './ReaderTtsSessionTypes.ts';

let READER_TTS_COORDINATOR_SEQ = 0;
let READER_TTS_AUDITION_OPERATION_SEQ = 0;

export function nextTtsCoordinatorOwnerToken(): string {
  return `tts-coordinator-${++READER_TTS_COORDINATOR_SEQ}`;
}

export function nextTtsAuditionOperationId(): number {
  return ++READER_TTS_AUDITION_OPERATION_SEQ;
}

export function nextTtsGeneration(generation: number): number {
  return generation >= Number.MAX_SAFE_INTEGER ? 1 : generation + 1;
}

export function firstTtsSliceIndex(plan: ReaderTtsSlicePlan, scalarPosition: number): number {
  for (const slice of plan.slices) {
    if (scalarPosition >= slice.charStart && scalarPosition < slice.charEnd) return slice.index;
    if (scalarPosition < slice.charStart) return slice.index;
  }
  return plan.slices[plan.slices.length - 1].index;
}

export function isValidTtsAuditionInput(input: ReaderTtsAuditionInput): boolean {
  return input.language.trim().length > 0 && Number.isSafeInteger(input.person) && input.person >= 0 &&
    (input.rate === undefined || (Number.isFinite(input.rate) && input.rate >= 0.5 && input.rate <= 2)) &&
    (input.pitch === undefined || (Number.isFinite(input.pitch) && input.pitch >= 0.5 && input.pitch <= 2));
}

export function assertTtsStartInput(input: ReaderTtsStartInput): void {
  if (input.chapter.sourceId.trim().length === 0 || input.chapter.bookId.trim().length === 0 ||
    !Number.isSafeInteger(input.chapter.chapterIndex) || input.chapter.chapterIndex < 0) {
    throw new Error('Reader TTS start requires a valid chapter identity');
  }
  if (input.content.trim().length === 0) throw new Error('Reader TTS start requires non-empty content');
  const contentVersionValid = typeof input.contentVersion === 'string' ?
    input.contentVersion.trim().length > 0 : Number.isSafeInteger(input.contentVersion) && input.contentVersion >= 0;
  if (!contentVersionValid || !Number.isSafeInteger(input.scalarPosition) || input.scalarPosition < 0) {
    throw new Error('Reader TTS start requires safe content version and scalar position');
  }
  if (input.language !== undefined && input.language.trim().length === 0) {
    throw new Error('Reader TTS start requires a non-blank language');
  }
  if (input.person !== undefined && (!Number.isSafeInteger(input.person) || input.person < 0)) {
    throw new Error('Reader TTS start requires a non-negative voice person');
  }
}

export function traceTtsAudition(session: ReaderTtsAuditionSession, phase: ReaderTtsAuditionPhase): void {
  try {
    session.trace?.(session.operationId, phase);
  } catch (_) {
    // A diagnostic callback cannot veto audio or cleanup.
  }
}

export function reportTtsAudition(
  session: ReaderTtsAuditionSession,
  state: ReaderTtsAuditionState,
  code?: ReaderTtsAuditionCode,
): void {
  try {
    session.observe?.({ schemaVersion: 1, operationId: session.operationId, state, code });
  } catch (_) {
    // The optional diagnostic sink has no authority over native playback or its promise.
  }
}

export function logTtsCoordinatorEvent(stage: string, detail: string): void {
  console.error(`[ReaderTTS] stage=${stage} code=${diagnosticCodeOf(detail)}`);
}

export function reportCorrelatedTtsCallback(
  gateway: ReaderTtsCoordinatorGateway,
  correlated: CorrelatedUtterance,
  requestId: string,
  phase: 'start' | 'done' | 'error',
  status: 'speaking' | 'done' | 'failed',
): Promise<ReaderTtsCallbackResult> {
  return gateway.reportCallback(
    correlated.chapter,
    correlated.sliceIndex,
    status,
    `${requestId}:${phase}`,
    correlated.failurePolicy,
    3,
  );
}

export function resolveTtsSnapshotStatus(
  snapshot: ReaderTtsQueueSnapshot,
  startConfirmed: boolean,
  pauseReason?: 'user' | 'systemInterruption' | 'routeBackground' | 'deviceChange',
  errorMessage?: string,
): ReaderTtsState['status'] {
  if (snapshot.state === 'playing') return startConfirmed ? 'playing' : 'preparing';
  if (snapshot.state === 'paused' && pauseReason !== undefined && pauseReason !== 'user') return 'interrupted';
  if (snapshot.state === 'paused') return 'paused';
  if (snapshot.state === 'completed') return 'completed';
  return snapshot.state === 'stopped' && errorMessage !== undefined ? 'error' : 'idle';
}

export function resolveTtsPublishedPlaybackState(
  snapshot: ReaderTtsQueueSnapshot,
  status: ReaderTtsState['status'],
  errorMessage?: string,
): ReaderTtsHostPlaybackState {
  if (snapshot.state === 'playing') return status === 'playing' ? 'playing' : 'preparing';
  if (snapshot.state === 'paused') return 'paused';
  if (snapshot.state === 'completed') return 'completed';
  return snapshot.state === 'stopped' && errorMessage !== undefined ? 'error' : 'stopped';
}

export class TtsUtteranceCorrelationWindow {
  private readonly utterances: Map<string, CorrelatedUtterance> = new Map();
  private readonly retainedOrder: string[] = [];
  private readonly retainedIds: Set<string> = new Set();

  get(requestId: string): CorrelatedUtterance | undefined {
    return this.utterances.get(requestId);
  }

  set(requestId: string, correlated: CorrelatedUtterance): void {
    this.utterances.set(requestId, correlated);
  }

  clear(): void {
    this.utterances.clear();
    this.retainedIds.clear();
    this.retainedOrder.splice(0, this.retainedOrder.length);
  }

  retain(requestId: string): void {
    if (!this.utterances.has(requestId)) return;
    if (this.retainedIds.has(requestId)) return;
    this.retainedIds.add(requestId);
    this.retainedOrder.push(requestId);
    while (this.retainedOrder.length > MAX_RETAINED_COMPLETED_UTTERANCES) {
      const evicted = this.retainedOrder.shift();
      if (evicted === undefined) return;
      this.retainedIds.delete(evicted);
      this.utterances.delete(evicted);
    }
  }

  remove(requestId: string): void {
    this.utterances.delete(requestId);
    if (!this.retainedIds.delete(requestId)) return;
    const index = this.retainedOrder.indexOf(requestId);
    if (index >= 0) this.retainedOrder.splice(index, 1);
  }
}
