import type { ReaderAutoPageStatus } from './ReaderAutoPageState';
import type { ReaderTtsSessionStatus } from './ReaderTtsState';

export type ReaderSessionCapsuleType = 'autoPage' | 'tts';
export type ReaderSessionCapsuleState = 'preparing' | 'playing' | 'paused';

export type ReaderSessionCapsuleInput = {
  mounted: boolean;
  exitRequested: boolean;
  pageReady: boolean;
  controlObscured: boolean;
  interactionBlocked: boolean;
  controlVisible: boolean;
  autoPageStatus: ReaderAutoPageStatus;
  autoPageRemainingSeconds: number;
  ttsStatus: ReaderTtsSessionStatus;
};

export type ReaderSessionCapsuleSnapshot = {
  type: ReaderSessionCapsuleType;
  sessionState: ReaderSessionCapsuleState;
  countdown: number;
};

/**
 * The only projection from reader runtimes to the Figma capsule variants.
 * Preparing preserves the authored geometry but reports the honest business
 * state. It never pretends that audio has already started.
 */
export function deriveReaderSessionCapsule(
  input: ReaderSessionCapsuleInput,
): ReaderSessionCapsuleSnapshot | undefined {
  if (!input.mounted || input.exitRequested || !input.pageReady || input.controlObscured ||
    input.interactionBlocked || input.controlVisible) {
    return undefined;
  }
  if (input.autoPageStatus === 'running' || input.autoPageStatus === 'paused') {
    return {
      type: 'autoPage',
      sessionState: input.autoPageStatus === 'running' ? 'playing' : 'paused',
      countdown: normalizedCountdown(input.autoPageRemainingSeconds),
    };
  }
  if (input.ttsStatus === 'preparing' || input.ttsStatus === 'resuming') {
    return { type: 'tts', sessionState: 'preparing', countdown: 0 };
  }
  if (input.ttsStatus === 'playing') {
    return { type: 'tts', sessionState: 'playing', countdown: 0 };
  }
  if (input.ttsStatus === 'paused' || input.ttsStatus === 'interrupted') {
    return { type: 'tts', sessionState: 'paused', countdown: 0 };
  }
  return undefined;
}

/** A stopping TTS session still owns its audio/runtime teardown. */
export function readerTtsSessionBlocksAutoPageStart(status: ReaderTtsSessionStatus): boolean {
  return status === 'preparing' || status === 'playing' || status === 'paused' || status === 'resuming' ||
    status === 'interrupted' || status === 'stopping';
}

function normalizedCountdown(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}
