import {
  type ReaderTtsContentVersion,
  type ReaderTtsSessionIdentity,
} from './ReaderTtsState.ts';
import {
  type ReaderTtsChapterRef,
  type ReaderTtsChapterTransition,
  type ReaderTtsCallbackResult,
  type ReaderTtsConfig,
  type ReaderTtsQueueSnapshot,
  type ReaderTtsSlicePlan,
} from './ReaderTtsGateway.ts';

export const TTS_RATE_MIN = 0.5;
export const TTS_RATE_MAX = 2;
export const DEFAULT_START_CALLBACK_TIMEOUT_MS = 15000;
// Host engines may deliver a duplicate completion after the coordinator has
// already advanced the Core queue.  Keep a small, bounded correlation window
// for those late callbacks; retaining every completed slice would make a
// long-running book a process-lifetime memory leak.
export const MAX_RETAINED_COMPLETED_UTTERANCES = 128;

export type ReaderTtsHostResumeOrigin = 'mediaPlay' | 'interruptionResume';

export type ReaderTtsCoordinatorOptions = {
  /** Max delay between host.speak() acceptance and the real onStart callback. */
  startCallbackTimeoutMs?: number;
  /** Admit a native resume while the current reading session owns a resumable queue. */
  admitHostResume?: (origin: ReaderTtsHostResumeOrigin) => boolean;
  /** Reuse the current reading owner's rate and preference transaction. */
  onMediaRate?: (rate: number) => void;
  /** Defer native speech setup while the capsule launch animation owns frames. */
  waitForLaunchMotion?: () => Promise<void>;
};

export type StartWaiter = { generation: number; resolve: (started: boolean) => void };
export type ReaderTtsUserPauseAttempt = {
  sessionGeneration: number;
  controlGeneration: number;
  task?: Promise<void>;
};
export type ReaderTtsNativeStopReceipt = {
  sessionGeneration: number;
  result: Promise<Error | undefined>;
};

export type ReaderTtsStartInput = {
  chapter: ReaderTtsChapterRef;
  content: string;
  contentVersion: ReaderTtsContentVersion;
  scalarPosition: number;
  rate?: number;
  pitch?: number;
  language?: string;
  person?: number;
  pauseOnInterruption?: boolean;
  allowMixing?: boolean;
  backgroundPlayback?: boolean;
  failurePolicy?: 'skip' | 'stop';
  timerDurationMs?: number;
};

export type ReaderTtsProgressCommit = {
  chapter: ReaderTtsChapterRef;
  charEnd: number;
};

export type ReaderTtsChapterAdvanceInput = {
  chapter: ReaderTtsChapterRef;
  content: string;
  contentVersion: ReaderTtsContentVersion;
  onAdmitted?: (firstRange?: ReaderTtsChapterAdvanceRange) => boolean;
};

export interface ReaderTtsChapterAdvanceRange {
  charStart: number;
  charEnd: number;
}

export interface ReaderTtsCoordinatorGateway {
  getConfig(): Promise<ReaderTtsConfig | undefined>;
  slice(chapter: ReaderTtsChapterRef, content: string, strategy?: 'paragraph-then-sentence'): Promise<ReaderTtsSlicePlan>;
  play(plan: ReaderTtsSlicePlan, startSliceIndex: number): Promise<ReaderTtsQueueSnapshot>;
  pause(chapter: ReaderTtsChapterRef): Promise<ReaderTtsQueueSnapshot>;
  resume(chapter: ReaderTtsChapterRef): Promise<ReaderTtsQueueSnapshot>;
  stop(chapter: ReaderTtsChapterRef): Promise<ReaderTtsQueueSnapshot>;
  next(chapter: ReaderTtsChapterRef): Promise<ReaderTtsQueueSnapshot>;
  previous(chapter: ReaderTtsChapterRef): Promise<ReaderTtsQueueSnapshot>;
  seek(chapter: ReaderTtsChapterRef, sliceIndex: number): Promise<ReaderTtsQueueSnapshot>;
  skip(chapter: ReaderTtsChapterRef): Promise<ReaderTtsQueueSnapshot>;
  setRate(chapter: ReaderTtsChapterRef, rate: number): Promise<ReaderTtsQueueSnapshot>;
  chapterPlan(
    chapter: ReaderTtsChapterRef,
    nextChapter: ReaderTtsChapterRef | undefined,
    drainBehavior?: 'stop-on-boundary' | 'advance-to-next',
  ): Promise<ReaderTtsChapterTransition>;
  reportStatus(
    chapter: ReaderTtsChapterRef,
    sliceIndex: number,
    status: 'speaking' | 'done' | 'failed',
  ): Promise<ReaderTtsQueueSnapshot>;
  reportCallback(
    chapter: ReaderTtsChapterRef,
    sliceIndex: number,
    status: 'speaking' | 'done' | 'failed',
    callbackId: string,
    failurePolicy: 'skip' | 'stop',
    failureLimit?: number,
  ): Promise<ReaderTtsCallbackResult>;
}

