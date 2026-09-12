export type ReaderTtsSessionStatus =
  'uninitialized' | 'probing' | 'unavailable' | 'idle' | 'preparing' | 'playing' | 'paused' | 'resuming' |
  'interrupted' | 'stopping' | 'completed' | 'error' | 'failed';

export const READER_TTS_RATE_MIN = 0.5;
export const READER_TTS_RATE_MAX = 2;
/** Product speed precision: integer percentages 50..200 in five-point steps. */
export const READER_TTS_RATE_STEP = 0.05;
export const READER_TTS_RATE_STEP_SCALE = 1 / READER_TTS_RATE_STEP;
export const READER_TTS_TIMER_MIN = 0;
/** Product timer range for an explicit duration (the UI uses five-minute steps). */
export const READER_TTS_TIMER_MAX_MINUTES = 180;
export const READER_TTS_TIMER_MAX_SECONDS = 59;
export const READER_TTS_TIMER_DEFAULT_MINUTES = 25;

/** A timer is either disabled, an absolute duration, or a one-shot chapter boundary. */
export type ReaderTtsTimerMode = 'off' | 'duration' | 'chapterEnd';

export type ReaderTtsPauseReason = 'user' | 'systemInterruption' | 'routeBackground' | 'deviceChange';

export type ReaderTtsStopReason =
  'user' | 'timer' | 'completed' | 'lifecycle' | 'contentChanged' | 'screenOff' |
  'systemInterruption' | 'engineUnavailable' | 'failureLimit' |
  'startFailed' | 'startTimeout' | 'utteranceFailed';

export type ReaderTtsContentVersion = number | string;

export type ReaderTtsState = {
  status: ReaderTtsSessionStatus;
  sessionGeneration: number;
  utteranceGeneration: number;
  contentVersion: ReaderTtsContentVersion;
  chapterKey?: string;
  chapterIndex?: number;
  sliceIndex?: number;
  totalSlices: number;
  charStart?: number;
  charEnd?: number;
  requestId?: string;
  rate: number;
  consecutiveFailures: number;
  timerDeadlineMs?: number;
  pauseReason?: ReaderTtsPauseReason;
  stopReason?: ReaderTtsStopReason;
  errorMessage?: string;
  /** True only after a real Host onStart callback was applied in this session. */
  audioStarted?: boolean;
};

export type ReaderTtsSessionIdentity = {
  sessionGeneration: number;
  contentVersion: ReaderTtsContentVersion;
  chapterKey: string;
};

export type ReaderTtsUtteranceToken = ReaderTtsSessionIdentity & {
  utteranceGeneration: number;
  requestId: string;
  chapterIndex: number;
  sliceIndex: number;
};

export function createReaderTtsState(available: boolean = false): ReaderTtsState {
  return {
    status: available ? 'idle' : 'uninitialized',
    sessionGeneration: 0,
    utteranceGeneration: 0,
    contentVersion: 0,
    totalSlices: 0,
    rate: 1,
    consecutiveFailures: 0,
  };
}

export function normalizeReaderTtsRate(rate: number): number {
  if (!Number.isFinite(rate)) return READER_TTS_RATE_MIN;
  const clamped = Math.max(READER_TTS_RATE_MIN, Math.min(READER_TTS_RATE_MAX, rate));
  return Math.round(clamped * READER_TTS_RATE_STEP_SCALE) / READER_TTS_RATE_STEP_SCALE;
}

export function readerTtsRateLabel(rate: number): string {
  return `${normalizeReaderTtsRate(rate).toFixed(2)}x`;
}

export function setReaderTtsAvailability(state: ReaderTtsState, available: boolean): ReaderTtsState {
  if (!available) {
    return {
      ...state,
      status: 'unavailable',
      sessionGeneration: state.sessionGeneration + 1,
      utteranceGeneration: state.utteranceGeneration + 1,
      requestId: undefined,
      stopReason: 'engineUnavailable',
    };
  }
  if (state.status !== 'unavailable' && state.status !== 'uninitialized' && state.status !== 'probing') {
    return state;
  }
  return {
    ...state,
    status: 'idle',
    stopReason: undefined,
    errorMessage: undefined,
  };
}

export function beginReaderTtsSession(
  state: ReaderTtsState,
  chapterKey: string,
  chapterIndex: number,
  contentVersion: ReaderTtsContentVersion,
  rate: number,
): ReaderTtsState {
  assertNonBlank(chapterKey, 'chapterKey');
  assertNonNegativeSafeInteger(chapterIndex, 'chapterIndex');
  assertContentVersion(contentVersion);
  assertSpeechRate(rate);
  return {
    status: 'preparing',
    sessionGeneration: state.sessionGeneration + 1,
    utteranceGeneration: state.utteranceGeneration + 1,
    contentVersion,
    chapterKey,
    chapterIndex,
    totalSlices: 0,
    rate,
    consecutiveFailures: 0,
  };
}

