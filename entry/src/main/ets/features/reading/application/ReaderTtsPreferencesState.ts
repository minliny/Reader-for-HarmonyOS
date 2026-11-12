export type ReaderTtsFailurePolicy = 'skip' | 'stop';

export type ReaderTtsVoiceOption = {
  language: string;
  person: number;
  label: string;
};

export type ReaderTtsPreferencesSnapshot = {
  version: 1;
  language: string;
  person: number;
  pauseOnInterruption: boolean;
  allowMixing: boolean;
  failurePolicy: ReaderTtsFailurePolicy;
  followHighlight: boolean;
  /** Keep the continuous-task lease while speech continues in background. */
  backgroundPlayback: boolean;
  /** Hold the Reader window awake for the duration of speech. */
  keepScreenOn: boolean;
};

/**
 * Newer system images report downloadable catalogue entries alongside voices
 * that can be created immediately. Only the latter may enter persisted Reader
 * choices; older images omit status, so an absent value remains compatible.
 */
export function isReaderTtsVoiceInstalled(status: string | undefined): boolean {
  if (status === undefined || status.trim().length === 0) return true;
  return status.trim().toUpperCase() === 'INSTALLED';
}

const DEFAULT_LANGUAGE = 'zh-CN';
const DEFAULT_PERSON = 0;
const MAX_LANGUAGE_LENGTH = 32;
const MAX_PERSON = 10000;

export function createDefaultReaderTtsPreferencesSnapshot(): ReaderTtsPreferencesSnapshot {
  return {
    version: 1,
    language: DEFAULT_LANGUAGE,
    person: DEFAULT_PERSON,
    pauseOnInterruption: true,
    allowMixing: false,
    failurePolicy: 'stop',
    followHighlight: true,
    backgroundPlayback: true,
    keepScreenOn: false,
  };
}

export function normalizeReaderTtsPreferencesSnapshot(
  value: ReaderTtsPreferencesSnapshot | undefined,
): ReaderTtsPreferencesSnapshot {
  const fallback = createDefaultReaderTtsPreferencesSnapshot();
  if (value === undefined || value.version !== 1) return fallback;
  const language = value.language.trim();
  return {
    version: 1,
    language: language.length > 0 && language.length <= MAX_LANGUAGE_LENGTH ? language : fallback.language,
    person: Number.isSafeInteger(value.person) && value.person >= 0 && value.person <= MAX_PERSON ?
      value.person : fallback.person,
    pauseOnInterruption: typeof value.pauseOnInterruption === 'boolean' ?
      value.pauseOnInterruption : fallback.pauseOnInterruption,
    allowMixing: typeof value.allowMixing === 'boolean' ? value.allowMixing : fallback.allowMixing,
    failurePolicy: value.failurePolicy === 'skip' || value.failurePolicy === 'stop' ?
      value.failurePolicy : fallback.failurePolicy,
    followHighlight: typeof value.followHighlight === 'boolean' ?
      value.followHighlight : fallback.followHighlight,
    backgroundPlayback: typeof value.backgroundPlayback === 'boolean' ?
      value.backgroundPlayback : fallback.backgroundPlayback,
    keepScreenOn: typeof value.keepScreenOn === 'boolean' ?
      value.keepScreenOn : fallback.keepScreenOn,
  };
}

export function copyReaderTtsPreferencesSnapshot(
  value: ReaderTtsPreferencesSnapshot,
): ReaderTtsPreferencesSnapshot {
  return { ...value };
}