export interface ReaderTtsAuditionInput {
  engine?: string;
  language: string;
  person: number;
  rate?: number;
  pitch?: number;
  observe?: (receipt: ReaderTtsAuditionReceipt) => void;
  trace?: (operationId: number, phase: ReaderTtsAuditionPhase) => void;
}
export type ReaderTtsAuditionState = 'started' | 'completed' | 'failed' | 'unavailable';
export type ReaderTtsAuditionCode = 'system-capability-missing' | 'book-pause' | 'engine-selection' | 'voice-probe' |
  'audio-session' | 'native-speak' | 'native-error' | 'native-stop' | 'timeout' | 'cleanup' |
  'audio-session-paused' | 'audio-session-stopped' | 'output-device-stopped';
export type ReaderTtsAuditionPhase = 'admitted' | 'book-paused' | 'engine-selected' | 'voice-probed' |
  'audio-activated' | 'speak-dispatched' | 'audio-complete-callback' | 'owner-cancelled' | 'timeout' |
  'audio-session-resumed' | 'output-device-continue';

export interface ReaderTtsAuditionReceipt {
  readonly schemaVersion: 1;
  readonly operationId: number;
  readonly state: ReaderTtsAuditionState;
  readonly code?: ReaderTtsAuditionCode;
}

export interface ReaderTtsAuditionOutcome {
  readonly state: 'completed' | 'failed' | 'unavailable';
  readonly code?: ReaderTtsAuditionCode;
}

export interface ReaderTtsAuditionSession {
  requestId: string;
  operationId: number;
  started: boolean;
  observe?: (receipt: ReaderTtsAuditionReceipt) => void;
  trace?: (operationId: number, phase: ReaderTtsAuditionPhase) => void;
  restoreEngine: string | undefined;
  timer: number;
  resolve: () => void;
  reject: (error: Error) => void;
}

export type ActiveSession = {
  identity: ReaderTtsSessionIdentity;
  traceOperationId?: number;
  input: ReaderTtsStartInput;
  plan?: ReaderTtsSlicePlan;
  config?: ReaderTtsConfig;
};

export type CorrelatedUtterance = {
  identity: ReaderTtsSessionIdentity;
  positionGeneration: number;
  controlGeneration: number;
  utteranceGeneration: number;
  requestId: string;
  chapter: ReaderTtsChapterRef;
  sliceIndex: number;
  charEnd: number;
  failurePolicy: 'skip' | 'stop';
};

export type HostTtsTransportState = {
  engine: 'system' | 'http';
  audioSession: 'inactive' | 'active';
  focus: 'none' | 'held' | 'interrupted';
  sessionGeneration: number;
  utteranceGeneration: number;
  currentRequestId?: string;
  interruption?: 'systemInterruption' | 'routeBackground' | 'deviceChange';
  timerDeadlineMs?: number;
};

export function createHostTtsTransportState(): HostTtsTransportState {
  return {
    engine: 'system',
    audioSession: 'inactive',
    focus: 'none',
    sessionGeneration: 0,
    utteranceGeneration: 0,
  };
}