export function prepareReaderTtsUtterance(
  state: ReaderTtsState,
  sliceIndex: number,
  totalSlices: number,
  charStart: number,
  charEnd: number,
  status: 'preparing' | 'resuming' = 'preparing',
): ReaderTtsState {
  if (state.chapterKey === undefined || state.chapterIndex === undefined) {
    throw new Error('Reader TTS cannot prepare an utterance without a chapter identity');
  }
  assertNonNegativeSafeInteger(sliceIndex, 'sliceIndex');
  assertPositiveSafeInteger(totalSlices, 'totalSlices');
  if (sliceIndex >= totalSlices) {
    throw new Error('sliceIndex must be lower than totalSlices');
  }
  assertScalarRange(charStart, charEnd);
  const utteranceGeneration = state.utteranceGeneration + 1;
  const requestId = readerTtsRequestId(
    state.sessionGeneration,
    utteranceGeneration,
    state.chapterIndex,
    sliceIndex,
  );
  return {
    ...state,
    status,
    utteranceGeneration,
    sliceIndex,
    totalSlices,
    charStart,
    charEnd,
    requestId,
    pauseReason: undefined,
    stopReason: undefined,
    errorMessage: undefined,
  };
}

export function advanceReaderTtsChapter(
  state: ReaderTtsState,
  chapterKey: string,
  chapterIndex: number,
  contentVersion: ReaderTtsContentVersion,
): ReaderTtsState {
  assertNonBlank(chapterKey, 'chapterKey');
  assertNonNegativeSafeInteger(chapterIndex, 'chapterIndex');
  assertContentVersion(contentVersion);
  return {
    ...state,
    status: 'preparing',
    utteranceGeneration: state.utteranceGeneration + 1,
    contentVersion,
    chapterKey,
    chapterIndex,
    sliceIndex: undefined,
    totalSlices: 0,
    charStart: undefined,
    charEnd: undefined,
    requestId: undefined,
    consecutiveFailures: 0,
    pauseReason: undefined,
    stopReason: undefined,
    errorMessage: undefined,
  };
}

export function markReaderTtsStarted(
  state: ReaderTtsState,
  token: ReaderTtsUtteranceToken,
): ReaderTtsState {
  if (!isReaderTtsUtteranceCurrent(state, token) ||
    (state.status !== 'preparing' && state.status !== 'resuming')) {
    return state;
  }
  return { ...state, status: 'playing', consecutiveFailures: 0 };
}

export function pauseReaderTtsSession(
  state: ReaderTtsState,
  reason: ReaderTtsPauseReason,
): ReaderTtsState {
  if (state.status !== 'playing' && state.status !== 'preparing' && state.status !== 'resuming' &&
    state.status !== 'interrupted') {
    return state;
  }
  return {
    ...state,
    status: reason === 'user' ? 'paused' : 'interrupted',
    utteranceGeneration: state.utteranceGeneration + 1,
    requestId: undefined,
    pauseReason: reason,
  };
}

export function resumeReaderTtsSession(state: ReaderTtsState): ReaderTtsState {
  if (state.status !== 'paused' && state.status !== 'interrupted') {
    return state;
  }
  return {
    ...state,
    status: 'resuming',
    utteranceGeneration: state.utteranceGeneration + 1,
    requestId: undefined,
    pauseReason: undefined,
  };
}

export function beginStoppingReaderTts(
  state: ReaderTtsState,
  reason: ReaderTtsStopReason,
): ReaderTtsState {
  return {
    ...state,
    status: 'stopping',
    sessionGeneration: state.sessionGeneration + 1,
    utteranceGeneration: state.utteranceGeneration + 1,
    requestId: undefined,
    timerDeadlineMs: undefined,
    stopReason: reason,
  };
}

export function finishStoppingReaderTts(state: ReaderTtsState): ReaderTtsState {
  if (state.status !== 'stopping') {
    return state;
  }
  return {
    ...state,
    status: 'idle',
    chapterKey: undefined,
    chapterIndex: undefined,
    sliceIndex: undefined,
    totalSlices: 0,
    charStart: undefined,
    charEnd: undefined,
    requestId: undefined,
    pauseReason: undefined,
    errorMessage: undefined,
  };
}

export function completeReaderTtsSession(state: ReaderTtsState): ReaderTtsState {
  return {
    ...state,
    status: 'completed',
    utteranceGeneration: state.utteranceGeneration + 1,
    requestId: undefined,
    timerDeadlineMs: undefined,
    stopReason: 'completed',
  };
}

export function failReaderTtsUtterance(
  state: ReaderTtsState,
  token: ReaderTtsUtteranceToken,
  message: string,
): ReaderTtsState {
  if (!isReaderTtsUtteranceCurrent(state, token)) {
    return state;
  }
  return {
    ...state,
    status: 'error',
    utteranceGeneration: state.utteranceGeneration + 1,
    requestId: undefined,
    audioStarted: false,
    consecutiveFailures: state.consecutiveFailures + 1,
    errorMessage: message.length > 0 ? message : 'Harmony system TTS failed',
  };
}

export function setReaderTtsRate(state: ReaderTtsState, rate: number): ReaderTtsState {
  assertSpeechRate(rate);
  if (state.rate === rate) {
    return state;
  }
  return {
    ...state,
    rate,
    utteranceGeneration: state.utteranceGeneration + 1,
    requestId: undefined,
  };
}

export function invalidateReaderTtsUtterance(state: ReaderTtsState): ReaderTtsState {
  if (state.chapterKey === undefined) return state;
  return {
    ...state,
    status: 'preparing',
    utteranceGeneration: state.utteranceGeneration + 1,
    requestId: undefined,
    errorMessage: undefined,
  };
}

export function scheduleReaderTtsTimer(
  state: ReaderTtsState,
  nowMs: number,
  durationMs: number | undefined,
): ReaderTtsState {
  assertNonNegativeSafeInteger(nowMs, 'nowMs');
  if (durationMs === undefined) {
    return { ...state, timerDeadlineMs: undefined };
  }
  assertPositiveSafeInteger(durationMs, 'durationMs');
  const deadline = nowMs + durationMs;
  if (!Number.isSafeInteger(deadline)) {
    throw new Error('Reader TTS timer deadline exceeds the safe integer range');
  }
  return { ...state, timerDeadlineMs: deadline };
}

export function isReaderTtsTimerDue(state: ReaderTtsState, nowMs: number): boolean {
  assertNonNegativeSafeInteger(nowMs, 'nowMs');
  return state.timerDeadlineMs !== undefined && nowMs >= state.timerDeadlineMs;
}

export function invalidateReaderTtsContent(
  state: ReaderTtsState,
  contentVersion: ReaderTtsContentVersion,
): ReaderTtsState {
  assertContentVersion(contentVersion);
  return {
    ...beginStoppingReaderTts(state, 'contentChanged'),
    contentVersion,
  };
}

function assertContentVersion(value: ReaderTtsContentVersion): void {
  if (typeof value === 'string') {
    assertNonBlank(value, 'contentVersion');
    return;
  }
  assertNonNegativeSafeInteger(value, 'contentVersion');
}

export function readerTtsSessionIdentity(state: ReaderTtsState): ReaderTtsSessionIdentity {
  if (state.chapterKey === undefined) {
    throw new Error('Reader TTS state has no active chapter');
  }
  return {
    sessionGeneration: state.sessionGeneration,
    contentVersion: state.contentVersion,
    chapterKey: state.chapterKey,
  };
}

export function readerTtsUtteranceToken(state: ReaderTtsState): ReaderTtsUtteranceToken {
  if (state.chapterKey === undefined || state.chapterIndex === undefined || state.sliceIndex === undefined ||
    state.requestId === undefined) {
    throw new Error('Reader TTS state has no active utterance');
  }
  return {
    sessionGeneration: state.sessionGeneration,
    utteranceGeneration: state.utteranceGeneration,
    contentVersion: state.contentVersion,
    chapterKey: state.chapterKey,
    chapterIndex: state.chapterIndex,
    sliceIndex: state.sliceIndex,
    requestId: state.requestId,
  };
}

export function isReaderTtsSessionCurrent(
  state: ReaderTtsState,
  identity: ReaderTtsSessionIdentity,
): boolean {
  return state.sessionGeneration === identity.sessionGeneration &&
    state.contentVersion === identity.contentVersion &&
    state.chapterKey === identity.chapterKey;
}

export function isReaderTtsUtteranceCurrent(
  state: ReaderTtsState,
  token: ReaderTtsUtteranceToken,
): boolean {
  return isReaderTtsSessionCurrent(state, token) &&
    state.utteranceGeneration === token.utteranceGeneration &&
    state.chapterIndex === token.chapterIndex &&
    state.sliceIndex === token.sliceIndex &&
    state.requestId === token.requestId;
}

function readerTtsRequestId(
  sessionGeneration: number,
  utteranceGeneration: number,
  chapterIndex: number,
  sliceIndex: number,
): string {
  return `tts-s${sessionGeneration}-u${utteranceGeneration}-c${chapterIndex}-i${sliceIndex}`;
}

function assertScalarRange(start: number, end: number): void {
  assertNonNegativeSafeInteger(start, 'charStart');
  assertNonNegativeSafeInteger(end, 'charEnd');
  if (end <= start) {
    throw new Error('charEnd must be greater than charStart');
  }
}

function assertSpeechRate(rate: number): void {
  if (!Number.isFinite(rate) || rate < READER_TTS_RATE_MIN || rate > READER_TTS_RATE_MAX ||
    Math.abs(rate * READER_TTS_RATE_STEP_SCALE - Math.round(rate * READER_TTS_RATE_STEP_SCALE)) > 1e-9) {
    throw new Error('Reader TTS rate must be between 0.5 and 2.0');
  }
}

function assertNonBlank(value: string, key: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${key} must be non-blank`);
  }
}

function assertNonNegativeSafeInteger(value: number, key: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${key} must be a non-negative safe integer`);
  }
}

function assertPositiveSafeInteger(value: number, key: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive safe integer`);
  }
}
